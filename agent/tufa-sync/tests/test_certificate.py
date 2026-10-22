from __future__ import annotations

import unittest
from datetime import datetime, timezone

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

from cis_client.certificate import Certificate
from cis_client.errors import CertificateError

from .helpers import TEST_P12, load_test_certificate, make_certificate, make_x509, test_key


class LoadingTest(unittest.TestCase):
    def test_p12_with_password(self) -> None:
        certificate = load_test_certificate()
        self.assertEqual(certificate.nipt, "X99999999X")
        self.assertEqual(certificate.organization, "TEST ONLY SHPK")
        self.assertEqual(certificate.suggested_environment, "test")
        self.assertFalse(certificate.is_expired)

    def test_wrong_password(self) -> None:
        with self.assertRaisesRegex(CertificateError, "password is wrong"):
            Certificate.from_file(TEST_P12, "nope")

    def test_missing_password(self) -> None:
        with self.assertRaisesRegex(CertificateError, "password protected"):
            Certificate.from_file(TEST_P12)

    def test_missing_file(self) -> None:
        with self.assertRaisesRegex(CertificateError, "Cannot read"):
            Certificate.from_file(TEST_P12.with_name("missing.p12"))

    def test_p12_without_password(self) -> None:
        cert = make_x509([x509.NameAttribute(NameOID.COMMON_NAME, "Open")])
        data = pkcs12.serialize_key_and_certificates(b"x", test_key(), cert, None, serialization.NoEncryption())
        self.assertEqual(Certificate.from_bytes(data).common_name, "Open")
        self.assertEqual(Certificate.from_bytes(data, "").common_name, "Open")

    def test_legacy_triple_des_p12(self) -> None:
        # Older exports use PBE-SHA1-3DES; they must still open.
        cert = make_x509([x509.NameAttribute(NameOID.COMMON_NAME, "Legacy")])
        encryption = (
            serialization.PrivateFormat.PKCS12.encryption_builder()
            .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC)
            .hmac_hash(hashes.SHA1())
            .build(b"secret")
        )
        data = pkcs12.serialize_key_and_certificates(b"x", test_key(), cert, None, encryption)
        self.assertEqual(Certificate.from_bytes(data, "secret").common_name, "Legacy")

    def test_pem_bundle(self) -> None:
        certificate = load_test_certificate()
        key_pem = test_key().private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                           serialization.BestAvailableEncryption(b"pem-pass"))
        cert = make_x509([x509.NameAttribute(NameOID.COMMON_NAME, "Pem")])
        bundle = certificate.x509.public_bytes(serialization.Encoding.PEM) + cert.public_bytes(serialization.Encoding.PEM) + key_pem
        loaded = Certificate.from_bytes(bundle, "pem-pass")
        self.assertEqual(loaded.common_name, "Pem")  # picks the certificate that matches the key
        self.assertEqual(len(loaded.chain), 1)
        with self.assertRaises(CertificateError):
            Certificate.from_bytes(bundle, "wrong")

    def test_pem_without_key(self) -> None:
        pem = load_test_certificate().x509.public_bytes(serialization.Encoding.PEM)
        with self.assertRaisesRegex(CertificateError, "private key"):
            Certificate.from_bytes(pem)

    def test_key_must_match(self) -> None:
        other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        with self.assertRaisesRegex(CertificateError, "does not belong"):
            Certificate(other, load_test_certificate().x509)

    def test_rsa_required(self) -> None:
        key = ec.generate_private_key(ec.SECP256R1())
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "EC")])
        cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
                .serial_number(1).not_valid_before(datetime(2020, 1, 1, tzinfo=timezone.utc))
                .not_valid_after(datetime(2040, 1, 1, tzinfo=timezone.utc)).sign(key, hashes.SHA256()))
        data = pkcs12.serialize_key_and_certificates(b"x", key, cert, None, serialization.NoEncryption())
        with self.assertRaisesRegex(CertificateError, "RSA"):
            Certificate.from_bytes(data)

    def test_garbage(self) -> None:
        with self.assertRaises(CertificateError):
            Certificate.from_bytes(b"not a certificate", "x")
        with self.assertRaises(CertificateError):
            Certificate.from_bytes(b"")


class DetailsTest(unittest.TestCase):
    def test_nipt_locations(self) -> None:
        # NAIS layout: SN carries the NIPT, serialNumber an internal code, title marks test certificates.
        nais = make_certificate("Shop Fiskalizimi1", SURNAME="M12345678N", SERIAL_NUMBER="MSHP1", TITLE="Test")
        self.assertEqual(nais.nipt, "M12345678N")
        self.assertEqual(nais.suggested_environment, "test")
        self.assertEqual(make_certificate("Shop", SURNAME="M12345678N", TITLE="Fiskalizim").suggested_environment, "production")
        self.assertEqual(make_certificate("K12345678A").nipt, "K12345678A")
        self.assertEqual(make_certificate("Shop", SERIAL_NUMBER="l12345678b").nipt, "L12345678B")
        org_id = x509.NameAttribute(x509.ObjectIdentifier("2.5.4.97"), "VATAL-M12345678C")
        cert = Certificate(test_key(), make_x509([x509.NameAttribute(NameOID.COMMON_NAME, "Shop"), org_id]))
        self.assertEqual(cert.nipt, "M12345678C")
        self.assertIsNone(make_certificate("No number here").nipt)
        self.assertIsNone(make_certificate("AK12345678AB").nipt)  # embedded in a longer token

    def test_expired(self) -> None:
        cert = Certificate(test_key(), make_x509([x509.NameAttribute(NameOID.COMMON_NAME, "Old")],
                                                 not_after=datetime(2021, 1, 1, tzinfo=timezone.utc)))
        self.assertTrue(cert.is_expired)
        self.assertTrue(cert.summary()["expired"])

    def test_summary_has_no_secrets(self) -> None:
        summary = load_test_certificate().summary()
        self.assertEqual(summary["nipt"], "X99999999X")
        text = repr(summary).lower()
        self.assertNotIn("private", text)
        self.assertEqual(set(summary), {
            "nipt", "name", "commonName", "subject", "issuer", "serialNumber", "validFrom", "validTo",
            "expired", "notYetValid", "fingerprintSha256", "suggestedEnvironment",
        })


if __name__ == "__main__":
    unittest.main()
