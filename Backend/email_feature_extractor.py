
def extract_email_features(email_data):
    """
    Extract features from email content for classification.
    Args:
        email_data: Dictionary with subject, sender, body, etc.
    Returns:
        String containing preprocessed email text
    """
    import re
    
    # Combine subject and body if available
    text = ""
    
    if 'subject' in email_data and email_data['subject']:
        text += email_data['subject'] + " "
    
    if 'body' in email_data and email_data['body']:
        text += email_data['body']
    
    # If text is empty or None, return empty string
    if not text:
        return ""
    
    # Normalize text
    text = text.lower()
    
    # Remove URLs - we'll handle them separately
    url_regex = r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+' 
    text = re.sub(url_regex, " URL ", text)
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def get_email_risk_score(email_data):
    """
    Calculate a risk score for the email based on content analysis.
    Args:
        email_data: Dictionary with subject, sender, body, etc.
    Returns:
        Float between 0.0 (safe) and 1.0 (high risk)
    """
    import re
    
    # Get the text content
    subject = email_data.get('subject', '').lower()
    body = email_data.get('body', '').lower()
    sender = email_data.get('sender', '').lower()
    
    risk_score = 0.0
    
    # High-risk keywords (0.3 points each)
    high_risk_keywords = [
        'urgent', 'immediate', 'verify', 'confirm', 'suspend', 'security alert',
        'account locked', 'verify account', 'click here', 'act now', 'limited time'
    ]
    
    for keyword in high_risk_keywords:
        if keyword in subject or keyword in body:
            risk_score += 0.3
    
    # Medium-risk keywords (0.2 points each)  
    medium_risk_keywords = [
        'password', 'login', 'bank', 'paypal', 'amazon', 'apple', 'microsoft',
        'update', 'renewal', 'expired', 'billing', 'payment'
    ]
    
    for keyword in medium_risk_keywords:
        if keyword in subject or keyword in body:
            risk_score += 0.2
    
    # Suspicious patterns (0.25 points each)
    suspicious_patterns = [
        r'click\s+here',  # "click here" phrases
        r'verify\s+your\s+account',  # account verification requests
        r'suspended?\s+(account|access)',  # account suspension
        r'expires?\s+(today|tomorrow|soon)',  # urgency about expiration
        r'confirm\s+your\s+(identity|details)',  # identity confirmation
        r'update\s+your\s+(payment|billing)',  # payment updates
    ]
    
    for pattern in suspicious_patterns:
        if re.search(pattern, subject + ' ' + body):
            risk_score += 0.25
    
    # Check sender domain reputation (basic check)
    if sender:
        # Suspicious if sender doesn't match claimed organization
        claimed_orgs = ['paypal', 'amazon', 'apple', 'microsoft', 'google', 'bank']
        for org in claimed_orgs:
            if org in body and org not in sender:
                risk_score += 0.4  # High penalty for domain mismatch
    
    # URL analysis
    urls = re.findall(r'https?://[^\s]+', body)
    if urls:
        # Check for suspicious URL characteristics
        for url in urls:
            url_lower = url.lower()
            # Shortened URLs
            if any(short in url_lower for short in ['bit.ly', 'tinyurl', 'goo.gl', 't.co']):
                risk_score += 0.3
            # IP addresses instead of domains
            if re.search(r'\d+\.\d+\.\d+\.\d+', url):
                risk_score += 0.4
            # Suspicious keywords in URL
            if any(keyword in url_lower for keyword in ['verify', 'secure', 'login', 'account']):
                risk_score += 0.2
    
    # Check for promotional/spam indicators (these are different from phishing)
    promotional_keywords = [
        'special offer', 'limited time', 'discount', 'sale', 'free', 'deal',
        'buy now', 'shop now', 'save', 'offer expires', 'unsubscribe'
    ]
    
    promotional_count = 0
    for keyword in promotional_keywords:
        if keyword in subject or keyword in body:
            promotional_count += 1
    
    # If we have many promotional indicators but few security risks, it's likely spam
    if promotional_count >= 3 and risk_score < 0.5:
        # This is likely promotional spam, not phishing
        # Return a moderate score (0.4-0.6 range) to indicate spam
        return min(0.6, 0.4 + (promotional_count * 0.05))
    
    # Cap the risk score at 1.0
    return min(risk_score, 1.0)
