"""Enveloped XML signatures as required by CIS.

Every CIS request carries an XML-DSig signature over the request element
(the one with ``Id="Request"``), using exactly these algorithms:

* canonicalization: exclusive C14N 1.0 (``xml-exc-c14n#``), without comments
* transforms:       enveloped-signature, then exclusive C14N
* digest:           SHA-256
* signature:        RSA PKCS#1 v1.5 with SHA-256
* key info:         the signer's X.509 certificate (base64 DER)

See docs/PROTOCOL.md for a step by step description.
"""

from __future__ import annotations

import base64
import copy
import hashlib

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from lxml import etree

from .certificate import Certificate
from .errors import SignatureError

DS_NS = "http://www.w3.org/2000/09/xmldsig#"
EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#"
ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature"
RSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"
SHA256 = "http://www.w3.org/2001/04/xmlenc#sha256"


def _ds(name: str) -> str:
    return f"{{{DS_NS}}}{name}"


def canonicalize(element: etree._Element) -> bytes:
    """Exclusive XML canonicalization 1.0 without comments."""
    return etree.tostring(element, method="c14n", exclusive=True, with_comments=False)


def sign_enveloped(element: etree._Element, certificate: Certificate) -> etree._Element:
    """Append a ``<Signature>`` to ``element`` and return it.

    ``element`` must carry the ``Id`` attribute referenced by the signature and
    must be complete: anything added afterwards invalidates the signature.
    """
    reference_id = element.get("Id")
    if not reference_id:
        raise SignatureError("The element to sign has no Id attribute")
    if element.find(_ds("Signature")) is not None:
        raise SignatureError("The element is already signed")

    # Computing the digest before the Signature exists is equivalent to applying
    # the enveloped-signature transform afterwards.
    digest = base64.b64encode(hashlib.sha256(canonicalize(element)).digest()).decode("ascii")

    signature = etree.SubElement(element, _ds("Signature"), nsmap={None: DS_NS})
    signed_info = etree.SubElement(signature, _ds("SignedInfo"))
    etree.SubElement(signed_info, _ds("CanonicalizationMethod"), Algorithm=EXC_C14N)
    etree.SubElement(signed_info, _ds("SignatureMethod"), Algorithm=RSA_SHA256)
    reference = etree.SubElement(signed_info, _ds("Reference"), URI=f"#{reference_id}")
    transforms = etree.SubElement(reference, _ds("Transforms"))
    etree.SubElement(transforms, _ds("Transform"), Algorithm=ENVELOPED)
    etree.SubElement(transforms, _ds("Transform"), Algorithm=EXC_C14N)
    etree.SubElement(reference, _ds("DigestMethod"), Algorithm=SHA256)
    etree.SubElement(reference, _ds("DigestValue")).text = digest

    # SignedInfo is canonicalized in place, after it has been attached to the document.
    signature_value = certificate.sign_sha256(canonicalize(signed_info))
    etree.SubElement(signature, _ds("SignatureValue")).text = base64.b64encode(signature_value).decode("ascii")
    key_info = etree.SubElement(signature, _ds("KeyInfo"))
    x509_data = etree.SubElement(key_info, _ds("X509Data"))
    etree.SubElement(x509_data, _ds("X509Certificate")).text = certificate.der_base64
    return signature


def _algorithm(parent: etree._Element, path: str) -> str:
    node = parent.find(path)
    return node.get("Algorithm", "") if node is not None else ""


def verify_enveloped(element: etree._Element) -> x509.Certificate:
    """Verify the enveloped signature of ``element`` against its embedded certificate.

    Returns the signing certificate. This proves integrity only; deciding
    whether that certificate is trusted is up to the caller.
    """
    signatures = element.findall(_ds("Signature"))
    if len(signatures) != 1:
        raise SignatureError("Expected exactly one Signature element")
    signature = signatures[0]
    signed_info = signature.find(_ds("SignedInfo"))
    if signed_info is None:
        raise SignatureError("Signature has no SignedInfo")
    if _algorithm(signed_info, _ds("CanonicalizationMethod")) != EXC_C14N:
        raise SignatureError("Unexpected canonicalization method")
    if _algorithm(signed_info, _ds("SignatureMethod")) != RSA_SHA256:
        raise SignatureError("Unexpected signature method")
    references = signed_info.findall(_ds("Reference"))
    if len(references) != 1 or references[0].get("URI") != f"#{element.get('Id')}":
        raise SignatureError("The signature does not reference this element")
    reference = references[0]
    transforms = [node.get("Algorithm") for node in reference.iterfind(f"{_ds('Transforms')}/{_ds('Transform')}")]
    if transforms != [ENVELOPED, EXC_C14N]:
        raise SignatureError("Unexpected transforms")
    if _algorithm(reference, _ds("DigestMethod")) != SHA256:
        raise SignatureError("Unexpected digest method")

    unsigned = copy.deepcopy(element)
    for node in unsigned.findall(_ds("Signature")):
        unsigned.remove(node)
    digest = base64.b64encode(hashlib.sha256(canonicalize(unsigned)).digest()).decode("ascii")
    if digest != (reference.findtext(_ds("DigestValue")) or "").strip():
        raise SignatureError("Digest does not match the signed content")

    certificate_text = signature.findtext(f"{_ds('KeyInfo')}/{_ds('X509Data')}/{_ds('X509Certificate')}")
    if not certificate_text:
        raise SignatureError("Signature has no X509Certificate")
    try:
        certificate = x509.load_der_x509_certificate(base64.b64decode("".join(certificate_text.split())))
        value = base64.b64decode("".join((signature.findtext(_ds("SignatureValue")) or "").split()))
    except ValueError as error:
        raise SignatureError(f"Malformed signature data: {error}") from None
    public_key = certificate.public_key()
    if not isinstance(public_key, rsa.RSAPublicKey):
        raise SignatureError("The signing certificate does not hold an RSA key")
    try:
        public_key.verify(value, canonicalize(signed_info), padding.PKCS1v15(), hashes.SHA256())
    except InvalidSignature:
        raise SignatureError("The signature value is not valid") from None
    return certificate
