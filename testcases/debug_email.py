#!/usr/bin/env python3

import joblib
import os
from email_feature_extractor import extract_email_features

def test_email_classification():
    """Test email classification to debug the 'unknown' issue"""
    
    print("=== EMAIL CLASSIFICATION DEBUG ===")
    
    # Check if email model exists and load it
    EMAIL_MODEL_PATH = "email_model.pkl"
    
    if not os.path.exists(EMAIL_MODEL_PATH):
        print(f"ERROR: {EMAIL_MODEL_PATH} not found!")
        return
        
    print(f"Loading model from {EMAIL_MODEL_PATH}...")
    
    try:
        email_model_package = joblib.load(EMAIL_MODEL_PATH)
        print("Model package loaded successfully")
        print(f"Package type: {type(email_model_package)}")
        
        if isinstance(email_model_package, dict):
            print(f"Package keys: {list(email_model_package.keys())}")
            email_model = email_model_package.get('model')
            if email_model:
                print("Model extracted from package successfully")
            else:
                print("ERROR: No 'model' key in package")
                return
        else:
            email_model = email_model_package
            print("Direct model loaded")
            
    except Exception as e:
        print(f"ERROR loading model: {e}")
        return
        
    # Test email data
    test_emails = [
        {
            'subject': 'Meeting tomorrow',
            'body': 'Hi, just a reminder about our meeting tomorrow at 2 PM.',
            'sender': 'colleague@company.com'
        },
        {
            'subject': 'You won $1 million!',
            'body': 'Congratulations! Send your bank details to claim your prize.',
            'sender': 'scammer@fake.com'
        },
        {
            'subject': '',
            'body': '',
            'sender': 'test@test.com'
        }
    ]
    
    for i, email_data in enumerate(test_emails, 1):
        print(f"\n--- Test Email {i} ---")
        print(f"Subject: '{email_data['subject']}'")
        print(f"Sender: '{email_data['sender']}'")
        print(f"Body: '{email_data['body'][:50]}{'...' if len(email_data['body']) > 50 else ''}'")
        
        try:
            # Extract features
            features = extract_email_features(email_data)
            print(f"Features extracted: '{features[:100]}{'...' if len(features) > 100 else ''}'")
            
            if not features.strip():
                print("WARNING: Empty features extracted!")
                continue
                
            # Make prediction
            prediction = email_model.predict([features])[0]
            print(f"Prediction: {prediction}")
            
            if hasattr(email_model, 'predict_proba'):
                proba = email_model.predict_proba([features])[0]
                max_confidence = max(proba)
                print(f"Confidence: {max_confidence:.3f}")
                print(f"All probabilities: {proba}")
            
            # Simulate the logic from main.py
            EMAIL_CONFIDENCE_THRESHOLD = 0.75
            email_status = "unknown"  # This is the initial value causing the issue
            
            if prediction in ['phishing', 'spear_phishing']:
                if max_confidence >= EMAIL_CONFIDENCE_THRESHOLD:
                    email_status = "phishing"
                else:
                    email_status = "safe"
            elif prediction in ['fraudulent', 'fraud', 'scam']:
                if max_confidence >= 0.3:
                    email_status = "fraud"
                else:
                    email_status = "safe"
            elif prediction in ['spam']:
                if max_confidence >= 0.5:
                    email_status = "spam"
                else:
                    email_status = "safe"
            elif prediction in ['legitimate', 'safe']:
                email_status = "safe"
            else:
                email_status = "safe"  # This should catch unknown categories
                
            print(f"Final status: {email_status}")
            
        except Exception as e:
            print(f"ERROR processing email: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_email_classification()
