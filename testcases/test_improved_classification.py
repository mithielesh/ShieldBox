#!/usr/bin/env python3

import requests
import json

# Test cases that were problematic before
test_cases = [
    {
        "name": "Email with Long Legitimate URL",
        "subject": "Your order confirmation",
        "sender": "notifications@amazon.com",
        "body": "Thank you for your order! You can track your package here: https://www.amazon.com/your-account/order-history?ref=nav_orders_first&orderFilter=months-3&language=en_US&ref_=ya_d_l_order_history_orders&orderFilter=months-3",
        "expected": "safe"  # Should be safe despite long URL
    },
    {
        "name": "Family Email with Account Reference",
        "subject": "Bank account update",
        "sender": "dad@family.com", 
        "body": "Hi son, I updated my bank account details. Can you verify your account is still active? Let me know if you need help.",
        "expected": "safe"  # Should NOT be flagged as spam/phishing
    },
    {
        "name": "Legitimate Email with Multiple Links",
        "subject": "Welcome to GitHub",
        "sender": "noreply@github.com",
        "body": "Welcome! Please verify your account: https://github.com/settings/profile and check our security guide: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure",
        "expected": "safe"  # Should be safe despite "verify" keyword
    },
    {
        "name": "Actual Phishing Email",
        "subject": "URGENT: Account Suspended",
        "sender": "security@payp4l.com",  # Note the typo
        "body": "Your account has been suspended. Click here to verify: http://192.168.1.100/fake-paypal-login",
        "expected": "phishing"  # Should correctly identify as phishing
    },
    {
        "name": "Email with No Links",
        "subject": "Hello from mom",
        "sender": "mom@family.com",
        "body": "Hi dear, how are you doing? Hope you're staying safe. Love you!",
        "expected": "safe"  # Should be safe (no links to analyze)
    }
]

def test_email_classification():
    print("🧪 Testing Improved Email Classification System")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:5000"
    
    # Test if server is running
    try:
        response = requests.get(f"{base_url}/test", timeout=5)
        print(f"✅ Server is running: {response.json()['message']}")
    except:
        print("❌ Server is not running. Please start it with 'python main.py'")
        return
    
    print()
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"Test {i}: {test_case['name']}")
        print(f"Subject: {test_case['subject']}")
        print(f"Sender: {test_case['sender']}")
        print(f"Body: {test_case['body'][:100]}{'...' if len(test_case['body']) > 100 else ''}")
        
        try:
            # Send to the improved endpoint
            response = requests.post(f"{base_url}/scan-email-links", 
                                   json={
                                       "subject": test_case['subject'],
                                       "sender": test_case['sender'],
                                       "body": test_case['body']
                                   },
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                actual_status = data.get('status', 'unknown')
                email_status = data.get('email_status', 'unknown')
                confidence = data.get('confidence', 0.0)
                
                # Check if the result matches expectations
                is_correct = (actual_status == test_case['expected'] or 
                             email_status == test_case['expected'])
                
                status_icon = "✅" if is_correct else "❌"
                
                print(f"{status_icon} Result: {actual_status} (email: {email_status})")
                print(f"   Expected: {test_case['expected']}")
                print(f"   Confidence: {confidence:.3f}")
                
                if 'links' in data and data['links']:
                    print(f"   Links found: {len(data['links'])}")
                    for link in data['links']:
                        if isinstance(link, dict):
                            print(f"     - {link['url']}: {link['status']}")
                        else:
                            print(f"     - {link}")
                
                results.append({
                    'test': test_case['name'],
                    'expected': test_case['expected'],
                    'actual': actual_status,
                    'email_status': email_status,
                    'correct': is_correct,
                    'confidence': confidence
                })
                
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                print(f"   Response: {response.text}")
                
        except Exception as e:
            print(f"❌ Error: {e}")
        
        print("-" * 40)
    
    # Summary
    print("\n📊 TEST SUMMARY")
    print("=" * 60)
    
    correct_count = sum(1 for r in results if r['correct'])
    total_count = len(results)
    accuracy = (correct_count / total_count * 100) if total_count > 0 else 0
    
    print(f"Overall Accuracy: {correct_count}/{total_count} ({accuracy:.1f}%)")
    
    if accuracy >= 80:
        print("🎉 GREAT! The classification system is working much better!")
    elif accuracy >= 60:
        print("👍 GOOD! Significant improvement, but may need minor tweaks")
    else:
        print("⚠️  NEEDS WORK: Still having classification issues")
    
    print("\nDetailed Results:")
    for result in results:
        status = "✅ PASS" if result['correct'] else "❌ FAIL"
        print(f"  {status}: {result['test']}")
        print(f"    Expected: {result['expected']}, Got: {result['actual']} (email: {result['email_status']})")
    
    return results

if __name__ == "__main__":
    test_email_classification()
