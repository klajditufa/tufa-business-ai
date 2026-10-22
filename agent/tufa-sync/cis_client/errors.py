"""Exception types raised by cis_client."""

from __future__ import annotations

import re
from typing import Optional


class CisClientError(Exception):
    """Base class for every error raised by this package."""


class CertificateError(CisClientError):
    """The certificate could not be loaded or cannot be used for signing."""


class ValidationError(CisClientError):
    """A request parameter is invalid. Nothing was sent to CIS."""

    def __init__(self, message: str, field: Optional[str] = None):
        super().__init__(message)
        self.field = field


class TransportError(CisClientError):
    """CIS could not be reached, or it answered with something that is not a valid response."""


class SignatureError(CisClientError):
    """An XML signature is missing, malformed or does not verify."""


# Short explanations for the CIS fault codes people run into most often.
# The full list is in docs/PROTOCOL.md.
FAULT_HINTS = {
    "2": "This computer's clock differs too much from the tax authority's clock. Sync the system time and try again.",
    "11": "CIS rejected the message structure (XSD validation).",
    "21": "The request was not signed.",
    "25": "The signature does not cover the request element.",
    "29": "The request signature was rejected. Check that the certificate and private key belong together.",
    "30": "The request signature was rejected. Check that the certificate and private key belong together.",
    "31": "The request signature was rejected. Check that the certificate and private key belong together.",
    "33": "The certificate is not an X.509 certificate.",
    "34": "CIS does not accept this certificate. A certificate issued for the test environment only works there "
          "(and a production one only in production): check the selected environment.",
    "35": "The certificate was not issued by NAIS for this environment. Test certificates only work in the "
          "test environment and production certificates only in production.",
    "36": "The certificate has expired. Request a new fiscalization certificate.",
    "38": "The certificate has been revoked.",
    "39": "CIS could not determine the certificate status. Try again later.",
    "52": "The taxpayer does not exist in the taxpayer registry.",
    "55": "The taxpayer is not active in the taxpayer registry.",
    "87": "The search period is too long or matches too many invoices. Use a shorter date range.",
    "88": "The request has no search parameters.",
    "999": "CIS could not match the message to the service interface.",
}


# CIS appends " Code=34 RequestUUID=... ResponseUUID=..." (sometimes twice) to fault strings.
_FAULT_NOISE = re.compile(r"\s*Code=\d+\s+RequestUUID=\S*\s+ResponseUUID=\S*")


class CisFault(CisClientError):
    """CIS rejected the request with a SOAP fault."""

    def __init__(self, fault_env: str, fault_string: str, fault_code: Optional[str]):
        self.fault_env = fault_env
        self.raw_fault_string = fault_string
        self.fault_string = _FAULT_NOISE.sub("", fault_string).strip() or fault_string
        self.fault_code = fault_code
        suffix = f" (code {fault_code})" if fault_code else ""
        super().__init__(f"{self.fault_string or 'CIS rejected the request'}{suffix}")

    @property
    def is_client_error(self) -> bool:
        """True when CIS blames the request (env:CLIENT); retrying the same request will not help."""
        return self.fault_env.upper().endswith("CLIENT")

    @property
    def hint(self) -> Optional[str]:
        return FAULT_HINTS.get(self.fault_code or "")

    def to_dict(self) -> dict:
        return {"faultEnv": self.fault_env, "faultString": self.fault_string, "faultCode": self.fault_code}
