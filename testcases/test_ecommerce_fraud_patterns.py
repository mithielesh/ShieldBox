#!/usr/bin/env python3
"""
Comprehensive test for e-commerce fraud detection
Tests various patterns of deal/discount fraud emails to ensure the system 
catches similar scams, not just the specific one reported
"""

import requests
import json

# Multiple variations of e-commerce/deal fraud emails
E_COMMERCE_FRAUD_EMAILS = [
    {
        "name": "Original Reported Fraud",
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
MobileCart Team""",
        "expected": "fraud"
    },
    {
        "name": "Laptop Deal Fraud",
        "subject": "FINAL HOURS: MacBook Pro for $299 Only!",
        "sender": "megadeals@techbargains.net",
        "body": """Congratulations!

You've been specially selected for our clearance sale! Get a brand new MacBook Pro for just $299 (original price $2,999)!

🎯 90% OFF Limited Time Offer
🚚 Free same-day delivery
⏰ Last chance - expires in 6 hours!

Claim your laptop now before it's too late:
👉 CLAIM NOW

This exclusive deal won't last long!

TechBargains Team""",
        "expected": "fraud"
    },
    {
        "name": "Electronics Flash Sale Fraud",
        "subject": "⚡ Flash Sale: iPhone 15 Pro for $99!",
        "sender": "flashsale@electronics-world.biz",
        "body": """URGENT: Flash Sale Alert!

Get the latest iPhone 15 Pro for an unbeatable price of just $99 (retail price $1,199)!

✨ Mega offer - 92% discount
📱 Limited stock - only 50 units left
⚡ Act now - offer expires soon!

To secure your iPhone, click here:
>> CLAIM YOUR PHONE <<

Hurry up! This deal will end in 3 hours!

Electronics World""",
        "expected": "fraud"
    },
    {
        "name": "Fashion Deal Fraud",
        "subject": "👗 Designer Dress Sale: $19 Only (Was $299)!",
        "sender": "fashion@designer-outlet.org",
        "body": """Exclusive Fashion Alert!

You're invited to our mega clearance sale! Designer dresses for just $19 each (original price $299)!

💃 Premium designer brands
🆓 Free shipping worldwide
⏰ Limited time offer - ends tonight!
🔥 Only few pieces left

Shop now before they're gone:
👉 Shop Designer Dresses

Don't miss this once-in-a-lifetime deal!

Designer Outlet Team""",
        "expected": "fraud"
    },
    {
        "name": "Fake Luxury Watch Fraud",
        "subject": "⌚ Rolex Watches: 95% OFF Today Only!",
        "sender": "luxury@premium-timepieces.com",
        "body": """Premium Luxury Alert!

Authentic Rolex watches at 95% off! Get genuine Rolex for just $199 (original $4,999)!

💎 Authentic luxury timepieces
🎁 Free gift wrapping
⚡ Today only - final hours!
🏃‍♂️ Hurry up - limited stock

Order your Rolex now:
>> GET YOUR ROLEX <<

This exclusive deal expires at midnight!

Premium Timepieces""",
        "expected": "fraud"
    },
    {
        "name": "Car Deal Fraud",
        "subject": "🚗 BMW for $2999 - Urgent Clearance Sale!",
        "sender": "cars@auto-liquidation.net",
        "body": """Urgent Auto Liquidation!

Brand new BMW available for just $2,999 (market value $45,999)!

🚗 Latest model BMW
📋 All papers included
⚡ Last chance - auction ends tonight
🔥 Mega discount - 93% off

Claim your BMW immediately:
👉 CLAIM BMW NOW

Act now before someone else takes it!

Auto Liquidation Center""",
        "expected": "fraud"
    },
    {
        "name": "Legitimate Sale Email (Control)",
        "subject": "Weekend Sale: 20% Off All Items",
        "sender": "sales@amazonsale.com",
        "body": """Hello,

Enjoy our weekend sale with 20% off all items sitewide.

• Valid for 3 days
• Use code WEEKEND20
• Standard shipping applies

Shop our collection:
Visit Amazon Sale

Thank you for shopping with us!

Amazon Sale Team""",
        "expected": "safe"
    }
]

def test_ecommerce_fraud_patterns():
    """Test comprehensive e-commerce fraud detection patterns"""
    url = "http://localhost:5000/scan-email-links"
    
    print("=" * 70)
    print("COMPREHENSIVE E-COMMERCE FRAUD DETECTION TEST")
    print("Testing various fraud patterns to ensure broad detection capability")
    print("=" * 70)
    print()
    
    total_tests = len(E_COMMERCE_FRAUD_EMAILS)
    passed_tests = 0
    failed_tests = []
    
    for i, email in enumerate(E_COMMERCE_FRAUD_EMAILS, 1):
        print(f"Test {i}/{total_tests}: {email['name']}")
        print(f"Subject: {email['subject']}")
        print(f"Sender: {email['sender']}")
        print(f"Expected: {email['expected']}")
        
        # Analyze fraud indicators in this email
        text = (email['subject'] + " " + email['body']).lower()
        
        # Check for fraud keywords
        fraud_keywords = [
            'exclusive deal', 'specially selected', 'mega offer', 'unbeatable price',
            'limited stock', 'offer ends', 'hurry up', 'claim now', 'original price',
            'free shipping', 'too good to be true', 'limited time offer', 'act now',
            'final hours', 'last chance', 'expires soon', 'flash sale', 'clearance sale'
        ]
        
        found_keywords = [kw for kw in fraud_keywords if kw in text]
        discount_patterns = []
        
        # Check for unrealistic discount patterns
        if any(x in text for x in ['90% off', '95% off', '92% off', '93% off']):
            discount_patterns.append('extreme_discount')
        if any(x in text for x in ['was $', 'original price', 'retail price']):
            discount_patterns.append('price_comparison')
        if any(x in text for x in ['$99', '$199', '$299', '₹4999']) and any(x in text for x in ['$2999', '$4999', '₹49999']):
            discount_patterns.append('unrealistic_pricing')
            
        print(f"Fraud indicators found: {len(found_keywords)} keywords, {len(discount_patterns)} price patterns")
        if found_keywords:
            print(f"  Keywords: {found_keywords[:3]}{'...' if len(found_keywords) > 3 else ''}")
        if discount_patterns:
            print(f"  Price patterns: {discount_patterns}")
        
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
                    print("✅ PASS - Correctly classified")
                    passed_tests += 1
                else:
                    print(f"❌ FAIL - Expected {email['expected']}, got {detected_status}/{email_status}")
                    failed_tests.append({
                        "name": email["name"],
                        "expected": email["expected"],
                        "actual": detected_status,
                        "email_status": email_status,
                        "confidence": confidence,
                        "fraud_indicators": len(found_keywords) + len(discount_patterns)
                    })
            else:
                print(f"❌ FAIL - HTTP {response.status_code}: {response.text}")
                failed_tests.append({
                    "name": email["name"],
                    "expected": email["expected"],
                    "actual": f"HTTP {response.status_code}",
                    "email_status": "error",
                    "confidence": 0.0,
                    "fraud_indicators": 0
                })
                
        except requests.exceptions.RequestException as e:
            print(f"❌ FAIL - Request error: {e}")
            failed_tests.append({
                "name": email["name"],
                "expected": email["expected"],
                "actual": f"Request error: {e}",
                "email_status": "error", 
                "confidence": 0.0,
                "fraud_indicators": 0
            })
        
        print("-" * 50)
        print()
    
    # Summary
    print("=" * 70)
    print("E-COMMERCE FRAUD DETECTION TEST SUMMARY")
    print("=" * 70)
    fraud_tests = [e for e in E_COMMERCE_FRAUD_EMAILS if e["expected"] == "fraud"]
    safe_tests = [e for e in E_COMMERCE_FRAUD_EMAILS if e["expected"] == "safe"]
    
    fraud_passed = sum(1 for f in failed_tests if f["expected"] == "fraud") 
    fraud_total = len(fraud_tests)
    fraud_success = fraud_total - fraud_passed
    
    safe_passed = sum(1 for f in failed_tests if f["expected"] == "safe")
    safe_total = len(safe_tests) 
    safe_success = safe_total - safe_passed
    
    print(f"Total tests: {total_tests}")
    print(f"Overall passed: {passed_tests}")
    print(f"Overall failed: {len(failed_tests)}")
    print(f"Overall success rate: {(passed_tests/total_tests)*100:.1f}%")
    print()
    print(f"FRAUD DETECTION: {fraud_success}/{fraud_total} ({(fraud_success/fraud_total)*100:.1f}% success)")
    print(f"SAFE DETECTION: {safe_success}/{safe_total} ({(safe_success/safe_total)*100:.1f}% success)")
    print()
    
    if failed_tests:
        print("FAILED TESTS:")
        print("-" * 40)
        for failure in failed_tests:
            print(f"❌ {failure['name']}")
            print(f"   Expected: {failure['expected']}")
            print(f"   Actual: {failure['actual']}")
            print(f"   Fraud indicators: {failure['fraud_indicators']}")
            print()
    else:
        print("🎉 ALL E-COMMERCE FRAUD TESTS PASSED!")
        print("✅ System successfully detects various fraud patterns:")
        print("   • Unrealistic discounts (90%+ off)")
        print("   • Urgency tactics (expires soon, last chance)")
        print("   • Exclusive targeting (specially selected)")
        print("   • Price manipulation (original vs sale price)")
        print("   • Action pressure (claim now, hurry up)")
        print()
    
    print("Test completed!")
    return passed_tests == total_tests

if __name__ == "__main__":
    test_ecommerce_fraud_patterns()
