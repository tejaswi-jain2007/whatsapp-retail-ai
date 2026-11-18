import json
import re
from decimal import Decimal
from typing import List, Tuple, Optional
from app.config.settings import settings
from app.schemas.ai_parser import AIParsedItem, AIParsedResponse
from app.models.entities import Product

# Common unit aliases
UNIT_MAPPINGS = {
    "kg": "kg",
    "kilo": "kg",
    "kilos": "kg",
    "kilogram": "kg",
    "kilograms": "kg",
    "g": "g",
    "gm": "g",
    "gms": "g",
    "gram": "g",
    "grams": "g",
    "l": "litre",
    "ltr": "litre",
    "litre": "litre",
    "litres": "litre",
    "liter": "litre",
    "liters": "litre",
    "ml": "ml",
    "pkt": "packet",
    "pkts": "packet",
    "packet": "packet",
    "packets": "packet",
    "pack": "packet",
    "packs": "packet",
    "pc": "piece",
    "pcs": "piece",
    "piece": "piece",
    "pieces": "piece",
    "bottle": "bottle",
    "bottles": "bottle",
    "dozen": "dozen",
    "box": "box",
    "strip": "strip",
}

COMMON_GROCERY_KEYWORDS = {
    "atta", "aata", "flour", "gehun", "maida", "suji", "sooji", "besan",
    "oil", "tel", "mustard", "sunflower", "refined", "soyabean", "ghee", "dalda",
    "sugar", "shakkar", "chini", "cheeni", "jaggery", "gud",
    "rice", "chawal", "basmati",
    "dal", "daal", "toor", "moong", "chana", "urad", "masoor", "rajma", "cholley", "chhole",
    "salt", "namak",
    "tea", "chai", "coffee", "bru", "nescafe",
    "milk", "doodh", "amul", "curd", "dahi", "paneer", "butter", "cheese",
    "masala", "haldi", "mirch", "jeera", "dhaniya", "garam masala", "hing", "rai", "methi",
    "soap", "sabun", "lux", "dettol", "lifebuoy", "dove", "pears", "rin", "surf", "tide", "wheel", "ariel", "vim",
    "shampoo", "toothpaste", "colgate", "pepsodent", "sensodyne", "close up", "brush",
    "biscuit", "parle", "good day", "marie", "monaco", "oreo", "bourbon",
    "maggi", "noodles", "yippee", "pasta", "sauce", "ketchup",
    "bread", "rusk", "toast", "namkeen", "bhujia", "lays", "chips", "kurkure",
    "poha", "murmura", "cornflakes", "oats",
    "harpic", "lizol", "hit", "agarbatti", "machis", "candle", "dhoop",
}

CASUAL_NON_RETAIL_WORDS = {
    "kaise", "kaisa", "kaisi", "kya", "kab", "kaha", "kidhar", "kyu", "kyun",
    "ghar", "aao", "aaoge", "aana", "milte", "hain", "hai", "ho", "tha", "thi",
    "call", "phone", "uthana", "uthao", "bhai", "bro", "dost", "mummy", "papa",
    "bhaiya", "bhabhi", "didi", "beta", "photo", "photos", "video", "otp",
    "happy", "birthday", "congrats", "good", "morning", "night", "shadi", "karein",
}


def normalize_unit(unit_str: Optional[str]) -> str:
    if not unit_str:
        return "packet"
    clean = unit_str.lower().strip()
    return UNIT_MAPPINGS.get(clean, clean)


class AIOrderParser:
    """
    Parses unstructured WhatsApp shopping lists into structured items.
    Uses Google Gemini API when configured, or a sophisticated NLP parser
    capable of parsing mixed Hinglish/English shopping lists.
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL_NAME

    def parse_message(self, message: str) -> AIParsedResponse:
        clean_text = message.strip()
        if not clean_text:
            return AIParsedResponse(items=[], requires_clarification=True, clarification_reason="Empty message")

        # Try Gemini API if API key is provided
        if self.api_key and self.api_key != "your_google_gemini_api_key":
            try:
                gemini_result = self._parse_with_gemini(clean_text)
                if gemini_result and gemini_result.items:
                    return gemini_result
            except Exception as e:
                # Log and fallback to local NLP
                pass

        # Fallback rule-based NLP parser
        return self._parse_with_local_nlp(clean_text)

    def _parse_with_gemini(self, text: str) -> Optional[AIParsedResponse]:
        import google.generativeai as genai

        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model_name)

        prompt = f"""
You are an expert AI parser for Indian retail/Kirana store shopping lists sent via WhatsApp.
Messages are often in casual English, Hindi, or Hinglish (e.g. "Bhaiya 2 kg atta, 1 litre oil, 1 kg sugar aur 2 packet maggi bhej do").

Extract all products, their quantities, units, brands, and variants.
Return ONLY valid JSON with this exact schema:
{{
  "items": [
    {{
      "product_name": "string (cleaned product name)",
      "brand": "string or null",
      "variant": "string or null",
      "quantity": number,
      "unit": "string (e.g. kg, g, litre, ml, packet, piece)"
    }}
  ],
  "requires_clarification": boolean,
  "clarification_reason": "string or null"
}}

Customer WhatsApp Message:
\"\"\"{text}\"\"\"
"""
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        data = json.loads(response.text)
        return AIParsedResponse(**data)

    def _parse_with_local_nlp(self, text: str) -> AIParsedResponse:
        """
        Extracts items from shopping messages using pattern matching & keyword segmentation.
        Handles sentences like:
        "Bhaiya, 2 kg atta, 1 litre oil, 1 kg sugar aur 2 packet Maggi rakh dena"
        """
        # Remove conversational filler words
        clean = text
        fillers = [
            r"bhaiya", r"namaste", r"hello", r"hi", r"please", r"rakh\s+dena",
            r"bhej\s+dena", r"pack\s+kar\s+do", r"chahiye", r"dena", r"urgent"
        ]
        for f in fillers:
            clean = re.sub(rf"\b{f}\b", "", clean, flags=re.IGNORECASE)

        # Split on commas, newlines, "aur", "and", "+"
        delimiters = r"[\n,;+]|\baur\b|\band\b"
        segments = [s.strip() for s in re.split(delimiters, clean) if s.strip()]

        items: List[AIParsedItem] = []
        for segment in segments:
            item = self._parse_single_segment(segment)
            if item:
                items.append(item)

        if not items:
            return AIParsedResponse(
                is_shopping_order=False,
                items=[],
                requires_clarification=False,
                clarification_reason="No grocery items detected."
            )

        return AIParsedResponse(is_shopping_order=True, items=items, requires_clarification=False)

    def _parse_single_segment(self, segment: str) -> Optional[AIParsedItem]:
        seg_lower = segment.strip().lower()

        # Reject pure conversational / casual sentences
        tokens = [t for t in re.split(r"\W+", seg_lower) if t]
        if tokens and all(t in CASUAL_NON_RETAIL_WORDS for t in tokens):
            return None

        # Regex to find: (Quantity) (Unit)? (Product Name)
        pattern1 = r"^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]+)?\s+(.+)$"
        match1 = re.match(pattern1, segment.strip())

        if match1:
            qty_str, unit_candidate, name_candidate = match1.groups()
            name_clean = name_candidate.strip().lower()
            if name_clean in CASUAL_NON_RETAIL_WORDS:
                return None

            qty = Decimal(qty_str)

            # Check if unit_candidate is indeed a known unit
            if unit_candidate and unit_candidate.lower() in UNIT_MAPPINGS:
                unit = normalize_unit(unit_candidate)
                product_name = name_candidate.strip()
            elif unit_candidate:
                # unit_candidate might be part of the product name (e.g., "2 fortune oil")
                unit = "packet"
                product_name = f"{unit_candidate} {name_candidate}".strip()
            else:
                unit = "packet"
                product_name = name_candidate.strip()

            return AIParsedItem(
                product_name=product_name.title(),
                quantity=qty,
                unit=unit
            )

        # Pattern 2: "atta 2 kg" or "milk 2ltr"
        pattern2 = r"^(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]+)?$"
        match2 = re.match(pattern2, segment.strip())
        if match2:
            name_candidate, qty_str, unit_candidate = match2.groups()
            name_clean = name_candidate.strip().lower()
            if name_clean in CASUAL_NON_RETAIL_WORDS:
                return None

            qty = Decimal(qty_str)
            unit = normalize_unit(unit_candidate) if unit_candidate else "packet"
            return AIParsedItem(
                product_name=name_candidate.strip().title(),
                quantity=qty,
                unit=unit
            )

        # If it's a word without quantity (e.g. "maggi", "sugar", "atta"):
        # ONLY accept if it contains a known grocery item keyword!
        for kw in COMMON_GROCERY_KEYWORDS:
            if kw in seg_lower:
                return AIParsedItem(
                    product_name=segment.strip().title(),
                    quantity=Decimal("1.0"),
                    unit="packet"
                )

        return None


def match_item_to_catalogue(
    parsed_item: AIParsedItem, catalogue: List[Product]
) -> Tuple[Optional[Product], Decimal]:
    """
    Matches parsed item against store catalogue by checking:
    1. Exact name match
    2. Aliases match
    3. Substring match
    Returns (matched_product, unit_price)
    """
    target = parsed_item.product_name.lower().strip()

    # 1. Exact match
    for prod in catalogue:
        if prod.name.lower().strip() == target:
            return prod, prod.current_price

    # 2. Aliases match
    for prod in catalogue:
        if prod.aliases and isinstance(prod.aliases, list):
            for alias in prod.aliases:
                if alias.lower().strip() in target or target in alias.lower().strip():
                    return prod, prod.current_price

    # 3. Substring / Token match
    target_words = set(re.findall(r"\w+", target))
    best_match = None
    best_overlap = 0

    for prod in catalogue:
        prod_words = set(re.findall(r"\w+", prod.name.lower()))
        overlap = len(target_words.intersection(prod_words))
        if overlap > best_overlap:
            best_overlap = overlap
            best_match = prod

    if best_match and best_overlap > 0:
        return best_match, best_match.current_price

    return None, Decimal("0.00")

