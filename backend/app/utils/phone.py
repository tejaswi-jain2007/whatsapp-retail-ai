import re


def normalize_phone_number(phone: str, default_country_code: str = "91") -> str:
    """
    Normalizes a phone number to standard E.164-like format:
    e.g. "+919876543210".
    Handles formats like:
    "9876543210" -> "+919876543210"
    "09876543210" -> "+919876543210"
    "+91 98765-43210" -> "+919876543210"
    "919876543210" -> "+919876543210"
    """
    if not phone:
        return ""

    # Strip all characters except digits and plus sign
    cleaned = re.sub(r"[^\d+]", "", phone.strip())

    if cleaned.startswith("+"):
        return cleaned

    # Leading zero in India: 09876543210 -> 9876543210
    if cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]

    # 10 digit Indian number without country code
    if len(cleaned) == 10:
        return f"+{default_country_code}{cleaned}"

    # 12 digit number starting with 91
    if len(cleaned) == 12 and cleaned.startswith("91"):
        return f"+{cleaned}"

    return f"+{cleaned}"
