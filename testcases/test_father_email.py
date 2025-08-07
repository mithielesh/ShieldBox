#!/usr/bin/env python3

import requests
import json

def test_father_project_email():
    print("🔍 Testing Father's Project Email Classification")
    print("=" * 55)
    
    # Simulate your father's email about project ideas with YouTube link
    test_case = {
        "subject": "Future project ideas",
        "sender": "dad@family.com", 
        "body": "Hi son, I've been thinking about some future project ideas we could work on together. Check out this interesting video I found: https://www.youtube.com/watch?v=dQw4w9WgXcQ Let me know what you think!"
    }
    
    print(f"Subject: {test_case['subject']}")
    print(f"Sender: {test_case['sender']}")
    print(f"Body: {test_case['body']}")
    print()
    
    try:
        response = requests.post("http://127.0.0.1:5000/scan-email-links", 
                               json=test_case,
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            print("🔍 DETAILED ANALYSIS:")
            print(json.dumps(data, indent=2))
            
            print(f"\n📊 KEY FINDINGS:")
            print(f"- Final Status: {data.get('status')}")
            print(f"- Email Status: {data.get('email_status')}")
            print(f"- Email Category: {data.get('email_category')}")
            print(f"- Confidence: {data.get('confidence', 0):.4f}")
            print(f"- Model Used: {data.get('model_used')}")
            print(f"- Link Count: {data.get('link_count', 0)}")
            
            if data.get('links'):
                print(f"\n🔗 LINK ANALYSIS:")
                for i, link in enumerate(data['links'], 1):
                    if isinstance(link, dict):
                        print(f"  {i}. URL: {link.get('url')}")
                        print(f"     Status: {link.get('status')}")
                    else:
                        print(f"  {i}. {link}")
            
            # Identify the problem
            if data.get('status') in ['spam', 'phishing'] and test_case['sender'].endswith('@family.com'):
                print(f"\n⚠️  PROBLEM IDENTIFIED:")
                print(f"   - Family email incorrectly classified as: {data.get('status')}")
                print(f"   - This suggests the ML model or risk scoring is too aggressive")
                
                if data.get('confidence', 0) < 0.85:
                    print(f"   - Confidence ({data.get('confidence', 0):.3f}) is below threshold (0.85)")
                    print(f"   - Classification should have been overridden to 'safe'")
                    print(f"   - There might be a bug in the confidence threshold logic")
                
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def test_youtube_link_alone():
    print("\n" + "=" * 55)
    print("🔍 Testing YouTube Link Analysis Separately")
    print("=" * 55)
    
    try:
        response = requests.post("http://127.0.0.1:5000/scan-link", 
                               json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"YouTube Link Status: {data.get('status')}")
            print(f"YouTube Link Confidence: {data.get('confidence', 0):.4f}")
            
            if data.get('status') == 'phishing':
                print("⚠️  YouTube links are being flagged as phishing!")
                print("   This could be due to overly aggressive URL keyword detection")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_father_project_email()
    test_youtube_link_alone()
