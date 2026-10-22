"""Pushing CIS invoices to TUFA Business AI.

The agent reads invoices from CIS with the business's own certificate (which
never leaves this computer) and sends only the invoice data to TUFA over
HTTPS, authenticated with a per-company API key (``tba_...``) created in
TUFA under Settings → "Sinkronizimi i faturave".

    POST {TUFA_URL}/api/sync/invoices
    Authorization: Bearer tba_...
    {"direction": "sale"|"purchase", "invoices": [<CIS Inv objects>], "label": "..."}

Invoices are sent in batches; TUFA upserts them by FIC, so re-running a range
is safe and only updates what changed.
"""

from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Callable

import certifi

from .errors import CisClientError

BATCH_SIZE = 500
KINDS = {"SALES": "sale", "PURCHASES": "purchase"}


class TufaError(CisClientError):
    """TUFA refused the request or could not be reached."""


@dataclass
class PushResult:
    direction: str
    sent: int = 0
    imported: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[dict] = field(default_factory=list)
    batches: int = 0

    def merge(self, response: dict) -> None:
        self.batches += 1
        self.imported += int(response.get("imported") or 0)
        self.updated += int(response.get("updated") or 0)
        self.skipped += int(response.get("skipped") or 0)
        self.errors.extend(response.get("errors") or [])

    def as_dict(self) -> dict:
        return {
            "direction": self.direction,
            "sent": self.sent,
            "imported": self.imported,
            "updated": self.updated,
            "skipped": self.skipped,
            "batches": self.batches,
            "errors": self.errors,
        }


class TufaClient:
    """Minimal HTTPS client for the TUFA sync API (standard library only)."""

    def __init__(self, base_url: str, api_key: str, *, timeout: float = 60.0):
        base_url = (base_url or "").strip().rstrip("/")
        if not base_url.startswith("https://") and not base_url.startswith("http://localhost"):
            raise TufaError("TUFA_URL must be an https:// address, e.g. https://tufa-business-ai.vercel.app")
        if not (api_key or "").startswith("tba_"):
            raise TufaError("TUFA_API_KEY must be a key created in TUFA (it starts with tba_)")
        self.base_url = base_url
        self._api_key = api_key.strip()
        self.timeout = timeout
        self._ssl = ssl.create_default_context(cafile=certifi.where())

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        request = urllib.request.Request(
            self.base_url + path,
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
                "User-Agent": "tufa-sync/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout, context=self._ssl) as response:
                payload = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")
            try:
                message = json.loads(detail).get("error") or detail
            except ValueError:
                message = detail
            if error.code == 401:
                raise TufaError(
                    "TUFA rejected the API key (401). Create a new key under Settings → Sinkronizimi."
                ) from None
            raise TufaError(f"TUFA returned HTTP {error.code}: {message[:300]}") from None
        except urllib.error.URLError as error:
            raise TufaError(f"Cannot reach TUFA at {self.base_url}: {error.reason}") from None
        try:
            return json.loads(payload.decode("utf-8"))
        except ValueError:
            raise TufaError("TUFA returned a non-JSON response") from None

    def check(self) -> dict:
        """Verify the key; returns the company TUFA associates with it."""
        return self._request("GET", "/api/sync/invoices")

    def push(
        self,
        kind: str,
        invoices: Iterable[dict],
        *,
        label: str | None = None,
        progress: Callable[[int, int], None] | None = None,
    ) -> PushResult:
        direction = KINDS.get(kind.upper())
        if direction is None:
            raise TufaError(f"Unknown invoice kind {kind!r}; expected SALES or PURCHASES")
        rows = list(invoices)
        result = PushResult(direction=direction, sent=len(rows))
        for start in range(0, len(rows), BATCH_SIZE):
            chunk = rows[start : start + BATCH_SIZE]
            response = self._request(
                "POST", "/api/sync/invoices", {"direction": direction, "invoices": chunk, "label": label}
            )
            if not response.get("ok"):
                raise TufaError(f"TUFA refused the batch: {response.get('error') or response}")
            result.merge(response)
            if progress:
                progress(min(start + BATCH_SIZE, len(rows)), len(rows))
        if not rows:
            result.batches = 0
        return result
