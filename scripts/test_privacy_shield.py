import sys
sys.path.insert(0, 'backend')
from app.services.ai.parser import AIOrderParser
ai_parser = AIOrderParser()

test_cases = [
    "Bhai shaam ko ghar kab aaoge?",
    "Mummy kaisi hai photo bhej do",
    "OTP is 948291. Do not share with anyone",
    "Happy Birthday bhai party kab de raha hai?",
    "1 kg sugar",
    "bhaiya 2 kg atta aur 1 litre tel rakh dena",
    "2 packet maggi",
    "shakkar 1kg",
]

print("--- AI PRIVACY SHIELD TEST RESULTS ---")
for msg in test_cases:
    res = ai_parser.parse_message(msg)
    status = "🛒 ORDER PARSED" if res.is_shopping_order else "🛡️ PERSONAL IGNORED"
    items = [f"{i.quantity} {i.unit} {i.product_name}" for i in res.items]
    print(f"[{status}] \"{msg}\" -> Items: {items}")
