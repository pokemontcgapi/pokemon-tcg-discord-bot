"""The reply contract, shared by every bot in this repository.

The TypeScript and Go versions print byte-identical strings from the same fixtures, and the tests in
each language assert it. Change one, change all three.
"""

from __future__ import annotations

from collections.abc import Sequence

from pokemontcgapi.types import Card, Price, PriceIndex

# One Cardmarket row per print language: an English copy and a French copy of the same card are two
# listings, not one price. The trial plan serves the English row only and says so in ``meta.withheld``.
LOCALES = ["en", "de", "fr", "es", "it", "pt", "ja", "zh", "ko"]

NO_QUOTE = "no quote today"


def title(card: Card) -> str:
    return f"{card['name']} · {card['set_name']} #{card['number']}"


def raw(quotes: Sequence[Price]) -> list[Price]:
    """Raw copies only: a graded row is a different market, and on the API a different plan."""
    return [q for q in quotes if q["grading"] is None]


def _locale_rank(q: Price) -> int:
    locale = q["locale"] or ""
    return LOCALES.index(locale) if locale in LOCALES else -1


def _newest(rows: Sequence[Price]) -> Price | None:
    """The most recent row: a source can hold a July row next to a September one for the same card."""
    best: Price | None = None
    for q in rows:
        if best is None or q["as_of"] > best["as_of"]:
            best = q
    return best


def europe(quotes: Sequence[Price]) -> str:
    low = [q for q in raw(quotes) if q["source"] == "CARDMARKET" and q["variant"] == "LOW"]
    per_locale = [_newest([q for q in low if q["locale"] == loc]) for loc in dict.fromkeys(q["locale"] for q in low)]
    rows = sorted((q for q in per_locale if q is not None), key=_locale_rank)
    if not rows:
        return NO_QUOTE
    lines = [
        f"{(q['locale'] or '??').upper()} {q['amount']:.2f} {q['currency']} · {q['basis'].lower()} · {q['as_of']}"
        for q in rows
    ]
    return "\n".join(lines) + "\nCardmarket, lowest asking price per print language"


def united_states(quotes: Sequence[Price]) -> str:
    q = _newest([row for row in raw(quotes) if row["source"] == "TCGPLAYER" and row["variant"] == "LOW"])
    if q is None:
        return NO_QUOTE
    return f"{q['amount']:.2f} {q['currency']} · {q['basis'].lower()} · {q['as_of']} · {q['provenance']}"


def footer(index: PriceIndex | None) -> str:
    return f"Index {index['eur']:.2f} EUR · {index['as_of']}" if index else "No index for this card"


def art(card: Card) -> str | None:
    images = card.get("images") or []
    image = next((i for i in images if i["size"] == "LARGE"), images[0] if images else None)
    return image["url"] if image else None
