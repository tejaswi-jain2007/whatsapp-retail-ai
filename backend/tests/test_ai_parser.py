import pytest
from decimal import Decimal
from app.services.ai.parser import AIOrderParser, match_item_to_catalogue, normalize_unit
from app.models.entities import Product


def test_normalize_units():
    assert normalize_unit("kg") == "kg"
    assert normalize_unit("kilos") == "kg"
    assert normalize_unit("ltr") == "litre"
    assert normalize_unit("litre") == "litre"
    assert normalize_unit("pkt") == "packet"
    assert normalize_unit("packet") == "packet"
    assert normalize_unit("pcs") == "piece"


def test_ai_parser_hinglish_list():
    parser = AIOrderParser()
    message = "Bhaiya, 2 kg atta, 1 litre oil, 1 kg sugar aur 2 packet Maggi rakh dena"
    result = parser.parse_message(message)

    assert not result.requires_clarification
    assert len(result.items) == 4

    names = [i.product_name.lower() for i in result.items]
    assert any("atta" in n for n in names)
    assert any("oil" in n for n in names)
    assert any("sugar" in n for n in names)
    assert any("maggi" in n for n in names)

    atta_item = next(i for i in result.items if "atta" in i.product_name.lower())
    assert atta_item.quantity == Decimal("2")
    assert atta_item.unit == "kg"


def test_catalogue_matching():
    mock_product = Product(
        id="p1",
        store_id="s1",
        name="Aashirvaad Shudh Chakki Atta",
        brand="Aashirvaad",
        aliases=["atta", "aata", "gehun atta"],
        unit="kg",
        current_price=Decimal("45.00"),
    )

    parser = AIOrderParser()
    result = parser.parse_message("5 kg atta")
    item = result.items[0]

    matched, price = match_item_to_catalogue(item, [mock_product])
    assert matched is not None
    assert matched.id == "p1"
    assert price == Decimal("45.00")

