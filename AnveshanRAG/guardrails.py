# guardrails.py
from flashtext import KeywordProcessor

def check_policy(query: str) -> bool:
    """
    Scans the query for prompt injections or banned topics.
    Returns True if the query is safe, False if it violates policy.
    """
    keyword_processor = KeywordProcessor(case_sensitive=False)
    
    # List of blocked keywords or injection patterns
    restricted_keywords = [
        "ignore previous instructions",
        "system prompt",
        "bypass",
        "drop tables",
        "unrestricted",
        "jailbreak"
    ]
    
    keyword_processor.add_keywords_from_list(restricted_keywords)
    
    # Extract keywords present in the query
    found_keywords = keyword_processor.extract_keywords(query)
    
    if found_keywords:
        return False  # Policy violated
    return True  # Query safe