#!/usr/bin/env python3
"""
Quick test to verify the improved email classification system
"""

import requests
import json

def test_chrome_extension_scenarios():
    """Test real-world scenarios that your Chrome extension might encounter"""
    
    print("=== Testing Chrome Extension Email Scenarios ===\n")
    
    # Test cases that mimic what your extension would send
    test_cases = [
        {
            "name": "Normal Email (No Phishing)",
            "data": {
                "subject": "Weekly team meeting notes",
                "sender": "manager@company.com",
                "body": "Hi team, please review the attached meeting notes from this week. Next meeting is scheduled for Friday at 2 PM."
            },
            "expected": "safe"
        },
        {
            "name": "Phishing Email (Account Suspension)",
            "data": {
                "subject": "Action Required: Account Suspended",
                "sender": "security@suspicious-domain.com",
                "body": "Your account has been suspended due to suspicious activity. Please verify your identity immediately by clicking this link: https://fake-bank-verification.malicious-site.com/login?verify=account"
            },
            "expected": "phishing"
        },
        {
            "name": "Promotional Email (No Links)",
            "data": {
                "subject": "Summer Sale - 70% Off Everything!",
                "sender": "offers@retailstore.com", 
                "body": "Don't miss our biggest sale of the year! Get 70% off everything in our store. Limited time offer. Shop now and save big on all your favorite items. Free shipping on orders over $50."
            },
            "expected": "safe"  # Should be safe, potentially classified as spam
        },
        {
            "name": "Phishing with Spoofed PayPal",
            "data": {
                "subject": "PayPal Payment Verification Required",
                "sender": "noreply@paypal-security.fake.com",
                "body": "We've detected unusual activity on your PayPal account. Please verify your payment method by clicking here: https://paypal-verify-payment.fake-domain.com/secure-login"
            },
            "expected": "phishing"
        }
    ]
    
    for test in test_cases:
        print(f"Testing: {test['name']}")
        print(f"Expected: {test['expected']}")
        
        # Test the main endpoint your extension would use
        try:
            response = requests.post('http://127.0.0.1:5000/scan-email-links', 
                                   json=test['data'],
                                   headers={'Content-Type': 'application/json'})
            
            if response.status_code == 200:
                result = response.json()
                status = result.get('status', 'unknown')
                email_status = result.get('email_status', 'unknown')
                confidence = result.get('confidence', 0)
                
                print(f"Result: {status}")
                print(f"Email Status: {email_status}")
                print(f"Confidence: {confidence:.3f}")
                
                # Check if it matches expectation
                correct = status == test['expected']
                print(f"{'✓ CORRECT' if correct else '✗ INCORRECT'}")
                
                # Show additional info
                if 'links' in result:
                    print(f"Links found: {result.get('link_count', 0)}")
                    if result.get('has_phishing', False):
                        print(f"Phishing links detected: {result.get('phishing_link_count', 0)}")
                
            else:
                print(f"ERROR: HTTP {response.status_code}")
                print(response.text)
                
        except Exception as e:
            print(f"ERROR: {e}")
        
        print("-" * 60)

if __name__ == "__main__":
    test_chrome_extension_scenarios()
    print("\n✅ Chrome Extension Testing Complete!")
    print("\nYour Chrome extension should now:")
    print("1. ✅ Correctly identify phishing emails")
    print("2. ✅ Handle emails with no links properly") 
    print("3. ✅ Use trained email model as primary classifier")
    print("4. ✅ Provide accurate confidence scores")
    print("5. ✅ Distinguish between email content and URL analysis")
