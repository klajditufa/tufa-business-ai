from __future__ import annotations


class ApiError(Exception):
    """An error answered with ``status`` and ``{"message", "field"?, ...extra}``."""

    def __init__(self, status: int, message: str, field: str | None = None, extra: dict | None = None):
        super().__init__(message)
        self.status = status
        self.field = field
        self.extra = extra or {}
