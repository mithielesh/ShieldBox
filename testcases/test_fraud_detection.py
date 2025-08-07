#!/usr/bin/env python3

import requests
import json

def test_fraud_detection():
    print("🔍 Testing Fraud Email Detection")
    print("=" * 50)
    
    # Test cases specifically for fraud detection
    fraud_test_cases = [
        {
            "name": "Financial Fraud - Lottery Scam",
            "subject": "Congratulations! You've won $1,000,000",
            "sender": "winner@internationallottery.com",
            "body": "You have won $1,000,000 in our international lottery! To claim your prize, please send $500 processing fee to our account. Wire transfer details: Account 12345-67890. Act fast, this offer expires soon!",
            "expected": "fraud"
        },
        {
            "name": "Financial Fraud - Investment Scam",
            "subject": "Double your money in 30 days guaranteed!",
            "sender": "profits@quickinvest.biz",
            "body": "Exclusive investment opportunity! Send us $1000 and we guarantee to double it in 30 days. Limited time offer with 100% guaranteed returns. Wire money to account: 9876543210.",
            "expected": "fraud"
        },
        {
            "name": "Romance Scam",
            "subject": "My heart belongs to you",
            "sender": "love@dating.net",
            "body": "My dear, I need your help. I am stuck in Nigeria and need $2000 to come visit you. Please send money via Western Union. I promise to pay you back with interest when we meet.",
            "expected": "fraud"
        },
        {
            "name": "Advance Fee Fraud",
            "subject": "Urgent: Help needed to transfer millions",
            "sender": "prince@nigeria.gov",
            "body": "I am a prince with $50 million trapped in a bank account. I need your help to transfer this money. You will receive 20% ($10 million) for your assistance. Please send $5000 upfront for legal fees.",
            "expected": "fraud"
        },
        {
            "name": "Regular Phishing (should stay phishing)",
            "subject": "Your PayPal account is suspended",
            "sender": "security@paypal-security.com",
            "body": "Your account has been suspended due to suspicious activity. Click here to verify: https://paypal-verify.fake.com/login",
            "expected": "phishing"
        }
    ]
    
    results = []
    
    for i, test in enumerate(fraud_test_cases, 1):
        print(f"\nTest {i}: {test['name']}")
        print(f"Expected: {test['expected']}")
        
        try:
            response = requests.post("http://127.0.0.1:5000/scan-email-links", 
                                   json={
                                       "subject": test['subject'],
                                       "sender": test['sender'],
                                       "body": test['body']
                                   },
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                print(f"Backend Status: {data.get('status')}")
                print(f"Email Status: {data.get('email_status')}")
                print(f"Email Category: {data.get('email_category')}")
                print(f"Confidence: {data.get('confidence', 0):.3f}")
                
                # Check if it correctly identified fraud
                actual_status = data.get('status', 'unknown')
                is_correct = actual_status == test['expected']
                
                if test['expected'] == 'fraud' and actual_status != 'fraud':
                    print(f"❌ FRAUD DETECTION FAILED - Got '{actual_status}' instead of 'fraud'")
                elif is_correct:
                    print(f"✅ CORRECT")
                else:
                    print(f"❌ INCORRECT - Expected {test['expected']}, got {actual_status}")
                
                results.append({
                    'test': test['name'],
                    'expected': test['expected'],
                    'actual': actual_status,
                    'email_category': data.get('email_category'),
                    'correct': is_correct,
                    'confidence': data.get('confidence', 0)
                })
                
        except Exception as e:
            print(f"❌ Error: {e}")
    
    # Summary focusing on fraud detection
    print(f"\n📊 FRAUD DETECTION ANALYSIS")
    print("=" * 50)
    
    fraud_tests = [r for r in results if r['expected'] == 'fraud']
    fraud_correct = [r for r in fraud_tests if r['correct']]
    
    print(f"Fraud Detection Rate: {len(fraud_correct)}/{len(fraud_tests)} ({len(fraud_correct)/len(fraud_tests)*100 if fraud_tests else 0:.1f}%)")
    
    print(f"\nDetailed Fraud Results:")
    for result in fraud_tests:
        status = "✅ PASS" if result['correct'] else "❌ FAIL"
        print(f"  {status}: {result['test']}")
        print(f"    Expected: fraud, Got: {result['actual']}")
        print(f"    Raw ML Category: {result['email_category']}")
        print(f"    Confidence: {result['confidence']:.3f}")
        print()
    
    # Check what's happening with fraud classification
    if len(fraud_correct) == 0:
        print("🚨 CRITICAL ISSUE: No fraud emails are being detected as fraud!")
        print("   Possible causes:")
        print("   1. Email model doesn't have 'fraud' category in training")
        print("   2. Confidence threshold too high for fraud")
        print("   3. Mapping logic doesn't handle fraud category")
        print("   4. All fraud emails classified as 'phishing' instead")

if __name__ == "__main__":
    test_fraud_detection()
