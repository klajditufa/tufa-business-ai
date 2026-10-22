"""SOAP plumbing: building signed request messages, sending them, reading responses.

CIS exposes three SOAP 1.1 services. Each request message looks like::

    <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
      <SOAP-ENV:Header/>
      <SOAP-ENV:Body>
        <XxxRequest xmlns="{service namespace}/schema" Id="Request" Version="...">
          <Header UUID="{uuid4}" SendDateTime="2026-10-22T10:15:00+02:00"/>
          ... operation specific elements ...
          <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">...</Signature>
        </XxxRequest>
      </SOAP-ENV:Body>
    </SOAP-ENV:Envelope>
"""

from __future__ import annotations

import logging
import ssl
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Callable, Dict, Optional, Tuple

from lxml import etree

from . import timeutil
from .certificate import Certificate
from .errors import CisFault, TransportError, ValidationError
from .xmlsig import sign_enveloped

log = logging.getLogger("cis_client")

SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/"
ENVIRONMENTS = ("production", "test")
MAX_RESPONSE_BYTES = 64 * 1024 * 1024


@dataclass(frozen=True)
class Service:
    path: str
    namespace: str  # SOAPAction prefix; the XML schema namespace is this plus "/schema"
    host: str  # production host; the test host adds "-test"

    @property
    def schema_namespace(self) -> str:
        return f"{self.namespace}/schema"

    def url(self, environment: str) -> str:
        host = self.host if environment == "production" else self.host.replace(".", "-test.", 1)
        return f"https://{host}/{self.path}"


SERVICES: Dict[str, Service] = {
    "data": Service("FiscalizationDataService-v1", "https://eFiskalizimi.tatime.gov.al/FiscalizationDataService", "efiskalizimi.tatime.gov.al"),
    "fiscalization": Service("FiscalizationService-v3", "https://eFiskalizimi.tatime.gov.al/FiscalizationService", "efiskalizimi.tatime.gov.al"),
    "einvoice": Service("EinvoiceService-v1", "https://Einvoice.tatime.gov.al/EinvoiceService", "einvoice.tatime.gov.al"),
}


@dataclass(frozen=True)
class Operation:
    name: str  # e.g. "GetInvoices": request root is GetInvoicesRequest, response root GetInvoicesResponse
    service: str  # key in SERVICES
    version: str  # value of the fixed Version attribute in the service XSD

    @property
    def soap_action(self) -> str:
        return f"{SERVICES[self.service].namespace}/{self.name}"


GET_INVOICES = Operation("GetInvoices", "data", "3")
GET_OPERATORS = Operation("GetOperators", "fiscalization", "3")
GET_BUSINESS_UNITS = Operation("GetBusinessUnits", "fiscalization", "3")
GET_TCRS = Operation("GetTCRs", "fiscalization", "3")
GET_TAXPAYERS = Operation("GetTaxpayers", "einvoice", "1")
GET_EINVOICES = Operation("GetEinvoices", "einvoice", "1")

# Adds operation specific children to the request element; receives the element and its namespace.
BodyBuilder = Callable[[etree._Element, str], None]


def local_name(node: etree._Element) -> str:
    """Tag name without namespace ('' for comments and processing instructions)."""
    return etree.QName(node).localname if isinstance(node.tag, str) else ""


def child(node: etree._Element, name: str) -> Optional[etree._Element]:
    """First child with the given local name, ignoring namespaces."""
    for item in node:
        if local_name(item) == name:
            return item
    return None


def build_request(
    operation: Operation,
    certificate: Certificate,
    add_body: Optional[BodyBuilder] = None,
    request_uuid: Optional[str] = None,
    send_datetime: Optional[str] = None,
) -> Tuple[bytes, str]:
    """Return the signed SOAP envelope and the request UUID it carries.

    ``request_uuid`` and ``send_datetime`` exist for reproducible tests; leave
    them out in normal use.
    """
    namespace = SERVICES[operation.service].schema_namespace
    request_uuid = request_uuid or str(uuid.uuid4())

    envelope = etree.Element(f"{{{SOAP_NS}}}Envelope", nsmap={"SOAP-ENV": SOAP_NS})
    etree.SubElement(envelope, f"{{{SOAP_NS}}}Header")
    body = etree.SubElement(envelope, f"{{{SOAP_NS}}}Body")
    request = etree.SubElement(body, f"{{{namespace}}}{operation.name}Request", nsmap={None: namespace})
    request.set("Id", "Request")
    request.set("Version", operation.version)
    header = etree.SubElement(request, f"{{{namespace}}}Header")
    header.set("UUID", request_uuid)
    header.set("SendDateTime", send_datetime or timeutil.now())
    if add_body:
        add_body(request, namespace)
    sign_enveloped(request, certificate)
    return etree.tostring(envelope, xml_declaration=True, encoding="UTF-8"), request_uuid


def _parser() -> etree.XMLParser:
    return etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False, huge_tree=True)


def parse_response(data: bytes, operation: Operation, request_uuid: str) -> etree._Element:
    """Return the ``<OperationResponse>`` element, or raise CisFault / TransportError."""
    if b"<!DOCTYPE" in data[:2048].upper() or b"<!ENTITY" in data[:2048].upper():
        raise TransportError("CIS response contains a DOCTYPE and was rejected")
    try:
        root = etree.fromstring(data, _parser())
    except etree.XMLSyntaxError:
        raise TransportError("CIS response is not valid XML") from None
    body = child(root, "Body") if local_name(root) == "Envelope" else None
    if body is None:
        raise TransportError("CIS response is not a SOAP envelope")

    fault = child(body, "Fault")
    if fault is not None:
        raw_code = (fault.findtext("faultcode") or fault.findtext(f"{{{SOAP_NS}}}faultcode") or "").strip()
        detail = child(fault, "detail")
        code_node = child(detail, "code") if detail is not None else None
        fault_env = "env:" + (raw_code.rsplit(":", 1)[-1].upper() or "SERVER")
        fault_string = (fault.findtext("faultstring") or "").strip()
        fault_code = (code_node.text or "").strip() if code_node is not None and code_node.text else None
        raise CisFault(fault_env, fault_string, fault_code)

    response = child(body, f"{operation.name}Response")
    if response is None:
        raise TransportError(f"CIS response has no {operation.name}Response element")
    header = child(response, "Header")
    echoed = (header.get("RequestUUID") or "").strip().lower() if header is not None else ""
    if echoed != request_uuid.lower():
        raise TransportError("CIS response does not belong to this request (RequestUUID mismatch)")
    return response


def _ssl_context(verify: bool) -> ssl.SSLContext:
    if not verify:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        return context
    try:
        import certifi  # Python builds on macOS/Windows often lack a usable system CA store.

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


# Sends (url, body, headers, timeout) and returns (HTTP status, response body).
Poster = Callable[[str, bytes, Dict[str, str], float], Tuple[int, bytes]]


class SoapTransport:
    """Signs, sends and parses CIS requests for one certificate and environment."""

    def __init__(
        self,
        certificate: Certificate,
        environment: str = "production",
        timeout: float = 60.0,
        retries: int = 2,
        verify_tls: bool = True,
        poster: Optional[Poster] = None,
    ):
        if environment not in ENVIRONMENTS:
            raise ValidationError(f"environment must be one of: {', '.join(ENVIRONMENTS)}", "environment")
        self.certificate = certificate
        self.environment = environment
        self.timeout = timeout
        self.retries = max(0, retries)
        self._poster = poster or self._make_poster(verify_tls)

    def _make_poster(self, verify_tls: bool) -> Poster:
        context = _ssl_context(verify_tls)
        opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context))

        def post(url: str, body: bytes, headers: Dict[str, str], timeout: float) -> Tuple[int, bytes]:
            request = urllib.request.Request(url, data=body, headers=headers, method="POST")
            try:
                with opener.open(request, timeout=timeout) as response:
                    return response.status, response.read(MAX_RESPONSE_BYTES + 1)
            except urllib.error.HTTPError as error:  # SOAP faults arrive with HTTP 500.
                with error:
                    return error.code, error.read(MAX_RESPONSE_BYTES + 1)

        return post

    def call(self, operation: Operation, add_body: Optional[BodyBuilder] = None) -> etree._Element:
        url = SERVICES[operation.service].url(self.environment)
        attempt = 0
        while True:
            attempt += 1
            # Each attempt is a new message: fresh UUID, fresh SendDateTime, fresh signature.
            payload, request_uuid = build_request(operation, self.certificate, add_body)
            headers = {"Content-Type": "text/xml; charset=utf-8", "SOAPAction": operation.soap_action}
            log.debug("POST %s %s\n%s", url, operation.name, payload.decode("utf-8"))
            try:
                status, data = self._poster(url, payload, headers, self.timeout)
            except (urllib.error.URLError, OSError) as error:
                reason = getattr(error, "reason", error)
                if attempt <= self.retries:
                    time.sleep(attempt)
                    continue
                raise TransportError(f"Cannot reach CIS ({url}): {reason}") from None
            log.debug("HTTP %s from %s\n%s", status, operation.name, data[:20000].decode("utf-8", "replace"))
            if len(data) > MAX_RESPONSE_BYTES:
                raise TransportError("CIS response is too large")
            if status in (502, 503, 504) and attempt <= self.retries:
                time.sleep(attempt)
                continue
            try:
                response = parse_response(data, operation, request_uuid)
            except CisFault as fault:
                if not fault.is_client_error and attempt <= self.retries:
                    time.sleep(attempt)
                    continue
                raise
            except TransportError:
                if status != 200:
                    raise TransportError(f"CIS returned HTTP {status} for {operation.name}") from None
                raise
            if status != 200:
                raise TransportError(f"CIS returned HTTP {status} for {operation.name}")
            return response
