#!/usr/bin/env python3
"""
Test script to verify email classification is working properly
"""

import requests
import json

# Test cases
test_emails = [
    {
        "name": "Legitimate Email",
        "subject": "Meeting tomorrow at 3pm",
        "sender": "colleague@company.com",
        "body": "Hi, just confirming our meeting tomorrow at 3pm in conference room A. Please bring the quarterly reports. Thanks!"
    },
    {
        "name": "Phishing Email - Account Verification",
        "subject": "URGENT: Verify your account immediately",
        "sender": "security@paypal-verification.com",
        "body": "Your PayPal account has been suspended due to suspicious activity. Click here to verify your account immediately: https://paypal-verify-account.fake-domain.com/login"
    },
    {
        "name": "Phishing Email - Banking",
        "subject": "Security Alert: Account Locked",
        "sender": "security@bank-alerts.com", 
        "body": "Your bank account has been locked due to suspicious login attempts. Please confirm your identity by clicking this link: https://secure-bank-login.suspicious-site.com"
    },
    {
        "name": "Spam Email - Promotional",
        "subject": "SPECIAL OFFER: 50% OFF Everything!",
        "sender": "offers@deals.com",
        "body": "Limited time offer! Get 50% off everything in our store. Click here to shop now and save big! Unsubscribe at any time."
    }
]

def test_email_content_endpoint():
    """Test the new dedicated email content endpoint"""
    print("=== Testing Email Content Classification ===\n")
    
    for test_case in test_emails:
        print(f"Testing: {test_case['name']}")
        print(f"Subject: {test_case['subject']}")
        
        # Test the new email content endpoint
        try:
            response = requests.post('http://127.0.0.1:5000/scan-email-content', 
                                   json=test_case,
                                   headers={'Content-Type': 'application/json'})
            
            if response.status_code == 200:
                result = response.json()
                print(f"Status: {result['status']}")
                print(f"Category: {result['category']}")
                print(f"Confidence: {result['confidence']:.3f}")
                print(f"Analysis Method: {result['analysis_method']}")
                
                # Evaluation
                expected_status = "phishing" if "Phishing" in test_case['name'] else ("safe" if "Legitimate" in test_case['name'] else "varies")
                if expected_status != "varies":
                    correct = result['status'] == expected_status
                    print(f"Expected: {expected_status}, Got: {result['status']} - {'✓ CORRECT' if correct else '✗ INCORRECT'}")
                else:
                    print(f"Result: {result['status']} (evaluation varies)")
            else:
                print(f"ERROR: HTTP {response.status_code}")
                print(response.text)
                
        except Exception as e:
            print(f"ERROR: {e}")
        
        print("-" * 50)

def test_email_links_endpoint():
    """Test the original email links endpoint for comparison"""
    print("\n=== Testing Email Links Classification (Original) ===\n")
    
    for test_case in test_emails:
        print(f"Testing: {test_case['name']}")
        
        try:
            response = requests.post('http://127.0.0.1:5000/scan-email-links', 
                                   json=test_case,
                                   headers={'Content-Type': 'application/json'})
            
            if response.status_code == 200:
                result = response.json()
                print(f"Overall Status: {result['status']}")
                print(f"Email Status: {result['email_status']}")
                print(f"Email Category: {result['email_category']}")
                print(f"Confidence: {result['confidence']:.3f}")
                print(f"Has Phishing Links: {result['has_phishing']}")
                print(f"Link Count: {result['link_count']}")
            else:
                print(f"ERROR: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"ERROR: {e}")
        
        print("-" * 50)

if __name__ == "__main__":
    print("Testing Email Classification System\n")
    
    # Test both endpoints
    test_email_content_endpoint()
    test_email_links_endpoint()
    
    print("\n=== Test Complete ===")
