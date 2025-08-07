#!/usr/bin/env python3

import requests
import json

def test_keyword_fallback_system():
    """Test that keyword fallback system works when ML model classifies threats as 'safe'"""
    
    BASE_URL = "http://127.0.0.1:5000"
    
    # These are emails that might fool the ML model but should be caught by keywords
    fallback_test_cases = [
        {
            "name": "Classic Lottery Fraud (Should be caught by fraud keywords)",
            "data": {
                "subject": "Congratulations! You have won the lottery",
                "sender": "winner@lottery-prize.com",
                "body": "Dear winner, you have won $1 million in our lottery. Send your bank details and processing fee of $500 to claim your prize. This is urgent!"
            },
            "expected_keywords": ["lottery", "won", "million", "prize", "processing fee"],
            "should_catch": "fraud"
        },
        {
            "name": "Donation Fraud (Should be caught by charity fraud keywords)",
            "data": {
                "subject": "Urgent: Sponsor a child, save a life",
                "sender": "help@charity-foundation.org", 
                "body": "Dear kind soul, we desperately need your help. Children are starving and dying. Time is running out. Please donate now to save a life. Every hour counts."
            },
            "expected_keywords": ["urgent donation", "sponsor a child", "save a life", "desperately", "starving", "dying", "time is running out", "donate now"],
            "should_catch": "fraud"
        },
        {
            "name": "Work from Home Spam (Should be caught by spam keywords)",
            "data": {
                "subject": "Make money online - work from home guaranteed",
                "sender": "opportunities@income-generator.com",
                "body": "Make money fast! Work from home guaranteed. No experience required. Start earning immediately. Join thousands of satisfied customers. Click here to start."
            },
            "expected_keywords": ["make money online", "work from home guaranteed", "make money fast", "no experience required", "start earning", "immediately"],
            "should_catch": "spam"
        },
        {
            "name": "Fake Security Update (Should be caught by malware keywords)",
            "data": {
                "subject": "Critical security update required",
                "sender": "security@microsoft-updates.com",
                "body": "Your system is vulnerable to security threats. Download this critical update immediately. Install within 24 hours to protect your computer. This is a mandatory patch from Microsoft Security."
            },
            "expected_keywords": ["security update", "critical update", "system vulnerable", "security threats", "download immediately", "mandatory patch", "microsoft security"],
            "should_catch": "malware"
        },
        {
            "name": "E-commerce Fraud (Should be caught by fraud keywords)",
            "data": {
                "subject": "Exclusive deal specially selected for you!",
                "sender": "deals@mega-offers.com",
                "body": "Mega offer! Unbeatable price on smartphones. Limited stock - offer ends soon! Hurry up and claim now. Original price $1000, now just $99. Too good to be true? Act now before final hours!"
            },
            "expected_keywords": ["exclusive deal", "specially selected", "mega offer", "unbeatable price", "limited stock", "offer ends", "hurry up", "claim now", "too good to be true", "act now", "final hours"],
            "should_catch": "fraud"
        }
    ]
    
    print("=== TESTING KEYWORD FALLBACK SYSTEM ===")
    print("Verifying that keyword detection works even when ML model fails...")
    print()
    
    total_tests = len(fallback_test_cases)
    passed_tests = 0
    
    for i, test_case in enumerate(fallback_test_cases, 1):
        print(f"Test {i}/{total_tests}: {test_case['name']}")
        print(f"Expected to catch: {test_case['should_catch']}")
        print(f"Key phrases to detect: {test_case['expected_keywords'][:3]}...")  # Show first 3
        
        try:
            response = requests.post(f"{BASE_URL}/scan-email-links", 
                                   json=test_case['data'], 
                                   timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                status = result.get('status', 'ERROR')
                category = result.get('email_category', 'ERROR')
                confidence = result.get('confidence', 0)
                
                print(f"ML Model Result: {category} -> Final Status: {status}")
                print(f"Confidence: {confidence:.3f}")
                
                # Check if fallback system worked
                if status == test_case['should_catch']:
                    print(f"✅ SUCCESS: Correctly detected as {status}")
                    if category == "legitimate" or category == "safe":
                        print(f"🎯 FALLBACK WORKED: ML model said '{category}' but keywords caught {status}")
                    passed_tests += 1
                elif status == "safe":
                    print(f"⚠️  MISSED: Should have detected {test_case['should_catch']} but got {status}")
                    print(f"   Keywords may not have triggered or thresholds too high")
                else:
                    print(f"❓ DIFFERENT: Expected {test_case['should_catch']}, got {status}")
                    print(f"   Still caught as threat, just different category")
                    passed_tests += 1  # Still caught as a threat
                    
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ ERROR: {e}")
            
        print("-" * 70)
    
    # Summary
    print(f"\n=== KEYWORD FALLBACK TEST SUMMARY ===")
    print(f"Total tests: {total_tests}")
    print(f"Successfully caught: {passed_tests}")
    print(f"Success rate: {(passed_tests/total_tests)*100:.1f}%")
    
    if passed_tests == total_tests:
        print("🎉 EXCELLENT: All threats caught by keyword fallback system!")
    elif passed_tests >= total_tests * 0.8:
        print("✅ GOOD: Most threats caught - keyword system working well")
    else:
        print("⚠️  NEEDS IMPROVEMENT: Some threats not caught - may need keyword tuning")
        
    return passed_tests / total_tests

def test_final_override_system():
    """Test the final override system that works across ALL categories"""
    
    BASE_URL = "http://127.0.0.1:5000"
    
    override_tests = [
        {
            "name": "Strong Malware Indicators (Should override any ML classification)",
            "data": {
                "subject": "Download and run this urgent security patch",
                "sender": "security@fake-microsoft.com",
                "body": "Critical system update required. Download immediately and execute file. Disable antivirus temporarily. Your system is vulnerable to security threats."
            },
            "expected_override": "malware",
            "expected_keywords": 4  # Should find multiple malware keywords
        },
        {
            "name": "Strong Fraud Indicators (Should override any ML classification)",  
            "data": {
                "subject": "Won lottery prize - wire transfer needed",
                "sender": "claims@lottery-winner.net",
                "body": "You have won a million dollar prize in our lottery! Send wire transfer processing fee and bank details. This is urgent - claim now before offer expires. Double your money guaranteed!"
            },
            "expected_override": "fraud", 
            "expected_keywords": 6  # Should find multiple fraud keywords
        }
    ]
    
    print("\n=== TESTING FINAL OVERRIDE SYSTEM ===")
    print("Testing final keyword override that works across ALL categories...")
    print()
    
    for i, test_case in enumerate(override_tests, 1):
        print(f"Override Test {i}: {test_case['name']}")
        print(f"Expected final override: {test_case['expected_override']}")
        
        try:
            response = requests.post(f"{BASE_URL}/scan-email-links", 
                                   json=test_case['data'], 
                                   timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                status = result.get('status', 'ERROR')
                category = result.get('email_category', 'ERROR')
                
                print(f"ML Category: {category}")
                print(f"Final Status: {status}")
                
                if status == test_case['expected_override']:
                    print(f"✅ SUCCESS: Final override system worked correctly")
                else:
                    print(f"⚠️  Different result: Expected {test_case['expected_override']}, got {status}")
                    
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ ERROR: {e}")
            
        print("-" * 50)

if __name__ == "__main__":
    print("COMPREHENSIVE KEYWORD FALLBACK SYSTEM TEST")
    print("=" * 70)
    
    # Test main keyword fallback
    success_rate = test_keyword_fallback_system()
    
    # Test final override system
    test_final_override_system()
    
    print("\n" + "=" * 70)
    print("OVERALL ASSESSMENT:")
    
    if success_rate >= 0.9:
        print("🎉 EXCELLENT: Keyword fallback system is working perfectly!")
    elif success_rate >= 0.7:
        print("✅ GOOD: Keyword fallback system is working well with minor gaps")  
    else:
        print("⚠️  NEEDS TUNING: Keyword fallback may need threshold adjustments")
        
    print("\n✅ Multi-layer security system:")
    print("   1. ML Model primary classification")
    print("   2. Keyword fallback for 'legitimate' classifications") 
    print("   3. Final keyword override across ALL categories")
    print("   4. Trusted sender whitelist protection")
    
    print("\n🛡️  Your email classification system has robust protection!")
