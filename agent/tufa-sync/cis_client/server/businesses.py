"""The businesses of a session: one loaded certificate each, kept in memory only.

An accountant can load the certificates of every business they look after and
switch between them; requests name the business they are for (see routes.py),
otherwise the one chosen last is used.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass

from cryptography.hazmat.primitives import hashes

from .. import __version__
from ..certificate import Certificate
from ..client import CisClient
from ..errors import CisFault, TransportError, ValidationError
from ..transport import ENVIRONMENTS, Poster
from .errors import ApiError


@dataclass
class Business:
    """A certificate and the CIS client that signs with it."""

    id: str
    client: CisClient
    nipt: str | None
    verified: bool  # CIS accepted the certificate when it was loaded
    warning: str | None  # why it could not be confirmed, when CIS did not answer

    @property
    def certificate(self) -> Certificate:
        return self.client.certificate

    def summary(self) -> dict:
        certificate = self.certificate.summary()
        certificate["nipt"] = certificate["nipt"] or self.nipt
        return {
            "id": self.id,
            "environment": self.client.environment,
            "verified": self.verified,
            "warning": self.warning,
            "certificate": certificate,
        }


def certificate_id(certificate: Certificate) -> str:
    """Stable id of a certificate: loading the same file again replaces it instead of adding a copy."""
    return certificate.x509.fingerprint(hashes.SHA256()).hex()[:16]


class Businesses:
    """Certificates loaded in this session, by id, and the one requests use by default."""

    def __init__(self, timeout: float = 60.0, verify_tls: bool = True, poster: Poster | None = None):
        self.timeout = timeout
        self.verify_tls = verify_tls
        self.poster = poster  # replaces the HTTP layer in tests
        self._lock = threading.Lock()
        self._businesses: dict[str, Business] = {}
        self._active: str | None = None

    def connect(self, certificate: Certificate, environment: str | None = None) -> Business:
        """Check the certificate with CIS and return it as a business, without keeping it.

        Without an explicit environment the one the certificate was issued for
        is tried first, then the other one if CIS refuses the certificate there.
        When CIS does not answer, the business is returned unconfirmed, with a
        warning; when CIS refuses the certificate, its fault is raised.
        """
        if environment is not None and environment not in ENVIRONMENTS:
            raise ValidationError("environment must be production or test", "environment")
        suggested = certificate.suggested_environment
        candidates = (
            [environment] if environment else [suggested, "test" if suggested == "production" else "production"]
        )
        nipt, verified, warning = certificate.nipt, False, None
        refused: CisFault | None = None
        for candidate in candidates:
            client = CisClient(
                certificate, candidate, timeout=self.timeout, verify_tls=self.verify_tls, poster=self.poster
            )
            try:
                # A cheap signed call proves CIS accepts this certificate in this environment.
                tcrs = client.get_tcrs()
            except CisFault as fault:
                if not fault.is_client_error:
                    warning = f"CIS could not confirm the certificate right now: {fault}"
                    break
                refused = refused or fault
                if fault.fault_code in ("34", "35"):  # issued for the other environment
                    continue
                raise
            except TransportError as error:
                warning = f"CIS could not be reached to confirm the certificate: {error}"
                break
            verified, refused = True, None
            # Some certificates carry no NIPT; CIS knows it from the registered devices.
            nipt = nipt or next((item.get("IssuerNUIS") for item in tcrs if item.get("IssuerNUIS")), None)
            break
        if refused is not None:
            raise refused
        return Business(certificate_id(certificate), client, nipt, verified, warning)

    def add(self, certificate: Certificate, environment: str | None = None) -> Business:
        """Load a certificate (replacing the same one loaded before) and make it the active business."""
        business = self.connect(certificate, environment)
        with self._lock:
            self._businesses[business.id] = business
            self._active = business.id
        return business

    def get(self, business_id: str | None = None) -> Business:
        """The named business, or the active one."""
        with self._lock:
            business = self._businesses.get(business_id or self._active or "")
        if business is None:
            raise ApiError(
                401, "Load a certificate first" if not business_id else "This certificate is no longer loaded"
            )
        return business

    def select(self, business_id: str) -> Business:
        business = self.get(business_id)
        with self._lock:
            self._active = business.id
        return business

    def remove(self, business_id: str | None = None) -> None:
        business = self.get(business_id)
        with self._lock:
            self._businesses.pop(business.id, None)
            if self._active == business.id:
                self._active = next(iter(self._businesses), None)

    def all(self) -> list[Business]:
        with self._lock:
            return list(self._businesses.values())

    def session(self) -> dict:
        with self._lock:
            businesses, active = list(self._businesses.values()), self._active
        return {"version": __version__, "active": active, "businesses": [business.summary() for business in businesses]}
