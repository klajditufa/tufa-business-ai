"""Date and time helpers.

CIS expects ISO 8601 timestamps with a UTC offset and without fractional
seconds, e.g. ``2026-09-15T12:41:32+02:00``. Day boundaries for invoice
searches are taken in Albanian time (Europe/Tirane), whatever time zone the
computer running this code is in.
"""

from __future__ import annotations

import calendar
import re
from datetime import date, datetime, time, timedelta, tzinfo
from typing import Union

try:
    from zoneinfo import ZoneInfo

    ALBANIA: tzinfo | None = ZoneInfo("Europe/Tirane")
except Exception:  # No time zone database (e.g. Windows without the tzdata package).
    ALBANIA = None

DateLike = Union[date, str]

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _zone() -> tzinfo:
    return ALBANIA or datetime.now().astimezone().tzinfo  # type: ignore[return-value]


def cis_timestamp(moment: datetime) -> str:
    """Format an aware datetime the way CIS expects (seconds precision, numeric offset)."""
    if moment.tzinfo is None:
        raise ValueError("A time zone aware datetime is required")
    return moment.replace(microsecond=0).isoformat()


def now() -> str:
    """Current time in Albania, formatted for SendDateTime."""
    return cis_timestamp(datetime.now(_zone()))


def today() -> date:
    return datetime.now(_zone()).date()


def parse_date(value: DateLike, field: str = "date") -> date:
    """Accept a ``date`` or a ``YYYY-MM-DD`` string."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and _DATE_RE.match(value.strip()):
        try:
            return date.fromisoformat(value.strip())
        except ValueError:
            pass
    raise ValueError(f"{field} must be a date in YYYY-MM-DD format")


def start_of_day(day: date) -> str:
    return cis_timestamp(datetime.combine(day, time(0, 0, 0), tzinfo=_zone()))


def end_of_day(day: date) -> str:
    return cis_timestamp(datetime.combine(day, time(23, 59, 59), tzinfo=_zone()))


def current_month() -> tuple[date, date]:
    """First and last day of the current month in Albania."""
    current = today()
    last = calendar.monthrange(current.year, current.month)[1]
    return current.replace(day=1), current.replace(day=last)


def split_range(start: date, end: date) -> tuple[tuple[date, date], tuple[date, date]]:
    """Split an inclusive day range into two non-overlapping halves."""
    middle = start + timedelta(days=(end - start).days // 2)
    return (start, middle), (middle + timedelta(days=1), end)
