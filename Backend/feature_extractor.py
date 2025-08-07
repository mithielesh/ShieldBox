# feature_extractor.py
import re
from urllib.parse import urlparse
import tldextract

def extract_features(url):
    try:
        # Ensure URL has a scheme and is string
        if url is None:
            url = ""
        
        if not isinstance(url, str):
            url = str(url)
            
        if not url.startswith('http'):
            url = 'http://' + url
            
        parsed = urlparse(url)
        ext = tldextract.extract(url)
        domain = ext.domain
        subdomain = ext.subdomain
        tld = ext.suffix
        
        # ENHANCED: More comprehensive phishing-specific features
        features = {
        # Basic URL properties
        "url_length": len(url),
        "domain_length": len(domain) if domain else 0,
        
        # Security indicators
        "has_ip": bool(re.search(r'\d+\.\d+\.\d+\.\d+', parsed.netloc)),
        "has_https": int(parsed.scheme == "https"),  # Convert to numeric for better ML training
        "has_http": int(parsed.scheme == "http"),    # Non-HTTPS sites are more likely to be phishing
        
        # Suspicious URL characteristics
        "num_dots": url.count('.'),
        "num_hyphens": url.count('-'),
        "num_underscores": url.count('_'),
        "num_digits": sum(c.isdigit() for c in url),
        "digit_ratio": sum(c.isdigit() for c in url) / len(url) if url else 0,
        "num_params": len(parsed.query.split('&')) if parsed.query else 0,
        "path_length": len(parsed.path),
        "param_length": len(parsed.query),
        
        # NEW: Advanced phishing indicators
        "url_entropy": len(set(url)) / len(url) if url else 0,  # Measure of character diversity
        "num_special_chars": sum(not c.isalnum() and not c.isspace() for c in url),
        "special_char_ratio": sum(not c.isalnum() and not c.isspace() for c in url) / len(url) if url else 0,
        
        # Known phishing indicators
        "has_at_symbol": int("@" in url),
        "has_double_slash_redirect": int("//" in parsed.path),
        "has_hex_chars": int(bool(re.search(r'%[0-9a-fA-F]{2}', url))),
        "has_data_uri": int("data:" in url.lower()),
        "has_javascript_uri": int("javascript:" in url.lower()),
        
        # NEW: Domain-specific features
        "domain_dash_count": domain.count('-') if domain else 0,
        "domain_digit_count": sum(c.isdigit() for c in domain) if domain else 0,
        "domain_digit_ratio": sum(c.isdigit() for c in domain) / len(domain) if domain and len(domain) > 0 else 0,
        
        # Subdomain and TLD features
        "has_subdomain": int(len(subdomain) > 0),
        "subdomain_length": len(subdomain),
        "num_subdomains": subdomain.count('.') + 1 if subdomain else 0,
        "tld_length": len(tld) if tld else 0,
        "uncommon_tld": int(tld not in ["com", "org", "net", "edu", "gov", "mil", "io", "co"]) if tld else 0,
        
        # NEW: Suspicious patterns
        "has_excessive_dots": int(url.count('.') > 5),
        "has_excessive_path_segments": int(len(parsed.path.split('/')) > 5) if parsed.path else 0,
        
        # Suspicious terms (greatly expanded)
        "has_suspicious_words": int(any(w in url.lower() for w in [
            "login", "verify", "secure", "bank", "account", "update", "confirm", 
            "paypal", "password", "billing", "signin", "banking", "authorize", "webscr",
            "ebay", "amazon", "apple", "microsoft", "netflix", "suspended", "unusual",
            "verify", "security", "alert", "limit", "warning", "access", "authenticate",
            "wallet", "bitcoin", "crypto", "recover", "unlock", "customer", "service",
            "support", "help", "helpdesk", "validation", "invalid", "expired", "admin",
            "reset", "fraud", "notification", "verify-account", "auth", "credential",
            "identity", "verification", "suspicious", "activity", "validate", "confirm-identity",
            "payment", "card", "credit", "debit", "chase", "citibank", "wellsfargo",
            "bankofamerica", "scotia", "tdbank", "capitalOne", "invoice", "tax", "refund"
        ])),
    }

        return list(features.values())
    except Exception as e:
        print(f"Error in extract_features: {str(e)} for URL: {url[:50]}")
        # Return a safe default feature vector with correct number of features
        return [0] * 36  # Matches the number of features in our dictionary
