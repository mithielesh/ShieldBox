#!/usr/bin/env python3
"""
Test suite for spam email detection in ShieldBox
Tests various types of spam emails to ensure proper classification
"""

import requests
import json

# Test spam emails covering different spam categories
SPAM_TEST_EMAILS = [
    {
        "name": "Marketing Spam",
        "subject": "URGENT: 50% OFF All Products - Limited Time Only!",
        "sender": "deals@megadeals-online.com",
        "body": """
FLASH SALE - 50% OFF EVERYTHING!!!

Hey there!

This is the BIGGEST SALE of the year! Don't miss out on these AMAZING deals:

🔥 Electronics - 50% OFF
🔥 Clothing - 50% OFF  
🔥 Home & Garden - 50% OFF
🔥 Beauty Products - 50% OFF

Click here to shop now: https://megadeals-online.com/flash-sale

But HURRY! This offer expires in 24 HOURS!!!

Limited quantities available. First come, first served!

Shop now or regret forever!

Unsubscribe: https://megadeals-online.com/unsubscribe
        """,
        "expected": "spam"
    },
    {
        "name": "Pharmaceutical Spam",
        "subject": "Cheap Generic Medications - No Prescription Required",
        "sender": "pharmacy@cheapmeds24.biz",
        "body": """
Get all your medications at WHOLESALE PRICES!

✓ Viagra - $1.99 per pill
✓ Cialis - $2.49 per pill  
✓ Pain medications - Starting at $0.99
✓ Weight loss pills - Special discount
✓ Anxiety medications - No questions asked

NO PRESCRIPTION REQUIRED!
DISCREET WORLDWIDE SHIPPING!
100% SATISFACTION GUARANTEED!

Order now: https://cheapmeds24.biz/order

Fast delivery in 3-5 days. All medications FDA approved (generic versions).

Don't wait - supplies are limited!
        """,
        "expected": "spam"
    },
    {
        "name": "Get Rich Quick Spam",
        "subject": "Make $5,000 Per Week Working From Home - No Experience Needed!",
        "sender": "opportunity@workfromhome-profits.net",
        "body": """
AMAZING WORK FROM HOME OPPORTUNITY!

Are you tired of your 9-5 job? Want to make REAL MONEY from home?

I'll show you EXACTLY how I make $5,000+ per week working just 2 hours a day!

✅ No experience required
✅ No special skills needed
✅ Work from anywhere
✅ Guaranteed income
✅ Start making money TODAY!

This SECRET method has helped thousands of people quit their jobs and achieve financial freedom!

Click here to get started: https://workfromhome-profits.net/secret-method

Limited spots available! Don't miss this life-changing opportunity!

Join now and receive a FREE bonus worth $297!
        """,
        "expected": "spam"
    },
    {
        "name": "Weight Loss Spam",
        "subject": "Lose 30 Pounds in 30 Days - Doctors Hate This Simple Trick!",
        "sender": "weightloss@miracle-diet.org",
        "body": """
LOSE WEIGHT WITHOUT DIET OR EXERCISE!

This WEIRD trick melts belly fat overnight!

Local mom discovers ancient weight loss secret that SHOCKED doctors!

✓ Lose 30 pounds in 30 days
✓ No diet required
✓ No exercise needed  
✓ No pills or supplements
✓ 100% natural method

DOCTORS DON'T WANT YOU TO KNOW THIS SECRET!

See the incredible before/after photos: https://miracle-diet.org/secret

This method is so effective, the weight loss industry is trying to BAN IT!

Get the secret before it's too late!

WARNING: Only works for the next 24 hours!
        """,
        "expected": "spam"
    },
    {
        "name": "Adult Content Spam",
        "subject": "Hot Singles in Your Area Want to Meet You Tonight!",
        "sender": "hookups@adult-dating-site.xxx",
        "body": """
🔥 HOT SINGLES IN YOUR AREA 🔥

Lonely tonight? Don't be!

Hundreds of beautiful women in your area are looking for fun right NOW!

✓ Meet tonight
✓ No strings attached
✓ 100% discreet
✓ All verified profiles
✓ Free to browse

See who's online now: https://adult-dating-site.xxx/browse

Special offer: FREE premium membership for new users!

Don't spend another night alone! Your perfect match is waiting!

Age verification required. Must be 18+.
        """,
        "expected": "spam"
    },
    {
        "name": "Casino/Gambling Spam", 
        "subject": "🎰 $1000 FREE Casino Bonus - No Deposit Required!",
        "sender": "casino@lucky-wins-casino.com",
        "body": """
🎰 WELCOME TO LUCKY WINS CASINO! 🎰

Get $1000 FREE just for signing up!

🎲 Slots 
🎲 Blackjack
🎲 Poker
🎲 Roulette  
🎲 Live Dealers

NO DEPOSIT REQUIRED!
START PLAYING FOR FREE!

✓ Instant withdrawal
✓ 24/7 customer support
✓ Mobile friendly
✓ Licensed and regulated

Claim your bonus: https://lucky-wins-casino.com/free-bonus

Winners last week:
- John from Texas won $15,000!
- Sarah from California won $8,500!
- Mike from New York won $12,000!

You could be next! Sign up now!

Must be 21+. Gambling problem? Call 1-800-GAMBLER.
        """,
        "expected": "spam"
    }
]

def test_spam_detection():
    """Test spam detection with various spam email types"""
    url = "http://localhost:5000/scan-email-links"
    
    print("=" * 60)
    print("SHIELDBOX SPAM DETECTION TEST")
    print("=" * 60)
    print()
    
    total_tests = len(SPAM_TEST_EMAILS)
    passed_tests = 0
    failed_tests = []
    
    for i, email in enumerate(SPAM_TEST_EMAILS, 1):
        print(f"Test {i}/{total_tests}: {email['name']}")
        print(f"Subject: {email['subject']}")
        print(f"Sender: {email['sender']}")
        print(f"Expected: {email['expected']}")
        
        # Prepare the request
        payload = {
            "subject": email["subject"],
            "sender": email["sender"], 
            "body": email["body"]
        }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                detected_status = result.get("status", "unknown")
                email_status = result.get("email_status", "unknown")
                confidence = result.get("confidence", 0.0)
                
                print(f"API Response: {detected_status}")
                print(f"Email Status: {email_status}")
                print(f"Confidence: {confidence:.3f}")
                
                # Check if detection matches expected result
                if detected_status == email["expected"] or email_status == email["expected"]:
                    print("✅ PASS - Correctly detected as spam")
                    passed_tests += 1
                else:
                    print(f"❌ FAIL - Expected {email['expected']}, got {detected_status}/{email_status}")
                    failed_tests.append({
                        "name": email["name"],
                        "expected": email["expected"],
                        "actual": detected_status,
                        "email_status": email_status,
                        "confidence": confidence
                    })
            else:
                print(f"❌ FAIL - HTTP {response.status_code}: {response.text}")
                failed_tests.append({
                    "name": email["name"],
                    "expected": email["expected"],
                    "actual": f"HTTP {response.status_code}",
                    "email_status": "error",
                    "confidence": 0.0
                })
                
        except requests.exceptions.RequestException as e:
            print(f"❌ FAIL - Request error: {e}")
            failed_tests.append({
                "name": email["name"],
                "expected": email["expected"],
                "actual": f"Request error: {e}",
                "email_status": "error", 
                "confidence": 0.0
            })
        
        print("-" * 40)
        print()
    
    # Summary
    print("=" * 60)
    print("SPAM DETECTION TEST SUMMARY")
    print("=" * 60)
    print(f"Total tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {len(failed_tests)}")
    print(f"Success rate: {(passed_tests/total_tests)*100:.1f}%")
    print()
    
    if failed_tests:
        print("FAILED TESTS:")
        print("-" * 40)
        for failure in failed_tests:
            print(f"❌ {failure['name']}")
            print(f"   Expected: {failure['expected']}")
            print(f"   Actual: {failure['actual']}")
            print(f"   Email Status: {failure['email_status']}")
            print(f"   Confidence: {failure['confidence']:.3f}")
            print()
    else:
        print("🎉 ALL SPAM DETECTION TESTS PASSED!")
        print()
    
    print("Test completed!")
    return passed_tests == total_tests

if __name__ == "__main__":
    test_spam_detection()
