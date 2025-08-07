#!/usr/bin/env python3

import requests
import json

def test_extension_processing():
    print("🧪 Testing Chrome Extension Response Processing")
    print("=" * 60)
    
    # Test cases that were problematic
    test_cases = [
        {
            "name": "Father's Project Email (was showing as spam)",
            "subject": "Future project ideas",
            "sender": "dad@family.com",
            "body": "Hi son, I've been thinking about some future project ideas we could work on together. Check out this interesting video I found: https://www.youtube.com/watch?v=dQw4w9WgXcQ Let me know what you think!",
            "expected_final": "safe"
        },
        {
            "name": "Family Bank Email (was showing as phishing)",
            "subject": "Bank account update",
            "sender": "dad@family.com",
            "body": "Hi son, I updated my bank account details. Can you verify your account is still active? Let me know if you need help.",
            "expected_final": "safe"
        },
        {
            "name": "Actual Phishing (should still be caught)",
            "subject": "URGENT: Account Suspended",
            "sender": "security@payp4l.com",
            "body": "Your account has been suspended. Click here to verify: http://192.168.1.100/fake-paypal-login",
            "expected_final": "phishing"
        }
    ]
    
    def simulate_extension_processing(backend_data):
        """Simulate the FIXED Chrome extension logic"""
        # FIXED: Only use final processed statuses, not raw ML predictions
        status = backend_data.get('status', '').lower()
        email_status = backend_data.get('email_status', status).lower()
        
        if status == 'no_links':
            return email_status or 'safe'
        elif status == 'phishing' or email_status == 'phishing' or backend_data.get('has_phishing'):
            return 'phishing'
        elif status == 'spam' or email_status == 'spam':
            # FIXED: Removed email_category check
            return 'spam'
        elif status == 'fraud' or email_status == 'fraud':
            return 'fraud'
        elif status == 'malware' or email_status == 'malware':
            return 'malware'
        else:
            return 'safe'
    
    results = []
    
    for i, test in enumerate(test_cases, 1):
        print(f"\nTest {i}: {test['name']}")
        print(f"Expected: {test['expected_final']}")
        
        try:
            # Get backend response
            response = requests.post("http://127.0.0.1:5000/scan-email-links", 
                                   json={
                                       "subject": test['subject'],
                                       "sender": test['sender'],
                                       "body": test['body']
                                   },
                                   timeout=10)
            
            if response.status_code == 200:
                backend_data = response.json()
                
                # Show what the backend actually returned
                print(f"Backend Status: {backend_data.get('status')}")
                print(f"Backend Email Status: {backend_data.get('email_status')}")
                print(f"Backend Email Category: {backend_data.get('email_category')} (raw ML)")
                print(f"Backend Confidence: {backend_data.get('confidence', 0):.3f}")
                
                # Simulate extension processing
                extension_result = simulate_extension_processing(backend_data)
                print(f"Extension Result: {extension_result}")
                
                # Check if correct
                is_correct = extension_result == test['expected_final']
                status_icon = "✅" if is_correct else "❌"
                print(f"{status_icon} Result: {'CORRECT' if is_correct else 'INCORRECT'}")
                
                results.append({
                    'test': test['name'],
                    'expected': test['expected_final'],
                    'backend_status': backend_data.get('status'),
                    'backend_email_status': backend_data.get('email_status'),
                    'backend_email_category': backend_data.get('email_category'),
                    'extension_result': extension_result,
                    'correct': is_correct,
                    'confidence': backend_data.get('confidence', 0)
                })
                
        except Exception as e:
            print(f"❌ Error: {e}")
    
    # Summary
    print(f"\n📊 SUMMARY")
    print("=" * 60)
    
    correct_count = sum(1 for r in results if r['correct'])
    total_count = len(results)
    accuracy = (correct_count / total_count * 100) if total_count > 0 else 0
    
    print(f"Chrome Extension Accuracy: {correct_count}/{total_count} ({accuracy:.1f}%)")
    
    print(f"\nDetailed Results:")
    for result in results:
        status = "✅ PASS" if result['correct'] else "❌ FAIL"
        print(f"  {status}: {result['test']}")
        print(f"    Expected: {result['expected']}")
        print(f"    Backend: status={result['backend_status']}, email_status={result['backend_email_status']}")
        print(f"    Raw ML Category: {result['backend_email_category']} (confidence={result['confidence']:.3f})")
        print(f"    Extension Result: {result['extension_result']}")
        print()
    
    if accuracy == 100:
        print("🎉 PERFECT! Chrome extension now correctly processes all responses!")
        print("   The issue with father's emails showing as spam should be resolved.")
    else:
        print("⚠️  There may still be issues with the Chrome extension processing.")

if __name__ == "__main__":
    test_extension_processing()
