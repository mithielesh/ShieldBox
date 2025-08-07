#!/usr/bin/env python3
"""
Test the specific fraud email that was misclassified as safe
"""

import requests
import json

# Test the specific fraud email that was detected as safe
FRAUD_EMAIL_TEST = {
    "subject": "🔥 EXCLUSIVE DEAL: ₹4999 Smartphone Just for You!",
    "sender": "deals@mobilecart-offers.com",
    "body": """Dear Customer,

You've been specially selected for our MobileCart Mega Offer. Enjoy premium smartphones at an unbeatable price of just ₹4999 (original ₹49,999)!

📦 Free express shipping
✅ Limited stock available
⚠️ Offer ends in 24 hours

To claim your smartphone, please login here:

👉 Login to Claim Offer

Hurry up! Once the stock is gone, the deal is off.

Thank you,
MobileCart Team"""
}

def test_specific_fraud_email():
    """Test the specific fraud email that was misclassified"""
    url = "http://localhost:5000/scan-email-links"
    
    print("=" * 60)
    print("TESTING SPECIFIC FRAUD EMAIL THAT WAS MISCLASSIFIED")
    print("=" * 60)
    print()
    
    print(f"Subject: {FRAUD_EMAIL_TEST['subject']}")
    print(f"Sender: {FRAUD_EMAIL_TEST['sender']}")
    print(f"Expected: fraud")
    print()
    print("Email Body:")
    print("-" * 30)
    print(FRAUD_EMAIL_TEST['body'])
    print("-" * 30)
    print()
    
    # Check what fraud keywords should be detected
    fraud_keywords = [
        'lottery', 'won', 'million', 'prize', 'wire transfer', 'processing fee',
        'double your money', 'guaranteed returns', 'investment opportunity',
        'western union', 'money transfer', 'prince', 'inheritance', 'stuck in',
        'need your help', 'legal fees', 'upfront', 'advance fee', 'beneficiary'
    ]
    
    # Additional fraud indicators that should be detected
    additional_fraud_indicators = [
        'exclusive deal', 'specially selected', 'mega offer', 'unbeatable price',
        'limited stock', 'offer ends', 'hurry up', 'claim', 'original price',
        'free shipping', 'too good to be true', 'discount', 'sale'
    ]
    
    text_to_check = (FRAUD_EMAIL_TEST['subject'] + " " + FRAUD_EMAIL_TEST['body']).lower()
    
    print("KEYWORD ANALYSIS:")
    print("Current fraud keywords found:")
    found_current = []
    for keyword in fraud_keywords:
        if keyword in text_to_check:
            found_current.append(keyword)
    print(f"  {found_current} (total: {len(found_current)})")
    
    print("Additional fraud indicators found:")
    found_additional = []
    for keyword in additional_fraud_indicators:
        if keyword in text_to_check:
            found_additional.append(keyword)
    print(f"  {found_additional} (total: {len(found_additional)})")
    print()
    
    # Prepare the request
    payload = {
        "subject": FRAUD_EMAIL_TEST["subject"],
        "sender": FRAUD_EMAIL_TEST["sender"], 
        "body": FRAUD_EMAIL_TEST["body"]
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            detected_status = result.get("status", "unknown")
            email_status = result.get("email_status", "unknown")
            confidence = result.get("confidence", 0.0)
            
            print("CURRENT SYSTEM RESPONSE:")
            print(f"API Response: {detected_status}")
            print(f"Email Status: {email_status}")
            print(f"Confidence: {confidence:.3f}")
            print()
            
            if detected_status == "fraud" or email_status == "fraud":
                print("✅ PASS - Correctly detected as fraud")
                return True
            else:
                print(f"❌ FAIL - Expected fraud, got {detected_status}/{email_status}")
                print()
                print("DIAGNOSIS:")
                print("This email contains clear fraud indicators:")
                print("- Unrealistic 90% discount (₹49,999 → ₹4999)")
                print("- Urgency tactics ('24 hours', 'limited stock')")
                print("- 'Specially selected' targeting")
                print("- Suspicious login request")
                print("- Too-good-to-be-true pricing")
                return False
        else:
            print(f"❌ FAIL - HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL - Request error: {e}")
        return False

if __name__ == "__main__":
    success = test_specific_fraud_email()
    if not success:
        print()
        print("RECOMMENDATION: Enhance fraud keyword detection with:")
        print("- Deal/discount terminology")
        print("- Urgency indicators") 
        print("- Price manipulation patterns")
        print("- Regional currency symbols")
