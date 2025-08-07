#!/usr/bin/env python3

import requests
import json

def debug_family_email():
    print("🔍 Debugging Family Email Classification")
    print("=" * 50)
    
    test_case = {
        "subject": "Bank account update",
        "sender": "dad@family.com", 
        "body": "Hi son, I updated my bank account details. Can you verify your account is still active? Let me know if you need help."
    }
    
    response = requests.post("http://127.0.0.1:5000/scan-email-links", 
                           json=test_case,
                           timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"Subject: {test_case['subject']}")
        print(f"Sender: {test_case['sender']}")
        print(f"Body: {test_case['body']}")
        print()
        print("Response:")
        print(json.dumps(data, indent=2))
        
        # Check what's happening
        print(f"\nAnalysis:")
        print(f"- Final status: {data.get('status')}")
        print(f"- Email status: {data.get('email_status')}")
        print(f"- Email category: {data.get('email_category')}")
        print(f"- Confidence: {data.get('confidence')}")
        print(f"- Model used: {data.get('model_used')}")
        print(f"- Links found: {len(data.get('links', []))}")
        
        # The issue might be in the final decision logic
        if data.get('status') != data.get('email_status'):
            print(f"\n⚠️  MISMATCH: Final status ({data.get('status')}) != Email status ({data.get('email_status')})")
            print("This suggests URL analysis is overriding email analysis")
    else:
        print(f"Error: {response.status_code} - {response.text}")

if __name__ == "__main__":
    debug_family_email()
