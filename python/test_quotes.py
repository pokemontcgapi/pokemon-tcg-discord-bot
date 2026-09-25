import json
from pathlib import Path
from typing import Any, cast

import pytest
from pokemontcgapi.types import CardPricesResponse, Price

from quotes import europe, footer, raw, title, united_states

HERE = Path(__file__).parent
# In the public repository the fixtures sit in ../testdata/fixtures; in the monorepo they are packages/fixtures.
CANDIDATES = [HERE.parent / "testdata" / "fixtures", HERE.parent.parent / "fixtures"]


def fixture(name: str) -> Any:
    for directory in CANDIDATES:
        path = directory / f"{name}.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))["body"]
    raise FileNotFoundError(f"fixture {name} not found in {CANDIDATES}")


@pytest.fixture
def prices() -> CardPricesResponse:
    return cast(CardPricesResponse, fixture("prices-card-withheld"))


def test_title_is_name_set_and_collector_number() -> None:
    card = cast(Any, {"name": "Charizard", "set_name": "Base", "number": "4"})
    assert title(card) == "Charizard · Base #4"


def test_europe_lists_the_cardmarket_rows_per_print_language(prices: CardPricesResponse) -> None:
    assert europe(raw(prices["data"]["quotes"])) == (
        "EN 599.90 EUR · asking · 2026-09-01\nCardmarket, lowest asking price per print language"
    )


def test_united_states_is_the_tcgplayer_row_with_its_provenance(prices: CardPricesResponse) -> None:
    assert united_states(raw(prices["data"]["quotes"])) == "510.00 USD · guide · 2026-07-30 · TCGplayer"


def test_graded_rows_never_reach_a_market_field(prices: CardPricesResponse) -> None:
    graded: Price = {
        **prices["data"]["quotes"][0],
        "source": "CARDMARKET",
        "grading": {"company": "PSA", "score": "10"},
        "amount": 9999,
    }
    assert europe(raw([graded])) == "no quote today"
    assert united_states(raw([{**graded, "source": "TCGPLAYER"}])) == "no quote today"


def test_footer_carries_the_index_with_its_date_or_says_there_is_none(prices: CardPricesResponse) -> None:
    assert footer(prices["data"]["index"]) == "Index 556.23 EUR · 2026-09-02"
    assert footer(None) == "No index for this card"
