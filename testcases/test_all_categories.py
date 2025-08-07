#!/usr/bin/env python3
"""
Comprehensive test suite for all email classification categories in ShieldBox
Tests: spam, fraud, phishing, safe, and malware detection
"""

import requests
import json

# Comprehensive test emails covering all 5 categories
ALL_CATEGORY_TEST_EMAILS = [
    # SPAM TESTS
    {
        "name": "Marketing Spam",
        "subject": "URGENT: 50% OFF All Products - Limited Time Only!",
        "sender": "deals@megadeals-online.com", 
        "body": "FLASH SALE - 50% OFF EVERYTHING!!! Limited time offer. Click here: https://megadeals-online.com/sale",
        "expected": "spam"
    },
    {
        "name": "Pharmaceutical Spam",
        "subject": "Cheap Generic Medications - No Prescription Required",
        "sender": "pharmacy@cheapmeds24.biz",
        "body": "Get all medications at wholesale prices! Viagra $1.99, Cialis $2.49. NO PRESCRIPTION REQUIRED!",
        "expected": "spam"
    },
    
    # FRAUD TESTS
    {
        "name": "Lottery Fraud",
        "subject": "Congratulations! You've Won $1,000,000 in the International Lottery!",
        "sender": "lottery@international-lottery.org",
        "body": "You have won $1,000,000 in our lottery! To claim your prize, please send processing fee of $500 via wire transfer to our office.",
        "expected": "fraud"
    },
    {
        "name": "Investment Fraud",
        "subject": "Double Your Money in 30 Days - Guaranteed Returns!",
        "sender": "investment@guaranteed-profits.biz",
        "body": "Our investment opportunity offers guaranteed returns of 100% in 30 days! Send your money now to start earning.",
        "expected": "fraud"
    },
    
    # PHISHING TESTS
    {
        "name": "Bank Phishing",
        "subject": "Urgent: Your Bank Account Has Been Compromised",
        "sender": "security@bank-alerts.com",
        "body": "Your account has suspicious activity. Click here immediately to verify your login credentials: https://fake-bank-security.com/login",
        "expected": "phishing"
    },
    {
        "name": "PayPal Phishing",
        "subject": "PayPal Account Verification Required",
        "sender": "noreply@paypal-security.net",
        "body": "Your PayPal account needs verification. Please login here to confirm your account: https://payp4l-verification.com/login",
        "expected": "phishing"
    },
    
    # SAFE TESTS
    {
        "name": "Legitimate Newsletter",
        "subject": "Weekly Newsletter - Company Updates",
        "sender": "newsletter@mycompany.com",
        "body": "Here are this week's company updates and news. Visit our website for more information: https://mycompany.com/news",
        "expected": "safe"
    },
    {
        "name": "Family Email",
        "subject": "Family Vacation Photos",
        "sender": "dad@gmail.com",
        "body": "Hi! Here are the photos from our vacation last week. Check out this video I found: https://youtube.com/watch?v=vacation2024",
        "expected": "safe"
    },
    
    # MALWARE TESTS
    {
        "name": "Malware Attachment",
        "subject": "Important Document - Please Review",
        "sender": "documents@suspicious-domain.ru",
        "body": "Please download and run this important document.exe file immediately. It contains critical information for your computer.",
        "expected": "malware"
    },
    {
        "name": "Suspicious Download",
        "subject": "Download Your Free Software Now!",
        "sender": "downloads@virus-software.com", 
        "body": "Download our free software! Click here to install: https://virus-software.com/download/malware.exe Warning: disable antivirus first.",
        "expected": "malware"
    }
]

def test_all_email_categories():
    """Test all email categories comprehensively"""
    url = "http://localhost:5000/scan-email-links"
    
    print("=" * 70)
    print("SHIELDBOX COMPREHENSIVE EMAIL CLASSIFICATION TEST")
    print("Testing: SPAM, FRAUD, PHISHING, SAFE, MALWARE")
    print("=" * 70)
    print()
    
    # Group results by category
    results_by_category = {
        "spam": {"total": 0, "passed": 0, "failed": []},
        "fraud": {"total": 0, "passed": 0, "failed": []},
        "phishing": {"total": 0, "passed": 0, "failed": []},
        "safe": {"total": 0, "passed": 0, "failed": []},
        "malware": {"total": 0, "passed": 0, "failed": []}
    }
    
    total_tests = len(ALL_CATEGORY_TEST_EMAILS)
    overall_passed = 0
    
    for i, email in enumerate(ALL_CATEGORY_TEST_EMAILS, 1):
        category = email["expected"]
        results_by_category[category]["total"] += 1
        
        print(f"Test {i}/{total_tests}: {email['name']} ({category.upper()})")
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
                    print(f"✅ PASS - Correctly detected as {email['expected']}")
                    results_by_category[category]["passed"] += 1
                    overall_passed += 1
                else:
                    print(f"❌ FAIL - Expected {email['expected']}, got {detected_status}/{email_status}")
                    results_by_category[category]["failed"].append({
                        "name": email["name"],
                        "expected": email["expected"],
                        "actual": detected_status,
                        "email_status": email_status,
                        "confidence": confidence
                    })
            else:
                print(f"❌ FAIL - HTTP {response.status_code}: {response.text}")
                results_by_category[category]["failed"].append({
                    "name": email["name"],
                    "expected": email["expected"],
                    "actual": f"HTTP {response.status_code}",
                    "email_status": "error",
                    "confidence": 0.0
                })
                
        except requests.exceptions.RequestException as e:
            print(f"❌ FAIL - Request error: {e}")
            results_by_category[category]["failed"].append({
                "name": email["name"],
                "expected": email["expected"],
                "actual": f"Request error: {e}",
                "email_status": "error", 
                "confidence": 0.0
            })
        
        print("-" * 50)
        print()
    
    # Detailed Summary by Category
    print("=" * 70)
    print("DETAILED RESULTS BY CATEGORY")
    print("=" * 70)
    
    for category, stats in results_by_category.items():
        if stats["total"] > 0:
            success_rate = (stats["passed"] / stats["total"]) * 100
            print(f"{category.upper()} DETECTION:")
            print(f"  Total tests: {stats['total']}")
            print(f"  Passed: {stats['passed']}")
            print(f"  Failed: {len(stats['failed'])}")
            print(f"  Success rate: {success_rate:.1f}%")
            
            if stats["failed"]:
                print(f"  Failed tests:")
                for failure in stats["failed"]:
                    print(f"    ❌ {failure['name']} (expected: {failure['expected']}, got: {failure['actual']})")
            else:
                print(f"  🎉 All {category} tests passed!")
            print()
    
    # Overall Summary
    print("=" * 70)
    print("OVERALL SUMMARY")
    print("=" * 70)
    print(f"Total tests: {total_tests}")
    print(f"Overall passed: {overall_passed}")
    print(f"Overall failed: {total_tests - overall_passed}")
    print(f"Overall success rate: {(overall_passed/total_tests)*100:.1f}%")
    print()
    
    # Check if all categories are working
    categories_working = sum(1 for stats in results_by_category.values() 
                           if stats["total"] > 0 and stats["passed"] == stats["total"])
    categories_tested = sum(1 for stats in results_by_category.values() if stats["total"] > 0)
    
    if overall_passed == total_tests:
        print("🎉 ALL EMAIL CLASSIFICATION TESTS PASSED!")
        print("✅ All 5 categories (spam, fraud, phishing, safe, malware) are working correctly!")
    else:
        print("⚠️  Some tests failed. Please review the results above.")
        print(f"Categories working perfectly: {categories_working}/{categories_tested}")
    
    print()
    print("Test completed!")
    return overall_passed == total_tests

if __name__ == "__main__":
    test_all_email_categories()
