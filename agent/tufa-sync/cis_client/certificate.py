"""Loading the business's fiscalization certificate.

NAIS issues the certificate as a PKCS#12 file (``.p12`` / ``.pfx``) protected
by a password. A PEM file that contains both the certificate and its private
key is accepted as well.

The private key never leaves this object: it is only used to sign request
messages. Only the public certificate is sent to CIS (inside the signature).
"""

from __future__ import annotations

import base64
import re
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Optional, Tuple, Union

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

from .errors import CertificateError

NIPT_PATTERN = re.compile(r"(?<![A-Za-z0-9])([A-Za-z]\d{8}[A-Za-z])(?![A-Za-z0-9])")
_PEM_CERT = re.compile(rb"-----BEGIN CERTIFICATE-----.+?-----END CERTIFICATE-----", re.S)
_PEM_KEY = re.compile(
    rb"-----BEGIN (?:RSA |ENCRYPTED )?PRIVATE KEY-----.+?-----END (?:RSA |ENCRYPTED )?PRIVATE KEY-----", re.S
)
# Subject attributes that may carry the NIPT, in the order they are checked.
# NAIS certificates put it in SN (surname, 2.5.4.4); CIS rejects certificates without it (fault 34).
_NIPT_ATTRIBUTES = (
    NameOID.SURNAME,
    NameOID.SERIAL_NUMBER,
    x509.ObjectIdentifier("2.5.4.97"),  # organizationIdentifier, e.g. "VATAL-K12345678A"
    NameOID.COMMON_NAME,
    NameOID.ORGANIZATIONAL_UNIT_NAME,
    NameOID.ORGANIZATION_NAME,
)

Password = Union[str, bytes, None]


def _name_value(name: x509.Name, oid: x509.ObjectIdentifier) -> Optional[str]:
    values = name.get_attributes_for_oid(oid)
    return str(values[0].value) if values else None


def _utc(cert: x509.Certificate, attribute: str) -> datetime:
    # cryptography >= 42 offers *_utc variants; older versions return naive UTC datetimes.
    value = getattr(cert, f"{attribute}_utc", None)
    if value is None:
        value = getattr(cert, attribute).replace(tzinfo=timezone.utc)
    return value


def _password_candidates(password: Password) -> List[Optional[bytes]]:
    if password is None or password == "" or password == b"":
        # Files exported "without a password" use either no password or an empty one.
        return [None, b""]
    return [password.encode("utf-8") if isinstance(password, str) else password]


def _same_key(private_key: rsa.RSAPrivateKey, cert: x509.Certificate) -> bool:
    public = cert.public_key()
    return isinstance(public, rsa.RSAPublicKey) and public.public_numbers() == private_key.public_key().public_numbers()


class Certificate:
    """An RSA private key together with the X.509 certificate it belongs to."""

    def __init__(
        self,
        private_key: rsa.RSAPrivateKey,
        certificate: x509.Certificate,
        chain: Iterable[x509.Certificate] = (),
    ):
        if not isinstance(private_key, rsa.RSAPrivateKey):
            raise CertificateError("CIS requires an RSA key; this certificate uses a different key type.")
        if not _same_key(private_key, certificate):
            raise CertificateError("The private key does not belong to the certificate.")
        self._key = private_key
        self.x509 = certificate
        self.chain: Tuple[x509.Certificate, ...] = tuple(chain)

    # Loading ----------------------------------------------------------------

    @classmethod
    def from_file(cls, path: Union[str, Path], password: Password = None) -> "Certificate":
        try:
            data = Path(path).expanduser().read_bytes()
        except OSError as error:
            raise CertificateError(f"Cannot read the certificate file: {error.strerror or error}") from None
        return cls.from_bytes(data, password)

    @classmethod
    def from_bytes(cls, data: bytes, password: Password = None) -> "Certificate":
        if not data:
            raise CertificateError("The certificate file is empty.")
        if b"-----BEGIN" in data[:4096]:
            return cls._from_pem(data, password)
        return cls._from_pkcs12(data, password)

    @classmethod
    def _from_pkcs12(cls, data: bytes, password: Password) -> "Certificate":
        loaded = None
        for candidate in _password_candidates(password):
            try:
                with warnings.catch_warnings():
                    # NAIS exports carry a few trailing bytes; cryptography parses them as BER and warns.
                    warnings.filterwarnings("ignore", message="PKCS#12 bundle could not be parsed as DER")
                    loaded = pkcs12.load_key_and_certificates(data, candidate)
                break
            except (ValueError, TypeError):
                continue
        if loaded is None:
            if password:
                raise CertificateError("Could not open the certificate: the password is wrong or the file is not a .p12/.pfx file.")
            raise CertificateError("This certificate is password protected. Enter its password.")
        key, cert, extra = loaded
        if key is None or cert is None:
            raise CertificateError("The .p12/.pfx file does not contain both a certificate and its private key.")
        if not _same_key(key, cert):  # Some exports put the end-entity certificate among the extras.
            cert = next((item for item in extra if _same_key(key, item)), cert)
        return cls(key, cert, [item for item in extra if item is not cert])

    @classmethod
    def _from_pem(cls, data: bytes, password: Password) -> "Certificate":
        certs = [x509.load_pem_x509_certificate(block) for block in _PEM_CERT.findall(data)]
        keys = _PEM_KEY.findall(data)
        if not certs:
            raise CertificateError("The PEM file does not contain a certificate.")
        if not keys:
            raise CertificateError("The PEM file does not contain a private key. Use the .p12/.pfx file instead.")
        key = None
        for candidate in _password_candidates(password):
            try:
                key = serialization.load_pem_private_key(keys[0], candidate)
                break
            except (ValueError, TypeError):
                continue
        if key is None:
            raise CertificateError("Could not open the private key: the password is wrong or missing.")
        if not isinstance(key, rsa.RSAPrivateKey):
            raise CertificateError("CIS requires an RSA key; this certificate uses a different key type.")
        cert = next((item for item in certs if _same_key(key, item)), None)
        if cert is None:
            raise CertificateError("None of the certificates in the PEM file match its private key.")
        return cls(key, cert, [item for item in certs if item is not cert])

    # Signing ----------------------------------------------------------------

    def sign_sha256(self, data: bytes) -> bytes:
        """RSASSA-PKCS1-v1_5 signature with SHA-256 (``rsa-sha256`` in XML-DSig terms)."""
        return self._key.sign(data, padding.PKCS1v15(), hashes.SHA256())

    @property
    def der(self) -> bytes:
        return self.x509.public_bytes(serialization.Encoding.DER)

    @property
    def der_base64(self) -> str:
        return base64.b64encode(self.der).decode("ascii")

    # Details ----------------------------------------------------------------

    @property
    def nipt(self) -> Optional[str]:
        """The business NIPT, when the certificate subject contains one."""
        subject = self.x509.subject
        for oid in _NIPT_ATTRIBUTES:
            for attribute in subject.get_attributes_for_oid(oid):
                match = NIPT_PATTERN.search(str(attribute.value))
                if match:
                    return match.group(1).upper()
        match = NIPT_PATTERN.search(subject.rfc4514_string())
        return match.group(1).upper() if match else None

    @property
    def common_name(self) -> Optional[str]:
        return _name_value(self.x509.subject, NameOID.COMMON_NAME)

    @property
    def organization(self) -> Optional[str]:
        return _name_value(self.x509.subject, NameOID.ORGANIZATION_NAME)

    @property
    def issuer(self) -> str:
        return _name_value(self.x509.issuer, NameOID.COMMON_NAME) or self.x509.issuer.rfc4514_string()

    @property
    def not_before(self) -> datetime:
        return _utc(self.x509, "not_valid_before")

    @property
    def not_after(self) -> datetime:
        return _utc(self.x509, "not_valid_after")

    @property
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.not_after

    @property
    def is_not_yet_valid(self) -> bool:
        return datetime.now(timezone.utc) < self.not_before

    @property
    def suggested_environment(self) -> str:
        """The CIS environment the certificate was issued for.

        NAIS marks test certificates with title (2.5.4.12) "Test"; production CIS
        refuses them with fault 34 "doesn't contain valid title value".
        """
        title = _name_value(self.x509.subject, NameOID.TITLE) or ""
        issuer = self.x509.issuer.rfc4514_string()
        return "test" if "test" in f"{title} {issuer}".lower() else "production"

    def summary(self) -> dict:
        """JSON friendly description. Contains no secret material."""
        return {
            "nipt": self.nipt,
            "name": self.organization or self.common_name,
            "commonName": self.common_name,
            "subject": self.x509.subject.rfc4514_string(),
            "issuer": self.issuer,
            "serialNumber": format(self.x509.serial_number, "X"),
            "validFrom": self.not_before.isoformat(),
            "validTo": self.not_after.isoformat(),
            "expired": self.is_expired,
            "notYetValid": self.is_not_yet_valid,
            "fingerprintSha256": self.x509.fingerprint(hashes.SHA256()).hex().upper(),
            "suggestedEnvironment": self.suggested_environment,
        }


def load_certificate(path: Union[str, Path], password: Password = None) -> Certificate:
    """Load a .p12/.pfx (or PEM) fiscalization certificate."""
    return Certificate.from_file(path, password)
