"""Shared test helpers."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

from cis_client.certificate import Certificate

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = Path(__file__).resolve().parent / "fixtures"
SCHEMAS = ROOT / "schemas"
TEST_P12 = FIXTURES / "selfsigned-test-only.p12"
TEST_P12_PASSWORD = "test"

_KEY: rsa.RSAPrivateKey | None = None


def test_key() -> rsa.RSAPrivateKey:
    global _KEY
    if _KEY is None:
        _KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return _KEY


def make_x509(
    attributes: Iterable[x509.NameAttribute],
    key: rsa.RSAPrivateKey | None = None,
    not_after: datetime = datetime(2040, 1, 1, tzinfo=timezone.utc),
) -> x509.Certificate:
    key = key or test_key()
    name = x509.Name(list(attributes))
    return (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime(2020, 1, 1, tzinfo=timezone.utc))
        .not_valid_after(not_after)
        .sign(key, hashes.SHA256())
    )


def make_certificate(common_name: str = "Test", **extra: str) -> Certificate:
    attributes = [x509.NameAttribute(NameOID.COMMON_NAME, common_name)]
    for oid_name, value in extra.items():
        attributes.append(x509.NameAttribute(getattr(NameOID, oid_name), value))
    return Certificate(test_key(), make_x509(attributes))


def load_test_certificate() -> Certificate:
    return Certificate.from_file(TEST_P12, TEST_P12_PASSWORD)
