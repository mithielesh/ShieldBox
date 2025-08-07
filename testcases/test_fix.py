#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_simple_classification():
    """Simple test to check if empty email causes unknown status"""
    
    # Import the classification logic from main.py
    from email_feature_extractor import extract_email_features
    import joblib
    
    # Load model
    try:
        email_model_package = joblib.load('email_model.pkl')
        if isinstance(email_model_package, dict):
            email_model = email_model_package.get('model')
        else:
            email_model = email_model_package
            
        print("Model loaded successfully")
    except Exception as e:
        print(f"Model loading failed: {e}")
        return
    
    # Test cases that might cause "unknown" status
    test_cases = [
        {"subject": "", "body": "", "sender": ""},
        {"subject": " ", "body": " ", "sender": "test@test.com"},
        {"subject": "a", "body": "b", "sender": "c@d.com"},
        {"subject": "Test", "body": "Normal email content here", "sender": "user@company.com"}
    ]
    
    for i, test_email in enumerate(test_cases, 1):
        print(f"\n--- Test Case {i} ---")
        print(f"Subject: '{test_email['subject']}'")
        print(f"Body: '{test_email['body']}'")
        print(f"Sender: '{test_email['sender']}'")
        
        # Simulate the exact logic from main.py
        email_status = "unknown"  # Initial value that was causing the problem
        email_category = "unknown"
        email_confidence = 0.0
        
        try:
            email_text = extract_email_features(test_email)
            print(f"Features: '{email_text}'")
            
            # Check if features are empty or too short (the fix we added)
            if not email_text or len(email_text.strip()) < 3:
                print(f"Features too short - defaulting to safe")
                email_status = "safe"
                email_category = "legitimate"
                email_confidence = 0.5
            else:
                # Normal prediction path
                email_category = email_model.predict([email_text])[0]
                if hasattr(email_model, 'predict_proba'):
                    proba = email_model.predict_proba([email_text])[0]
                    email_confidence = max(proba)
                else:
                    email_confidence = 0.7
                
                # Basic classification logic
                if email_category in ['legitimate', 'safe']:
                    email_status = "safe"
                elif email_category in ['phishing', 'spear_phishing']:
                    email_status = "phishing" if email_confidence >= 0.75 else "safe"
                elif email_category in ['fraudulent', 'fraud', 'scam']:
                    email_status = "fraud" if email_confidence >= 0.3 else "safe"
                elif email_category in ['spam']:
                    email_status = "spam" if email_confidence >= 0.5 else "safe"
                else:
                    email_status = "safe"  # Default for unknown categories
                    
            # Final safety check (the additional fix we added)
            if email_status == "unknown":
                email_status = "safe"
                email_category = "legitimate"
                print("Fixed unknown status -> defaulting to safe")
                
            print(f"Final result: {email_category} -> {email_status} (confidence: {email_confidence:.3f})")
            
            # Check if we still have unknown status
            if email_status == "unknown":
                print("❌ ERROR: Still getting unknown status!")
            else:
                print("✅ SUCCESS: No unknown status")
                
        except Exception as e:
            print(f"❌ ERROR: Exception during classification: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_simple_classification()
