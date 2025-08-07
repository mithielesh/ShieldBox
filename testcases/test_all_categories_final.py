#!/usr/bin/env python3
"""
Final comprehensive test for all ShieldBox email classification categories:
spam, fraud, phishing, safe, malware
Tests recent fixes and ensures all categories work correctly.
"""

import requests
import json

# Test server URL
BASE_URL = "http://localhost:5000"

def test_email_classification(subject, sender, body, expected_category, test_name):
    """Test email classification with detailed output"""
    
    print(f"\nTest: {test_name}")
    print(f"Subject: {subject}")
    print(f"Sender: {sender}")
    print(f"Expected: {expected_category}")
    
    # Prepare test data
    email_data = {
        "subject": subject,
        "sender": sender,
        "body": body,
        "links": []
    }
    
    try:
        # Send request to API
        response = requests.post(f"{BASE_URL}/scan-email-links", 
                               json=email_data, 
                               headers={'Content-Type': 'application/json'})
        
        if response.status_code == 200:
            result = response.json()
            email_status = result.get('email_status', 'unknown')
            confidence = result.get('confidence', 0)
            
            print(f"API Response: {email_status}")
            print(f"Confidence: {confidence:.3f}")
            
            # Check if classification is correct
            if email_status == expected_category:
                print("✅ PASS - Correctly classified")
                return True
            else:
                print(f"❌ FAIL - Expected {expected_category}, got {email_status}")
                return False
        else:
            print(f"❌ FAIL - API Error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL - Exception: {str(e)}")
        return False

def main():
    print("=" * 70)
    print("FINAL COMPREHENSIVE SHIELDBOX EMAIL CLASSIFICATION TEST")
    print("Testing all 5 categories: spam, fraud, phishing, safe, malware")
    print("=" * 70)
    
    tests = []
    
    # FRAUD TESTS - E-commerce
    tests.append({
        "subject": "🔥 EXCLUSIVE DEAL: ₹4999 Smartphone Just for You!",
        "sender": "deals@mobilecart-offers.com",
        "body": """Dear Specially Selected Customer,
        
You've been chosen for our MEGA OFFER! Get the latest smartphone for just ₹4999 (Original Price: ₹29,999).

✨ Unbeatable Price - Limited Stock Available
⚡ Offer Ends Tonight - Hurry Up!
🚚 Free Shipping to Your Doorstep

CLAIM NOW before this exclusive deal expires!
Visit: www.mobilecart-offers.com/deal""",
        "expected": "fraud",
        "name": "E-commerce Fraud (Smartphone Deal)"
    })
    
    # FRAUD TESTS - Donation
    tests.append({
        "subject": "🙏 URGENT: Sponsor a Child, Save a Life",
        "sender": "blesshearts.foundation@humanity-mail.org",
        "body": """Dear Kind-Hearted Donor,

I write to you with a heavy heart and desperate hope on behalf of the Blessing Hearts Orphanage & Old Age Home.

Our shelter was recently destroyed in floods. These innocent lives now live in tents, starving and cold, with no access to food or medical help.

💔 Time is running out. Every hour counts. One child already passed away last week due to untreated infection.

Please donate now to save a life:
❤️ Donate Now – Save a Life

With prayers and hope,
Sister Mary Elizabeth""",
        "expected": "fraud",
        "name": "Donation Fraud (Charity Scam)"
    })
    
    # SPAM TEST
    tests.append({
        "subject": "Make Money Online - Work From Home",
        "sender": "workfromhome@income-generator.com",
        "body": """Make $5000 per month working from home!

No experience required. Start earning immediately.
Join thousands of satisfied customers.

Click here to start making money today!
Unsubscribe: earnings@income-generator.com""",
        "expected": "spam",
        "name": "Spam (Work from Home)"
    })
    
    # PHISHING TEST
    tests.append({
        "subject": "Urgent: Your Account Will Be Suspended",
        "sender": "security@bankofindia-secure.com",
        "body": """Dear Customer,

Your account has been flagged for suspicious activity and will be suspended within 24 hours.

To prevent suspension, please verify your credentials immediately:
https://bankofindia-verify.security-check.com/login

Failure to verify will result in permanent account closure.

Bank of India Security Team""",
        "expected": "phishing",
        "name": "Phishing (Bank Account)"
    })
    
    # MALWARE TEST
    tests.append({
        "subject": "Software Update Required",
        "sender": "updates@system-security.org",
        "body": """Critical Windows Security Update Available

Your system is vulnerable to recent security threats. Download the mandatory security patch immediately.

Download: windows-security-update.exe
File size: 2.4MB

Install within 24 hours to protect your computer.

Microsoft Security Team""",
        "expected": "malware",
        "name": "Malware (Fake Security Update)"
    })
    
    # SAFE TEST
    tests.append({
        "subject": "Weekend Sale: 20% Off All Items",
        "sender": "sales@amazon.com",
        "body": """Hello,

Enjoy 20% off all items this weekend only!

Shop our latest collection of electronics, books, and home goods.
Valid until Sunday midnight.

Happy shopping!
Amazon Team

Unsubscribe: amazon.com/unsubscribe""",
        "expected": "safe",
        "name": "Safe (Legitimate Sale)"
    })
    
    # Run all tests
    passed = 0
    total = len(tests)
    
    for test in tests:
        result = test_email_classification(
            test["subject"], 
            test["sender"], 
            test["body"], 
            test["expected"], 
            test["name"]
        )
        if result:
            passed += 1
        print("-" * 50)
    
    # Final summary
    print("\n" + "=" * 70)
    print("FINAL TEST SUMMARY")
    print("=" * 70)
    print(f"Total tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ ShieldBox email classification is working perfectly across all categories:")
        print("   • FRAUD: E-commerce scams and donation fraud ✓")
        print("   • SPAM: Work from home schemes ✓") 
        print("   • PHISHING: Account verification scams ✓")
        print("   • MALWARE: Fake software updates ✓")
        print("   • SAFE: Legitimate business emails ✓")
    else:
        print(f"\n❌ {total - passed} test(s) failed. Please review the classification logic.")
    
    print("\nTest completed!")

if __name__ == "__main__":
    main()
