#!/usr/bin/env python3
"""
Test donation/charity fraud detection
These scams exploit people's emotions and generosity
"""

import requests
import json

# Test the specific donation fraud that was misclassified
DONATION_FRAUD_TEST = {
    "subject": "🙏 URGENT: Sponsor a Child, Save a Life",
    "sender": "blesshearts.foundation@humanity-mail.org",
    "body": """Dear Kind-Hearted Donor,

I write to you with a heavy heart and desperate hope on behalf of the Blessing Hearts Orphanage & Old Age Home, based in a flood-devastated village in Assam, India.

Our shelter, home to 47 orphaned children and 19 abandoned elders, was recently destroyed in the monsoon floods. These innocent lives now live in tents, starving and cold, with no access to food, clean water, or medical help.

We have reached out to NGOs and the local authorities, but support has been minimal. We are reaching out to kind souls like you who can make a difference.

Your small contribution can provide:

🍲 1-week meal kits for every child
🛏️ Warm bedding for elders sleeping on bare ground
💊 Urgent medical help for sick residents

💔 Time is running out. Every hour counts. One child already passed away last week due to untreated infection.

Please click the link below to send your support and blessings:

❤️ Donate Now – Save a Life

If you cannot donate, please forward this message to someone who can. Together, we can save them.

With prayers and hope,
Sister Mary Elizabeth
Director, Blessing Hearts Orphanage & Old Age Home
blesshearts.foundation@humanity-mail.org"""
}

def test_donation_fraud():
    """Test the specific donation fraud that was misclassified"""
    url = "http://localhost:5000/scan-email-links"
    
    print("=" * 70)
    print("TESTING DONATION/CHARITY FRAUD DETECTION")
    print("=" * 70)
    print()
    
    print(f"Subject: {DONATION_FRAUD_TEST['subject']}")
    print(f"Sender: {DONATION_FRAUD_TEST['sender']}")
    print(f"Expected: fraud")
    print()
    print("Email Body:")
    print("-" * 40)
    print(DONATION_FRAUD_TEST['body'])
    print("-" * 40)
    print()
    
    # Analyze donation fraud indicators
    current_fraud_keywords = [
        'lottery', 'won', 'million', 'prize', 'wire transfer', 'processing fee',
        'double your money', 'guaranteed returns', 'investment opportunity',
        'western union', 'money transfer', 'prince', 'inheritance', 'stuck in',
        'need your help', 'legal fees', 'upfront', 'advance fee', 'beneficiary',
        'exclusive deal', 'specially selected', 'mega offer', 'unbeatable price',
        'limited stock', 'offer ends', 'hurry up', 'claim now', 'original price',
        'free shipping', 'too good to be true', 'limited time offer', 'act now',
        'final hours', 'last chance', 'expires soon', 'flash sale', 'clearance sale'
    ]
    
    # Donation fraud indicators that should be detected
    donation_fraud_indicators = [
        'urgent donation', 'sponsor a child', 'save a life', 'heavy heart',
        'desperate hope', 'orphanage', 'flood devastated', 'starving', 'cold',
        'no access', 'minimal support', 'kind souls', 'time is running out',
        'every hour counts', 'passed away', 'untreated', 'donate now',
        'save them', 'prayers and hope', 'disaster', 'emergency appeal',
        'humanitarian crisis', 'dying children', 'medical help', 'bare ground'
    ]
    
    text_to_check = (DONATION_FRAUD_TEST['subject'] + " " + DONATION_FRAUD_TEST['body']).lower()
    
    print("KEYWORD ANALYSIS:")
    found_current = [kw for kw in current_fraud_keywords if kw in text_to_check]
    found_donation = [kw for kw in donation_fraud_indicators if kw in text_to_check]
    
    print(f"Current fraud keywords found: {found_current} (total: {len(found_current)})")
    print(f"Donation fraud indicators found: {found_donation[:5]}{'...' if len(found_donation) > 5 else ''} (total: {len(found_donation)})")
    print()
    
    # Emotional manipulation patterns
    emotional_patterns = []
    if 'heavy heart' in text_to_check:
        emotional_patterns.append('emotional_appeal')
    if any(x in text_to_check for x in ['starving', 'dying', 'passed away']):
        emotional_patterns.append('victim_suffering')
    if any(x in text_to_check for x in ['urgent', 'time is running out', 'every hour counts']):
        emotional_patterns.append('urgency_pressure')
    if any(x in text_to_check for x in ['kind souls', 'prayers', 'blessings']):
        emotional_patterns.append('religious_appeal')
        
    print(f"Emotional manipulation patterns: {emotional_patterns}")
    print()
    
    # Test current system
    payload = {
        "subject": DONATION_FRAUD_TEST["subject"],
        "sender": DONATION_FRAUD_TEST["sender"], 
        "body": DONATION_FRAUD_TEST["body"]
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            detected_status = result.get("status", "unknown")
            email_status = result.get("email_status", "unknown")
            confidence = result.get("confidence", 0.0)
            
            print("CURRENT SYSTEM RESPONSE:")
            print(f"API Response: {detected_status}")
            print(f"Email Status: {email_status}")
            print(f"Confidence: {confidence:.3f}")
            print()
            
            if detected_status == "fraud" or email_status == "fraud":
                print("✅ PASS - Correctly detected as fraud")
                return True
            else:
                print(f"❌ FAIL - Expected fraud, got {detected_status}/{email_status}")
                print()
                print("DIAGNOSIS:")
                print("This email contains clear donation fraud indicators:")
                print("- Emotional manipulation ('heavy heart', 'desperate hope')")
                print("- Victim suffering stories ('starving children', 'passed away')")
                print("- Urgency pressure ('time is running out', 'every hour counts')")
                print("- Unverifiable charity claims")
                print("- Religious/emotional appeals")
                print("- Disaster exploitation (flood-devastated)")
                return False
        else:
            print(f"❌ FAIL - HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL - Request error: {e}")
        return False

if __name__ == "__main__":
    success = test_donation_fraud()
    if not success:
        print()
        print("RECOMMENDATION: Enhance fraud detection with donation scam keywords:")
        print("- Charity/donation terminology")
        print("- Emotional manipulation phrases") 
        print("- Disaster exploitation patterns")
        print("- Religious appeals")
        print("- Urgency + suffering combinations")
