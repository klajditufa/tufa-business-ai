"""Measure units.

CIS stores each line's unit as free text, so the same unit arrives many ways:
"kg", "KG", "Kg.", "kilogram"; "Copë", "cope", "COPE", "pcs". ``unit`` maps
them to one code (UN/ECE Rec. 20, as used for e-invoices) and one label. The
list lives in units.json, which the web app uses too.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import NamedTuple

_LIST = json.loads((Path(__file__).resolve().parent / "units.json").read_text(encoding="utf-8"))


class Unit(NamedTuple):
    code: str  # "KGM"; empty when the text is not a known unit
    label: str  # "kg"; the original text when the unit is not known
    key: str  # grouping key: the code, or the folded text


def fold(text: str) -> str:
    """Lower case, without accents (ë → e, ç → c), spaces, dots and superscripts."""
    text = unicodedata.normalize("NFKD", text.replace("²", "2").replace("³", "3"))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[\s.]+", "", text.lower())


_ALIASES: dict[str, dict] = {}
for _entry in _LIST:
    for _alias in (_entry["code"], _entry["sq"], _entry["en"], *_entry["aliases"]):
        _ALIASES.setdefault(fold(_alias), _entry)


def unit(text: str) -> Unit:
    original = (text or "").strip()
    entry = _ALIASES.get(fold(original))
    if entry is None:
        return Unit("", original, fold(original))
    return Unit(entry["code"], entry["sq"], entry["code"])


def name_key(text: str) -> str:
    """Item names compared without case, accents or extra spaces ("Naftë  Dizel" = "nafte dizel")."""
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(char for char in text if not unicodedata.combining(char))
    return " ".join(text.lower().split())
