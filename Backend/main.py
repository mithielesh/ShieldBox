from flask import Flask, request, jsonify
from flask_cors import CORS
import re
from feature_extractor import extract_features
import joblib
import os
from datetime import datetime

app = Flask(__name__)
# Enhanced CORS configuration to explicitly allow Chrome extension
CORS(app, resources={
    r"/*": {
        "origins": ["chrome-extension://*", "http://localhost:*", "http://127.0.0.1:*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "access-control-allow-origin"],
        "supports_credentials": True,
        "expose_headers": ["Content-Type", "X-CSRFToken"]
    }
})

# Load ML models if available
MODEL_PATH = "phishing_model.pkl"
EMAIL_MODEL_PATH = "email_model.pkl"

url_model = None
email_model = None
feature_scaler = None
phishing_threshold = 0.2  # Default sensitive threshold

# Email classification categories
EMAIL_CATEGORIES = [
    "legitimate",
    "phishing",
    "spam",
    "malware",
    "fraud"
]

# Load URL phishing detection model
try:
    if os.path.exists(MODEL_PATH):
        model_package = joblib.load(MODEL_PATH)
        url_model = model_package['model']
        feature_scaler = model_package['scaler']
        phishing_threshold = model_package.get('threshold', 0.2)
        
        print(f"Phishing detection model loaded from {MODEL_PATH}")
        print(f"Accuracy: {model_package.get('accuracy', 0):.4f}")
        print(f"Phishing detection rate: {model_package.get('recall', 0):.4f}")
        print(f"Using threshold: {phishing_threshold:.2f}")
        if 'training_date' in model_package:
            print(f"Model trained: {model_package['training_date']}")
    else:
        print(f"Warning: No model found at {MODEL_PATH}")
        print("Running with basic URL checks only")
except Exception as e:
    print(f"Error loading model: {e}")

# Try to load Email model
try:
    if os.path.exists(EMAIL_MODEL_PATH):
        email_model_package = joblib.load(EMAIL_MODEL_PATH)
        
        # Check if it's a package (dictionary) or direct model
        if isinstance(email_model_package, dict):
            # Extract the actual model from the package
            email_model = email_model_package.get('model')
            if email_model:
                print(f"Email model loaded from package: {EMAIL_MODEL_PATH}")
                print(f"Package keys: {list(email_model_package.keys())}")
                if 'accuracy' in email_model_package:
                    print(f"Email model accuracy: {email_model_package['accuracy']:.4f}")
            else:
                print(f"Warning: No 'model' key found in email model package")
                email_model = None
        else:
            # It's a direct model object
            email_model = email_model_package
            print(f"Direct email model loaded from {EMAIL_MODEL_PATH}")
            
except Exception as e:
    print(f"Error loading Email model: {e}")
    email_model = None

@app.route('/scan-link', methods=['POST', 'OPTIONS'])
def scan_link():
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,access-control-allow-origin')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response
    
    # Start timer to track processing time
    import time
    start_time = time.time()
    
    data = request.get_json()
    url = data.get('url', '')
    
    if not url:
        return jsonify({"url": url, "status": "invalid", "message": "Empty URL"})
    
    # Check if we can use ML model
    if url_model:
        try:
            # EXPANDED: Much more comprehensive list of suspicious keywords
            suspicious_keywords = [
                "login", "verify", "secure", "bank", "phish", "paypal", "account",
                "update", "confirm", "password", "signin", "authenticate", "verification",
                "wallet", "bitcoin", "crypto", "recover", "unlock", "customer", "service", 
                "support", "help", "helpdesk", "validation", "invalid", "expired", "admin",
                "reset", "fraud", "alert", "notification", "verify-account", "auth", "credential",
                "identity", "suspicious", "activity", "validate", "confirm-identity", "security",
                "payment", "card", "credit", "debit", "chase", "citibank", "wellsfargo", "microsoft",
                "apple", "google", "amazon", "ebay", "netflix", "facebook", "instagram", "twitter",
                "online", "billing", "invoice", "statement", "access", "money", "limited", "urgent",
                "verify-now", "banking", "web", "profile", "blocked", "hold", "released", "authorize"
            ]
            
            # Check if URL contains any suspicious keywords
            url_is_suspicious = False
            found_keywords = []
            
            # Check for known legitimate domains first
            legitimate_domains = [
                "google.com", "microsoft.com", "apple.com", "amazon.com", "paypal.com",
                "ebay.com", "facebook.com", "twitter.com", "linkedin.com", "github.com",
                "stackoverflow.com", "reddit.com", "youtube.com", "gmail.com", "outlook.com",
                "netflix.com", "spotify.com", "dropbox.com", "adobe.com"
            ]
            
            is_legitimate_domain = any(domain in url.lower() for domain in legitimate_domains)
            
            # Only check for suspicious keywords if it's not from a known legitimate domain
            if not is_legitimate_domain:
                for keyword in suspicious_keywords:
                    if keyword in url.lower():
                        url_is_suspicious = True
                        found_keywords.append(keyword)
            
            if url_is_suspicious:
                print(f"URL contains suspicious keywords: {', '.join(found_keywords)}")
            elif is_legitimate_domain:
                print(f"URL from legitimate domain, skipping keyword checks")
            
            # Extract features using our feature extractor
            raw_features = extract_features(url)
            
            # Apply feature scaling if available
            if feature_scaler:
                features = feature_scaler.transform([raw_features])
                print(f"Applied feature scaling: {features[0][:5]}...")
            else:
                features = [raw_features]
                print("No feature scaling applied")
            
            # Make prediction using model
            prediction = url_model.predict(features)[0]
            
            # Get probability (handle different model types)
            if hasattr(url_model, 'predict_proba'):
                probability = url_model.predict_proba(features)[0][1]  # Get probability of phishing class
            else:
                # Fall back for models without predict_proba
                probability = 1.0 if prediction == 1 else 0.0
            
            # CRITICAL FIX: Use the trained model's recommended threshold for phishing detection
            # Our model was trained with a focus on high recall (95%+ detection rate)
                
            # SIMPLIFIED PHISHING DETECTION
            # Apply more conservative probability adjustments
            
            # Initialize boosting value
            boost = 0.0  # Start with no boost
            
            # Only boost for non-legitimate domains
            if not is_legitimate_domain:
                # If URL contains suspicious keywords and has other red flags
                if url_is_suspicious and len(found_keywords) > 1:
                    boost += 0.2  # Conservative boost for multiple suspicious keywords
                    print(f"Boosting for multiple suspicious keywords: +0.2")
                
                # Additional red flags
                if len(url) > 100:  # Very long URLs
                    boost += 0.1
                    print(f"Boosting for very long URL: +0.1")
                
                if url.count('.') > 4:  # Many subdomains
                    boost += 0.1
                    print(f"Boosting for many subdomains: +0.1")
                
                if re.search(r'\d+\.\d+\.\d+\.\d+', url):  # IP-based URLs
                    boost += 0.3
                    print(f"Boosting for IP-based URL: +0.3")
            
            # Apply the boost (ensuring we don't exceed 1.0)
            original_prob = probability
            probability = min(1.0, probability + boost)
            
            if boost > 0:
                print(f"Boosted probability: {original_prob:.4f} → {probability:.4f} (+{boost:.2f})")
            else:
                print(f"No boost applied, using original probability: {probability:.4f}")
            # Use the model's trained threshold
            effective_threshold = phishing_threshold  # Use the actual trained threshold
                
            # Check if we're approaching timeout (max 3 seconds processing time)
            elapsed_time = time.time() - start_time
            if elapsed_time > 2.5:  # If processing is taking too long
                print(f"Warning: URL processing taking too long ({elapsed_time:.2f}s), using simplified checks")
                # Use simplified detection to avoid timeout
                result = "safe"
                if prediction == 1 or probability > 0.5:
                    result = "phishing"
            else:
                # Normal detection flow - use trained model results primarily
                result = "safe"
                
                # Determine result based on model prediction and probability
                if probability > effective_threshold or prediction == 1:
                    result = "phishing"
                    
                # For legitimate domains, require higher confidence to flag as phishing
                if is_legitimate_domain and probability < 0.8:
                    result = "safe"
                    print(f"Overriding to safe for legitimate domain with low confidence: {probability:.4f}")
                
            print(f"Final Prediction: {result} (probability: {probability:.4f}, threshold: {effective_threshold})")
            # Calculate total processing time
            elapsed_time = time.time() - start_time
            
            # Enhanced debugging
            print(f"ML scan for {url}: {result} (confidence: {probability:.2f})")
            print(f"Raw prediction: {prediction}, Probability: {probability:.4f}")
            print(f"Processing time: {elapsed_time:.2f} seconds")
            print(f"Feature count: {len(raw_features)}")
            
            # More conservative additional checks
            adjusted_result = result
            
            # Only apply aggressive checks for non-legitimate domains
            if not is_legitimate_domain:
                # Look for clear phishing indicators
                red_flag_count = 0
                
                if len(found_keywords) > 2:  # Multiple suspicious keywords
                    red_flag_count += 1
                    
                if len(url) > 100:  # Very long URLs
                    red_flag_count += 1
                    
                if url.count('.') > 4:  # Many subdomains
                    red_flag_count += 1
                    
                if "http://" in url:  # Non-HTTPS
                    red_flag_count += 1
                    
                if re.search(r'\d+\.\d+\.\d+\.\d+', url):  # IP-based URLs
                    red_flag_count += 2  # This is a strong indicator
                    
                if re.search(r'%[0-9a-fA-F]{2}', url) or '@' in url:  # URL encoding
                    red_flag_count += 1
                
                # Only override if we have multiple red flags
                if red_flag_count >= 2:
                    print(f"Multiple red flags detected ({red_flag_count}) - marking as phishing")
                    adjusted_result = "phishing"
            
            # Enhanced response with more debugging info
            is_suspicious = any(keyword in url.lower() for keyword in [
                "login", "verify", "secure", "bank", "phish", "paypal", "account"
            ])
            
            return jsonify({ 
                "url": url, 
                "status": adjusted_result, 
                "raw_prediction": result,
                "confidence": float(probability),
                "threshold": phishing_threshold,  # Use actual threshold from model
                "features_extracted": True,
                "model_type": model_package.get('best_model_type', "Unknown") if model_package else "Standard",
                "suspicious_keywords_found": is_suspicious,
                "debug_info": {
                    "feature_count": len(raw_features),
                    "has_scaler": feature_scaler is not None,
                    "url_length": len(url),
                    "contains_suspicious_terms": is_suspicious
                }
            })
            
        except Exception as e:
            print(f"Error in ML prediction: {e}")
            # Fallback to rule-based
            suspicious_terms = ["login", "verify", "secure", "bank", "phish", "paypal", 
                               "account", "update", "confirm", "password", "billing"]
            result = "phishing" if any(keyword in url.lower() for keyword in suspicious_terms) else "safe"
            return jsonify({ 
                "url": url, 
                "status": result,
                "confidence": 0.0,
                "error": str(e),
                "fallback": "rule-based"
            })
    else:
        # Use rule-based fallback
        suspicious_terms = ["login", "verify", "secure", "bank", "phish", "paypal", 
                           "account", "update", "confirm", "password", "billing"]
        result = "phishing" if any(keyword in url.lower() for keyword in suspicious_terms) else "safe"
        print(f"Using rule-based scan for {url}: {result}")
        return jsonify({ 
            "url": url, 
            "status": result,
            "model": "unavailable",
            "fallback": "rule-based"
        })

@app.route('/scan-email-links', methods=['POST'])
def scan_email_links():
    data = request.get_json()
    subject = data.get('subject', '')
    sender = data.get('sender', '')
    body = data.get('body', '')
    
    # Extract links from email body
    url_regex = r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+'
    urls = re.findall(url_regex, body)
    
    print(f"[DEBUG] Email scan - Subject: '{subject}', Sender: '{sender}'")
    print(f"[DEBUG] Email body length: {len(body)} characters")
    print(f"[DEBUG] URLs found: {urls}")
    
    # Check if we have any links to scan
    if not urls:
        # Even if there are no URLs, we should still analyze the email content
        print(f"[DEBUG] No URLs found, performing email content analysis only")
        
        # Analyze email content even without URLs
        email_status = "unknown"
        email_category = "unknown"
        email_confidence = 0.0
        
        # CRITICAL FIX: Handle empty/minimal email content immediately
        if (not subject or len(subject.strip()) < 1) and (not body or len(body.strip()) < 3) and (not sender or '@' not in sender):
            print(f"[DEBUG] Email has minimal/empty content - defaulting to safe")
            email_status = "safe"
            email_category = "legitimate"
            email_confidence = 0.5
        elif email_model:
            try:
                from email_feature_extractor import extract_email_features, get_email_risk_score
                
                email_text = extract_email_features({
                    'subject': subject,
                    'body': body, 
                    'sender': sender
                })
                
                # Check if features are empty or too short
                if not email_text or len(email_text.strip()) < 3:
                    print(f"[DEBUG] Email features too short or empty: '{email_text}' - defaulting to safe")
                    email_status = "safe"
                    email_category = "legitimate"
                    email_confidence = 0.5
                    print(f"[DEBUG] Email (no URLs) classified as: {email_category} -> {email_status}")
                    
                else:
                    if isinstance(email_model, dict):
                        model = email_model['model']
                    else:
                        model = email_model
                    
                    email_category = model.predict([email_text])[0]
                    
                    if hasattr(model, 'predict_proba'):
                        proba = model.predict_proba([email_text])[0]
                        email_confidence = max(proba)
                    else:
                        email_confidence = 0.7
                    
                    # Map category to status with confidence threshold (same logic as main path)
                    EMAIL_CONFIDENCE_THRESHOLD = 0.75  # Lowered from 0.85 for better phishing detection
                    
                    # Check if sender is from a trusted domain
                    trusted_domains = [
                        "amazon.com", "google.com", "microsoft.com", "apple.com", "github.com",
                        "paypal.com", "ebay.com", "facebook.com", "twitter.com", "linkedin.com",
                        "netflix.com", "spotify.com", "adobe.com", "dropbox.com", "slack.com",
                        "gmail.com", "outlook.com", "yahoo.com", "mycompany.com"  # Added common legitimate domains
                    ]
                    
                    sender_domain = sender.split('@')[-1].lower() if '@' in sender else ""
                    is_trusted_sender = any(domain in sender_domain for domain in trusted_domains)
                    
                    if email_category in ['phishing', 'spear_phishing']:
                        # Much higher bar for trusted senders - SEPARATED from fraud
                        required_confidence = 0.95 if is_trusted_sender else EMAIL_CONFIDENCE_THRESHOLD
                        
                        if email_confidence >= required_confidence:
                            email_status = "phishing"
                            print(f"[DEBUG] High-confidence phishing (no URLs): {email_confidence:.3f} (trusted: {is_trusted_sender})")
                        else:
                            email_status = "safe"  # Low confidence phishing -> treat as safe
                            print(f"[DEBUG] Low-confidence phishing (no URLs) ({email_confidence:.3f}) -> marking as safe (trusted: {is_trusted_sender})")
                    elif email_category in ['fraudulent', 'fraud', 'scam']:
                        # FIXED: Separate fraud detection with much lower confidence threshold (no URLs)
                        fraud_threshold = 0.9 if is_trusted_sender else 0.3  # Even lower threshold for fraud
                        
                        if email_confidence >= fraud_threshold:
                            email_status = "fraud"
                            print(f"[DEBUG] Confident fraud (no URLs): {email_confidence:.3f} (trusted: {is_trusted_sender})")
                        else:
                            email_status = "safe"  # Low confidence fraud -> treat as safe
                            print(f"[DEBUG] Low-confidence fraud (no URLs) ({email_confidence:.3f}) -> marking as safe (trusted: {is_trusted_sender})")
                    elif email_category in ['malware', 'virus', 'trojan']:
                        # ADDED: Malware detection logic (no URLs)
                        malware_threshold = 0.9 if is_trusted_sender else 0.4  # Lower threshold for malware
                        
                        if email_confidence >= malware_threshold:
                            email_status = "malware"
                            print(f"[DEBUG] Confident malware (no URLs): {email_confidence:.3f} (trusted: {is_trusted_sender})")
                        else:
                            email_status = "safe"  # Low confidence malware -> treat as safe
                            print(f"[DEBUG] Low-confidence malware (no URLs) ({email_confidence:.3f}) -> marking as safe (trusted: {is_trusted_sender})")
                    elif email_category in ['spam']:
                        # FIXED: Lower threshold for spam detection (no URLs) BUT respect trusted senders
                        spam_threshold = 0.95 if is_trusted_sender else 0.5  # Much higher threshold for trusted senders
                        
                        if email_confidence >= spam_threshold:
                            email_status = "spam"
                            print(f"[DEBUG] Confident spam (no URLs): {email_confidence:.3f} (trusted: {is_trusted_sender})")
                        else:
                            # For trusted senders, default to safe instead of spam
                            email_status = "safe" if is_trusted_sender else "safe"
                            print(f"[DEBUG] Low-confidence spam (no URLs) ({email_confidence:.3f}) -> marking as safe (trusted: {is_trusted_sender})")
                    elif email_category in ['legitimate', 'safe']:
                        # ADDED: Check for fraud keywords even if classified as legitimate (no URLs)
                        fraud_keywords = [
                            'lottery', 'won', 'million', 'prize', 'wire transfer', 'processing fee',
                            'double your money', 'guaranteed returns', 'investment opportunity',
                            'western union', 'money transfer', 'prince', 'inheritance', 'stuck in',
                            'need your help', 'legal fees', 'upfront', 'advance fee', 'beneficiary',
                            # Modern e-commerce/deal fraud indicators
                            'exclusive deal', 'specially selected', 'mega offer', 'unbeatable price',
                            'limited stock', 'offer ends', 'hurry up', 'claim now', 'original price',
                            'free shipping', 'too good to be true', 'limited time offer', 'act now',
                            'final hours', 'last chance', 'expires soon', 'flash sale', 'clearance sale',
                            # ADDED: Donation/charity fraud indicators
                            'urgent donation', 'sponsor a child', 'save a life', 'heavy heart',
                            'desperate hope', 'orphanage', 'flood devastated', 'starving', 'dying',
                            'no access', 'minimal support', 'kind souls', 'time is running out',
                            'every hour counts', 'passed away', 'donate now', 'prayers and hope',
                            'disaster relief', 'emergency appeal', 'humanitarian crisis', 'medical help',
                            'bare ground', 'untreated infection', 'forward this message', 'blessings'
                        ]
                        
                        # ADDED: Check for spam keywords even if classified as legitimate (no URLs)
                        spam_keywords = [
                            'limited time', 'act now', 'urgent', 'hurry', 'expires', 'discount',
                            'free bonus', 'special offer', 'deal sale', 'promotion', 'special promotion',
                            'guaranteed money', 'no prescription required', 'weight loss pills', 'lose weight fast',
                            'make money fast', 'work from home guaranteed', 'earn money', 'easy income', 'quick profit',
                            'casino gambling', 'gambling poker', 'slots betting', 'win money gambling',
                            'hot singles dating', 'dating meet tonight', 'lonely adults', 'adult content',
                            'cheap medications', 'generic medications', 'viagra', 'cialis', 'wholesale prices',
                            # Enhanced spam indicators
                            'make money online', 'work from home', 'no experience required', 'start earning',
                            'satisfied customers', 'click here to start', 'join thousands', 'immediately'
                        ]
                        
                        # ADDED: Check for malware keywords even if classified as legitimate (no URLs)
                        malware_keywords = [
                            'download and run', 'execute file', 'disable antivirus', 'install now',
                            'document.exe', 'urgent.exe', 'invoice.exe', 'report.exe', '.exe',
                            'free software', 'software download', 'crack', 'keygen', 'activation',
                            'virus', 'malware', 'trojan', 'suspicious-domain', 'suspicious domain',
                            # Enhanced malware indicators  
                            'security update', 'critical update', 'system vulnerable', 'security threats',
                            'mandatory patch', 'windows security', 'download immediately', 'security patch',
                            'install within', 'protect your computer', 'microsoft security'
                        ]
                        
                        text_to_check = (subject + " " + body).lower()
                        fraud_indicators = sum(1 for keyword in fraud_keywords if keyword in text_to_check)
                        spam_indicators = sum(1 for keyword in spam_keywords if keyword in text_to_check)
                        malware_indicators = sum(1 for keyword in malware_keywords if keyword in text_to_check)
                        
                        if fraud_indicators >= 2:  # At least 2 fraud keywords
                            email_status = "fraud"
                            print(f"[DEBUG] Fraud detected via keywords (no URLs) despite 'legitimate' classification. Keywords found: {fraud_indicators}")
                        elif malware_indicators >= 1:  # At least 1 malware keyword (lowered from 2)
                            email_status = "malware"
                            print(f"[DEBUG] Malware detected via keywords (no URLs) despite 'legitimate' classification. Keywords found: {malware_indicators}")
                        elif spam_indicators >= 3:  # At least 3 spam keywords (lowered from 4)
                            email_status = "spam"
                            print(f"[DEBUG] Spam detected via keywords (no URLs) despite 'legitimate' classification. Keywords found: {spam_indicators}")
                        else:
                            email_status = "safe"
                    else:
                        email_status = "safe"  # Default to safe for unknown categories with low confidence
                        print(f"[DEBUG] Unknown category (no URLs) '{email_category}' -> defaulting to safe")
                        
                    # FINAL MALWARE CHECK: Check for malware keywords across ALL categories as final security layer (no URLs)
                    malware_keywords_final = [
                        'download and run', 'execute file', 'disable antivirus', 'install now',
                    'document.exe', 'urgent.exe', 'invoice.exe', 'report.exe', '.exe',
                    'free software', 'software download', 'crack', 'keygen', 'activation',
                    'virus', 'malware', 'trojan', 'suspicious-domain', 'suspicious domain',
                    # Enhanced malware indicators  
                    'security update', 'critical update', 'system vulnerable', 'security threats',
                    'mandatory patch', 'windows security', 'download immediately', 'security patch',
                    'install within', 'protect your computer', 'microsoft security'
                ]
                
                # FINAL FRAUD CHECK: Check for fraud keywords across ALL categories as additional security layer (no URLs)
                fraud_keywords_final = [
                    'lottery', 'won', 'million', 'prize', 'wire transfer', 'processing fee',
                    'double your money', 'guaranteed returns', 'investment opportunity',
                    'western union', 'money transfer', 'prince', 'inheritance', 'stuck in',
                    'need your help', 'legal fees', 'upfront', 'advance fee', 'beneficiary',
                    # Modern e-commerce/deal fraud indicators
                    'exclusive deal', 'specially selected', 'mega offer', 'unbeatable price',
                    'limited stock', 'offer ends', 'hurry up', 'claim now', 'original price',
                    'free shipping', 'too good to be true', 'limited time offer', 'act now',
                    'final hours', 'last chance', 'expires soon', 'flash sale', 'clearance sale',
                    # ADDED: Donation/charity fraud indicators
                    'urgent donation', 'sponsor a child', 'save a life', 'heavy heart',
                    'desperate hope', 'orphanage', 'flood devastated', 'starving', 'dying',
                    'no access', 'minimal support', 'kind souls', 'time is running out',
                    'every hour counts', 'passed away', 'donate now', 'prayers and hope',
                    'disaster relief', 'emergency appeal', 'humanitarian crisis', 'medical help',
                    'bare ground', 'untreated infection', 'forward this message', 'blessings'
                ]
                
                text_to_check_final = (subject + " " + body).lower()
                malware_indicators_final = sum(1 for keyword in malware_keywords_final if keyword in text_to_check_final)
                fraud_indicators_final = sum(1 for keyword in fraud_keywords_final if keyword in text_to_check_final)
                
                # Override any classification if strong malware indicators are found
                if malware_indicators_final >= 2 and not is_trusted_sender:
                    email_status = "malware"
                    print(f"[DEBUG] FINAL MALWARE OVERRIDE (no URLs): {malware_indicators_final} malware indicators found, overriding {email_category} -> malware")
                # Override any classification if strong fraud indicators are found
                elif fraud_indicators_final >= 3 and not is_trusted_sender:  # Need 3+ fraud indicators for override
                    email_status = "fraud"
                    print(f"[DEBUG] FINAL FRAUD OVERRIDE (no URLs): {fraud_indicators_final} fraud indicators found, overriding {email_category} -> fraud")
                    
                print(f"[DEBUG] Email (no URLs) classified as: {email_category} -> {email_status}")
                
                # FINAL SAFETY CHECK: Ensure email_status is never unknown
                if email_status == "unknown":
                    email_status = "safe"
                    email_category = "legitimate"
                    print(f"[DEBUG] Fixed unknown status -> defaulting to safe")
                
            except Exception as e:
                print(f"[DEBUG] Email model failed for no-URL email: {e}")
                # Fall back to rule-based
                try:
                    from email_feature_extractor import get_email_risk_score
                    risk_score = get_email_risk_score({
                        'subject': subject,
                        'body': body, 
                        'sender': sender
                    })
                    
                    if risk_score > 0.7:
                        email_status = "phishing"
                        email_category = "phishing"
                    elif risk_score > 0.4:
                        email_status = "spam"
                        email_category = "spam"
                    else:
                        email_status = "safe"
                        email_category = "legitimate"
                        
                    email_confidence = risk_score
                except:
                    email_status = "safe"
                    email_category = "legitimate"
                    email_confidence = 0.5
        else:
            email_status = "safe"
            email_category = "legitimate"
            email_confidence = 0.5
        
        # FINAL SAFETY CHECK: Ensure email_status is never "unknown"
        if email_status == "unknown":
            print(f"[DEBUG] CRITICAL FIX: email_status was still 'unknown' - forcing to 'safe'")
            email_status = "safe"
            email_category = "legitimate"
            email_confidence = 0.5
            
        return jsonify({
            "status": email_status,
            "email_status": email_status,
            "email_category": email_category,
            "confidence": float(email_confidence),
            "links": [],
            "link_count": 0,
            "phishing_link_count": 0,
            "has_phishing": False,
            "message": "No links found in email body - analyzed content only",
            "model_used": "Email ML model" if email_model else "Rule-based",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
    
    # Scan each URL found in the email
    results = []
    has_phishing = False
    
    for url in urls:
        # Use ML model for URLs if available, otherwise use rule-based
        if url_model:
            try:
                raw_features = extract_features(url)
                
                if feature_scaler:
                    features = feature_scaler.transform([raw_features])
                else:
                    features = [raw_features]
                
                prediction = url_model.predict(features)[0]
                
                if hasattr(url_model, 'predict_proba'):
                    probability = url_model.predict_proba(features)[0][1]
                else:
                    probability = 1.0 if prediction == 1 else 0.0
                
                # Use a more balanced approach for link detection
                url_lower = url.lower()
                
                # Check for known legitimate domains first
                legitimate_domains = [
                    "google.com", "microsoft.com", "apple.com", "amazon.com", "paypal.com",
                    "ebay.com", "facebook.com", "twitter.com", "linkedin.com", "github.com",
                    "stackoverflow.com", "reddit.com", "youtube.com", "gmail.com", "outlook.com",
                    "dropbox.com", "adobe.com", "netflix.com", "spotify.com"
                ]
                
                is_legitimate = any(domain in url_lower for domain in legitimate_domains)
                
                # Start with ML model prediction
                status = "phishing" if probability > phishing_threshold else "safe"
                
                # Apply CONSERVATIVE checks for non-legitimate domains only
                if not is_legitimate:
                    suspicious_indicators = 0
                    
                    # Check for OBVIOUS phishing keywords only - much more conservative
                    strong_phishing_keywords = ["phish", "fake", "scam", "fraud", "malware", "virus"]
                    if any(keyword in url_lower for keyword in strong_phishing_keywords):
                        suspicious_indicators += 5  # Strong indicators only
                        print(f"[PHISHING] Strong phishing keyword detected: {url}")
                    
                    # Check for domain spoofing patterns (typosquatting)
                    spoofing_patterns = ["payp4l", "g00gle", "microsft", "amaz0n", "app1e", "facebok", 
                                       "microsofft", "googlle", "yahooo", "bankofamer1ca"]
                    if any(pattern in url_lower for pattern in spoofing_patterns):
                        suspicious_indicators += 4
                        print(f"[PHISHING] Domain spoofing detected: {url}")
                    
                    # Check for IP-based URLs (very suspicious)
                    if re.search(r'\d+\.\d+\.\d+\.\d+', url):
                        suspicious_indicators += 4
                        print(f"[PHISHING] IP-based URL detected: {url}")
                    
                    # Check for suspicious URL structure patterns (very conservative)
                    if len(url) > 150:  # Only very long URLs (increased from 80)
                        suspicious_indicators += 1
                        print(f"[SUSPICIOUS] Very long URL detected: {len(url)} chars")
                    
                    if url.count('.') > 5:  # Only excessive subdomains (increased from 3)
                        suspicious_indicators += 1
                        print(f"[SUSPICIOUS] Excessive subdomains: {url.count('.')} dots")
                    
                    # Check for URL encoding that might hide malicious content
                    if url.count('%') > 3:  # Multiple encoded characters
                        suspicious_indicators += 2
                        print(f"[SUSPICIOUS] Heavy URL encoding detected: {url}")
                    
                    print(f"[DEBUG] URL: {url} - Suspicious indicators: {suspicious_indicators}")
                    
                    # MUCH HIGHER threshold - need multiple strong indicators
                    if suspicious_indicators >= 4:
                        status = "phishing"
                        print(f"[PHISHING DETECTED] URL flagged with {suspicious_indicators} strong indicators: {url}")
                    else:
                        print(f"[SAFE] URL has {suspicious_indicators} indicators but below threshold: {url}")
                
                # For legitimate domains, only override if ML model is very confident
                elif is_legitimate and probability > 0.8:
                    status = "phishing"
                    
            except:
                # Fallback with CONSERVATIVE detection
                url_lower = url.lower()
                
                # Check for legitimate domains first
                legitimate_domains = [
                    "google.com", "microsoft.com", "apple.com", "amazon.com", "paypal.com",
                    "ebay.com", "facebook.com", "twitter.com", "linkedin.com", "github.com",
                    "stackoverflow.com", "reddit.com", "youtube.com", "gmail.com", "outlook.com"
                ]
                
                is_legitimate = any(domain in url_lower for domain in legitimate_domains)
                
                if is_legitimate:
                    status = "safe"  # Always trust legitimate domains
                else:
                    # Only look for OBVIOUS phishing indicators
                    strong_phishing_indicators = [
                        "phish" in url_lower,
                        "fake" in url_lower, 
                        "scam" in url_lower,
                        "fraud" in url_lower,
                        "malware" in url_lower,
                        re.search(r'\d+\.\d+\.\d+\.\d+', url),  # IP addresses
                        any(pattern in url_lower for pattern in ["payp4l", "g00gle", "microsft", "amaz0n"])
                    ]
                    
                    phishing_count = sum(strong_phishing_indicators)
                    print(f"[DEBUG FALLBACK] URL: {url} - Strong indicators: {phishing_count}")
                    
                    # Only flag if we have clear evidence
                    status = "phishing" if phishing_count > 0 else "safe"
                    if status == "phishing":
                        print(f"[PHISHING DETECTED FALLBACK] URL flagged: {url}")
        else:
            # Rule-based approach - VERY CONSERVATIVE
            url_lower = url.lower()
            
            # Check for legitimate domains
            legitimate_domains = [
                "google.com", "microsoft.com", "apple.com", "amazon.com", "paypal.com",
                "ebay.com", "facebook.com", "twitter.com", "linkedin.com", "github.com",
                "stackoverflow.com", "reddit.com", "youtube.com", "dropbox.com", "adobe.com"
            ]
            
            is_legitimate = any(domain in url_lower for domain in legitimate_domains)
            
            if is_legitimate:
                status = "safe"
            else:
                # Only check for OBVIOUS phishing indicators
                obvious_phishing = [
                    "phish" in url_lower,
                    "fake" in url_lower,
                    "scam" in url_lower, 
                    "fraud" in url_lower,
                    "malware" in url_lower,
                    re.search(r'\d+\.\d+\.\d+\.\d+', url),  # IP addresses
                    any(pattern in url_lower for pattern in ["payp4l", "g00gle", "microsft", "amaz0n", "app1e"])
                ]
                
                phishing_count = sum(obvious_phishing)
                print(f"[DEBUG RULE-BASED] URL: {url} - Obvious indicators: {phishing_count}")
                
                # Default to safe unless we have obvious evidence
                status = "phishing" if phishing_count > 0 else "safe"
                
                status = "phishing" if phishing_count > 0 else "safe"
                if status == "phishing":
                    print(f"[PHISHING DETECTED RULE-BASED] URL flagged: {url}")
        
        results.append({"url": url, "status": status})
        
        if status == "phishing":
            has_phishing = True
    
    # Email model analysis using trained model - PRIORITIZE THIS
    email_status = "unknown"
    email_category = "unknown"
    email_confidence = 0.0
    email_analysis_success = False
    
    print(f"[DEBUG] Email model available: {email_model is not None}")
    
    if email_model:
        try:
            print(f"[DEBUG] Attempting to use email model for classification...")
            
            # Check if email_feature_extractor module exists
            try:
                from email_feature_extractor import extract_email_features, get_email_risk_score
                print(f"[DEBUG] Successfully imported email feature extractor")
            except ImportError as e:
                print(f"[DEBUG] Could not import email_feature_extractor: {e}")
                print(f"[DEBUG] Falling back to basic email analysis")
                raise Exception("Email feature extractor not available")
            
            # Get email text features
            email_text = extract_email_features({
                'subject': subject,
                'body': body, 
                'sender': sender
            })
            
            print(f"[DEBUG] Extracted email features: {type(email_text)}, length: {len(email_text) if hasattr(email_text, '__len__') else 'N/A'}")
            
            # Calculate risk score as additional information
            risk_score = get_email_risk_score({
                'subject': subject,
                'body': body, 
                'sender': sender
            })
            
            print(f"[DEBUG] Email risk score: {risk_score}")
            
            # Use the trained model for prediction
            if isinstance(email_model, dict):
                model = email_model['model']  # Extract the pipeline from the model package
                print(f"[DEBUG] Using model from package: {type(model)}")
            else:
                model = email_model
                print(f"[DEBUG] Using direct model: {type(model)}")
            
            # Make prediction using the model
            email_category = model.predict([email_text])[0]
            print(f"[DEBUG] Email model prediction: {email_category}")
            
            # Get confidence scores if available
            if hasattr(model, 'predict_proba'):
                try:
                    proba = model.predict_proba([email_text])[0]
                    if isinstance(email_model, dict) and 'categories' in email_model:
                        categories = email_model['categories']
                        category_probs = dict(zip(categories, proba.tolist()))
                        email_confidence = max(proba)
                        print(f"[DEBUG] Email category probabilities: {category_probs}")
                    else:
                        email_confidence = max(proba)
                        print(f"[DEBUG] Email confidence: {email_confidence}")
                except Exception as e:
                    print(f"[DEBUG] Error getting prediction probabilities: {e}")
                    email_confidence = 0.7  # Default confidence
            else:
                email_confidence = 0.7  # Default confidence if no probabilities available
            
            print(f"[DEBUG] Email classified as: {email_category} (confidence: {email_confidence:.2f}, risk score: {risk_score:.2f})")
            
            # Map the model's category to the endpoint's status format with confidence threshold
            # CRITICAL FIX: Apply confidence threshold and sender trust to reduce false positives
            EMAIL_CONFIDENCE_THRESHOLD = 0.75  # Lowered from 0.85 for better phishing detection
            
            # Check if sender is from a trusted domain
            trusted_domains = [
                "amazon.com", "google.com", "microsoft.com", "apple.com", "github.com",
                "paypal.com", "ebay.com", "facebook.com", "twitter.com", "linkedin.com",
                "netflix.com", "spotify.com", "adobe.com", "dropbox.com", "slack.com",
                "gmail.com", "outlook.com", "yahoo.com", "mycompany.com"  # Added common legitimate domains
            ]
            
            sender_domain = sender.split('@')[-1].lower() if '@' in sender else ""
            is_trusted_sender = any(domain in sender_domain for domain in trusted_domains)
            
            if email_category in ['phishing', 'spear_phishing']:
                # Much higher bar for trusted senders - SEPARATED from fraud
                required_confidence = 0.95 if is_trusted_sender else EMAIL_CONFIDENCE_THRESHOLD
                
                if email_confidence >= required_confidence:
                    email_status = "phishing"
                    print(f"[DEBUG] High-confidence phishing detection: {email_confidence:.3f} (trusted: {is_trusted_sender})")
                else:
                    email_status = "safe"  # Low confidence phishing -> treat as safe
                    print(f"[DEBUG] Low-confidence phishing ({email_confidence:.3f}) -> marking as safe (trusted: {is_trusted_sender})")
            elif email_category in ['fraudulent', 'fraud', 'scam']:
                # FIXED: Separate fraud detection with much lower confidence threshold
                fraud_threshold = 0.9 if is_trusted_sender else 0.3  # Even lower threshold for fraud
                
                if email_confidence >= fraud_threshold:
                    email_status = "fraud"
                    print(f"[DEBUG] Confident fraud detection: {email_confidence:.3f} (trusted: {is_trusted_sender})")
                else:
                    email_status = "safe"  # Low confidence fraud -> treat as safe
                    print(f"[DEBUG] Low-confidence fraud ({email_confidence:.3f}) -> marking as safe (trusted: {is_trusted_sender})")
            elif email_category in ['malware', 'virus', 'trojan']:
                # ADDED: Malware detection logic
                malware_threshold = 0.9 if is_trusted_sender else 0.4  # Lower threshold for malware
                
                if email_confidence >= malware_threshold:
                    email_status = "malware"
                    print(f"[DEBUG] Confident malware detection: {email_confidence:.3f} (trusted: {is_trusted_sender})")
                else:
                    email_status = "safe"  # Low confidence malware -> treat as safe
                    print(f"[DEBUG] Low-confidence malware ({email_confidence:.3f}) -> marking as safe (trusted: {is_trusted_sender})")
            elif email_category in ['spam']:
                # FIXED: Lower threshold for spam detection (with URLs) BUT respect trusted senders
                spam_threshold = 0.95 if is_trusted_sender else 0.5  # Much higher threshold for trusted senders
                
                if email_confidence >= spam_threshold:
                    email_status = "spam"
                    print(f"[DEBUG] Confident spam detection: {email_confidence:.3f} (trusted: {is_trusted_sender})")
                else:
                    # For trusted senders, default to safe instead of spam
                    email_status = "safe" if is_trusted_sender else "safe"  
                    print(f"[DEBUG] Low-confidence spam ({email_confidence:.3f}) -> marking as safe (trusted: {is_trusted_sender})")
            elif email_category in ['legitimate', 'safe']:
                # ADDED: Check for fraud keywords even if classified as legitimate
                fraud_keywords = [
                    'lottery', 'won', 'million', 'prize', 'wire transfer', 'processing fee',
                    'double your money', 'guaranteed returns', 'investment opportunity',
                    'western union', 'money transfer', 'prince', 'inheritance', 'stuck in',
                    'need your help', 'legal fees', 'upfront', 'advance fee', 'beneficiary',
                    # ADDED: Modern e-commerce/deal fraud indicators
                    'exclusive deal', 'specially selected', 'mega offer', 'unbeatable price',
                    'limited stock', 'offer ends', 'hurry up', 'claim now', 'original price',
                    'free shipping', 'too good to be true', 'limited time offer', 'act now',
                    'final hours', 'last chance', 'expires soon', 'flash sale', 'clearance sale'
                ]
                
                # ADDED: Check for spam keywords even if classified as legitimate (with URLs)
                spam_keywords = [
                    'limited time', 'act now', 'urgent', 'hurry', 'expires', 'discount',
                    'free bonus', 'special offer', 'deal sale', 'promotion', 'special promotion',
                    'guaranteed money', 'no prescription required', 'weight loss pills', 'lose weight fast',
                    'make money fast', 'work from home guaranteed', 'earn money', 'easy income', 'quick profit',
                    'casino gambling', 'gambling poker', 'slots betting', 'win money gambling',
                    'hot singles dating', 'dating meet tonight', 'lonely adults', 'adult content',
                    'cheap medications', 'generic medications', 'viagra', 'cialis', 'wholesale prices',
                    # Enhanced spam indicators
                    'make money online', 'work from home', 'no experience required', 'start earning',
                    'satisfied customers', 'click here to start', 'join thousands', 'immediately'
                ]
                
                # ADDED: Check for malware keywords even if classified as legitimate (with URLs)
                malware_keywords = [
                    'download and run', 'execute file', 'disable antivirus', 'install now',
                    'document.exe', 'urgent.exe', 'invoice.exe', 'report.exe', '.exe',
                    'free software', 'software download', 'crack', 'keygen', 'activation',
                    'virus', 'malware', 'trojan', 'suspicious-domain', 'suspicious domain',
                    # Enhanced malware indicators  
                    'security update', 'critical update', 'system vulnerable', 'security threats',
                    'mandatory patch', 'windows security', 'download immediately', 'security patch',
                    'install within', 'protect your computer', 'microsoft security'
                ]
                
                text_to_check = (subject + " " + body).lower()
                fraud_indicators = sum(1 for keyword in fraud_keywords if keyword in text_to_check)
                spam_indicators = sum(1 for keyword in spam_keywords if keyword in text_to_check)
                malware_indicators = sum(1 for keyword in malware_keywords if keyword in text_to_check)
                
                if fraud_indicators >= 2:  # At least 2 fraud keywords
                    email_status = "fraud"
                    print(f"[DEBUG] Fraud detected via keywords despite 'legitimate' classification. Keywords found: {fraud_indicators}")
                elif malware_indicators >= 1:  # At least 1 malware keyword (lowered from 2)
                    email_status = "malware"
                    print(f"[DEBUG] Malware detected via keywords despite 'legitimate' classification. Keywords found: {malware_indicators}")
                elif spam_indicators >= 3:  # At least 3 spam keywords (lowered from 4)
                    email_status = "spam"
                    print(f"[DEBUG] Spam detected via keywords despite 'legitimate' classification. Keywords found: {spam_indicators}")
                else:
                    email_status = "safe"
            else:
                # Use risk score as fallback for unknown categories
                risk_threshold = 0.8 if is_trusted_sender else 0.7
                
                if risk_score > risk_threshold and email_confidence >= EMAIL_CONFIDENCE_THRESHOLD:
                    email_status = "phishing"
                    print(f"[DEBUG] High risk score with confidence: {risk_score:.3f}, {email_confidence:.3f}")
                else:
                    email_status = "safe"
                print(f"[DEBUG] Unknown category '{email_category}', using risk score fallback: {email_status}")
            
            # FINAL MALWARE CHECK: Check for malware keywords across ALL categories as final security layer
            malware_keywords_final = [
                'download and run', 'execute file', 'disable antivirus', 'install now',
                'document.exe', 'urgent.exe', 'invoice.exe', 'report.exe', '.exe',
                'free software', 'software download', 'crack', 'keygen', 'activation',
                'virus', 'malware', 'trojan', 'suspicious-domain', 'suspicious domain',
                # Enhanced malware indicators  
                'security update', 'critical update', 'system vulnerable', 'security threats',
                'mandatory patch', 'windows security', 'download immediately', 'security patch',
                'install within', 'protect your computer', 'microsoft security'
            ]
            
            # FINAL FRAUD CHECK: Check for fraud keywords across ALL categories as additional security layer
            fraud_keywords_final = [
                'lottery', 'won', 'million', 'prize', 'wire transfer', 'processing fee',
                'double your money', 'guaranteed returns', 'investment opportunity',
                'western union', 'money transfer', 'prince', 'inheritance', 'stuck in',
                'need your help', 'legal fees', 'upfront', 'advance fee', 'beneficiary',
                # Modern e-commerce/deal fraud indicators
                'exclusive deal', 'specially selected', 'mega offer', 'unbeatable price',
                'limited stock', 'offer ends', 'hurry up', 'claim now', 'original price',
                'free shipping', 'too good to be true', 'limited time offer', 'act now',
                'final hours', 'last chance', 'expires soon', 'flash sale', 'clearance sale'
            ]
            
            text_to_check_final = (subject + " " + body).lower()
            malware_indicators_final = sum(1 for keyword in malware_keywords_final if keyword in text_to_check_final)
            fraud_indicators_final = sum(1 for keyword in fraud_keywords_final if keyword in text_to_check_final)
            
            # Override any classification if strong malware indicators are found
            if malware_indicators_final >= 2 and not is_trusted_sender:
                email_status = "malware"
                print(f"[DEBUG] FINAL MALWARE OVERRIDE: {malware_indicators_final} malware indicators found, overriding {email_category} -> malware")
            # Override any classification if strong fraud indicators are found
            elif fraud_indicators_final >= 3 and not is_trusted_sender:  # Need 3+ fraud indicators for override
                email_status = "fraud"
                print(f"[DEBUG] FINAL FRAUD OVERRIDE: {fraud_indicators_final} fraud indicators found, overriding {email_category} -> fraud")
            
            email_analysis_success = True
            print(f"[DEBUG] Email model analysis SUCCESSFUL: {email_status}")
                
        except Exception as e:
            print(f"[DEBUG] Error in email model prediction: {e}")
            print(f"[DEBUG] Falling back to rule-based classification")
            email_analysis_success = False
            
    if not email_analysis_success:
        # Fall back to rule-based method if no model is available or failed
        try:
            from email_feature_extractor import get_email_risk_score
            
            # Use the risk score function with conservative thresholds
            risk_score = get_email_risk_score({
                'subject': subject,
                'body': body, 
                'sender': sender
            })
            
            # Check if sender is from a trusted domain for rule-based too
            sender_domain = sender.split('@')[-1].lower() if '@' in sender else ""
            trusted_domains = [
                "amazon.com", "google.com", "microsoft.com", "apple.com", "github.com",
                "paypal.com", "ebay.com", "facebook.com", "twitter.com", "linkedin.com",
                "netflix.com", "spotify.com", "adobe.com", "dropbox.com", "slack.com"
            ]
            is_trusted_sender = any(domain in sender_domain for domain in trusted_domains)
            
            # Much more conservative thresholds for rule-based classification
            if is_trusted_sender:
                # Very high bar for trusted senders
                if risk_score > 0.9:
                    email_status = "phishing"
                    email_category = "phishing"
                elif risk_score > 0.8:
                    email_status = "spam"
                    email_category = "spam"
                else:
                    email_status = "safe"
                    email_category = "legitimate"
            else:
                # Higher thresholds for unknown senders too
                if risk_score > 0.8:  # Increased from 0.7
                    email_status = "phishing"
                    email_category = "phishing"
                elif risk_score > 0.6:  # Increased from 0.4
                    email_status = "spam"
                    email_category = "spam"
                else:
                    email_status = "safe"
                    email_category = "legitimate"
                
            email_confidence = risk_score
            print(f"[DEBUG] Using rule-based classification. Risk score: {risk_score:.2f}, Status: {email_status}, Trusted: {is_trusted_sender}")
            
        except Exception as e:
            print(f"[DEBUG] Even rule-based classification failed: {e}")
            email_status = "unknown"
            email_category = "unknown"
            email_confidence = 0.0
    
    # CRITICAL CHANGE: Prioritize email model results over URL scanning
    # Only use URL scanning as a secondary check or when email analysis is inconclusive
    
    if email_analysis_success and email_status != "unknown":
        # Email model worked - use its results as primary
        overall_status = email_status
        print(f"[DEBUG] Using EMAIL MODEL results as primary: {overall_status}")
        
        # Only override if we find VERY suspicious URLs AND email model shows safe
        if email_status == "safe" and has_phishing:
            # Check if the phishing URLs are really suspicious
            high_confidence_phishing_urls = 0
            for result in results:
                if result["status"] == "phishing":
                    url = result["url"].lower()
                    # Only count high-confidence phishing indicators
                    if any(indicator in url for indicator in ["phish", "fake", "scam", "fraud"]) or \
                       re.search(r'\d+\.\d+\.\d+\.\d+', url):  # IP addresses
                        high_confidence_phishing_urls += 1
            
            if high_confidence_phishing_urls > 0:
                overall_status = "phishing"
                print(f"[DEBUG] Overriding email model 'safe' due to {high_confidence_phishing_urls} high-confidence phishing URLs")
    else:
        # Email analysis failed or inconclusive - fall back to URL analysis
        overall_status = "phishing" if has_phishing else "safe"
        print(f"[DEBUG] Email model failed/inconclusive - using URL analysis: {overall_status}")
        
        # Use rule-based email analysis as backup
        if email_status != "unknown":
            # Combine both signals
            if email_status == "phishing" or has_phishing:
                overall_status = "phishing"
            else:
                overall_status = "safe"
    
    print(f"[DEBUG] Final Results:")
    print(f"[DEBUG] - Links analysis: has_phishing = {has_phishing}")
    print(f"[DEBUG] - Email analysis: email_status = {email_status}")
    print(f"[DEBUG] - Overall status: {overall_status}")
    
    # For UI display, determine severity level
    if overall_status == "phishing":
        severity = "high" if email_confidence > 0.8 or has_phishing else "medium"
    elif email_status == "spam":
        severity = "medium" 
    else:
        severity = "low"
    
    # Build a more detailed response
    response = {
        "status": overall_status,
        "has_phishing": has_phishing,  # Add this for debugging
        "email_status": email_status,
        "email_category": email_category,
        "confidence": float(email_confidence),
        "severity": severity,
        "links": results,
        "link_count": len(urls),
        "phishing_link_count": sum(1 for r in results if r["status"] == "phishing"),
        "model_used": "ML model" if email_model else "Rule-based",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    print(f"[DEBUG] Response being sent: {response}")
    
    return jsonify(response)

@app.route('/auto-scan', methods=['POST', 'OPTIONS'])
def auto_scan():
    """Endpoint for automatically scanning URLs in real-time as users browse"""
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,access-control-allow-origin')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response
    
    data = request.get_json()
    urls = data.get('urls', [])
    
    if not urls:
        return jsonify({"status": "error", "message": "No URLs provided"})
    
    # Process each URL in the batch
    results = []
    
    for url in urls:
        # Skip empty URLs
        if not url:
            continue
            
        # Use the same logic from scan_link but simplified for bulk processing
        try:
            # Check for suspicious keywords
            suspicious_keywords = [
                "login", "verify", "secure", "bank", "phish", "paypal", "account",
                "update", "confirm", "password", "signin", "wallet", "reset"
            ]
            
            # Check for legitimate domains first
            legitimate_domains = [
                "google.com", "microsoft.com", "apple.com", "amazon.com", "paypal.com",
                "ebay.com", "facebook.com", "twitter.com", "linkedin.com", "github.com"
            ]
            
            is_legitimate_domain = any(domain in url.lower() for domain in legitimate_domains)
            url_is_suspicious = False
            
            # Only flag suspicious keywords for non-legitimate domains
            if not is_legitimate_domain:
                url_is_suspicious = any(keyword in url.lower() for keyword in suspicious_keywords)
            
            # Use ML model if available
            if url_model:
                raw_features = extract_features(url)
                
                if feature_scaler:
                    features = feature_scaler.transform([raw_features])
                else:
                    features = [raw_features]
                
                prediction = url_model.predict(features)[0]
                
                if hasattr(url_model, 'predict_proba'):
                    probability = url_model.predict_proba(features)[0][1]
                else:
                    probability = 1.0 if prediction == 1 else 0.0
                
                # Apply conservative boost system only for non-legitimate domains
                boost = 0.0
                
                if not is_legitimate_domain:
                    if url_is_suspicious:
                        boost += 0.2
                    
                    if len(url) > 100:  # Very long URLs
                        boost += 0.1
                    
                    if re.search(r'\d+\.\d+\.\d+\.\d+', url):  # IP-based URLs
                        boost += 0.3
                    
                    if url.count('.') > 4:  # Too many subdomains
                        boost += 0.1
                
                # Apply the boost
                probability = min(1.0, probability + boost)
                
                # Conservative threshold for auto-scanning
                effective_threshold = phishing_threshold  # Use trained threshold
                
                # Determine result with balanced criteria
                is_phishing = False
                
                if not is_legitimate_domain:
                    is_phishing = any([
                        probability > effective_threshold,
                        prediction == 1,
                        (url_is_suspicious and len(url) > 80),  # Suspicious keywords + long URL
                        "phish" in url.lower(),  # Obvious phishing term
                        re.search(r'\d+\.\d+\.\d+\.\d+', url),  # IP-based URLs
                        (url.count('.') > 4 and url_is_suspicious)  # Many subdomains + suspicious
                    ])
                
                status = "phishing" if is_phishing else "safe"
                
                results.append({
                    "url": url,
                    "status": status,
                    "confidence": float(probability)
                })
                
            else:
                # Use rule-based fallback
                status = "phishing" if url_is_suspicious else "safe"
                results.append({
                    "url": url,
                    "status": status,
                    "confidence": 0.0
                })
                
        except Exception as e:
            # If any error occurs for a specific URL, mark it as safe
            # to avoid disrupting the user's browsing
            results.append({
                "url": url,
                "status": "error",
                "error": str(e)
            })
    
    from datetime import datetime
    return jsonify({
        "status": "success",
        "results": results,
        "urls_processed": len(results),
        "timestamp": str(datetime.now())
    })

@app.route('/test', methods=['GET'])
def test_endpoint():
    """Simple endpoint to test if the API is working"""
    return jsonify({
        "status": "ok",
        "message": "ShieldBox API is running",
        "model_loaded": url_model is not None,
        "email_model_loaded": email_model is not None,
        "features_available": True
    })

@app.route('/scan-email-content', methods=['POST', 'OPTIONS'])
def scan_email_content():
    """
    Dedicated endpoint for scanning email content ONLY (ignores URLs within email)
    This focuses purely on email classification using the trained model
    """
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,access-control-allow-origin')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response
    
    data = request.get_json()
    subject = data.get('subject', '')
    sender = data.get('sender', '')
    body = data.get('body', '')
    
    print(f"[DEBUG] Email content scan - Subject: '{subject}', Sender: '{sender}'")
    print(f"[DEBUG] Email body length: {len(body)} characters")
    
    # Focus purely on email content analysis
    email_status = "unknown"
    email_category = "unknown"
    email_confidence = 0.0
    analysis_method = "none"
    
    if email_model:
        try:
            print(f"[DEBUG] Using trained email model for classification...")
            
            from email_feature_extractor import extract_email_features, get_email_risk_score
            
            # Get email text features for the trained model
            email_text = extract_email_features({
                'subject': subject,
                'body': body, 
                'sender': sender
            })
            
            print(f"[DEBUG] Extracted email text length: {len(email_text)}")
            
            # Use the trained model for prediction
            if isinstance(email_model, dict):
                model = email_model['model']
                print(f"[DEBUG] Using packaged model: {type(model)}")
            else:
                model = email_model
                print(f"[DEBUG] Using direct model: {type(model)}")
            
            # Make prediction
            email_category = model.predict([email_text])[0]
            print(f"[DEBUG] Email model prediction: {email_category}")
            
            # Get confidence scores
            if hasattr(model, 'predict_proba'):
                proba = model.predict_proba([email_text])[0]
                email_confidence = max(proba)
                print(f"[DEBUG] Email confidence: {email_confidence:.3f}")
            else:
                email_confidence = 0.7
            
            # Map category to status
            if email_category in ['phishing', 'fraudulent', 'spear_phishing']:
                email_status = "phishing"
            elif email_category in ['spam']:
                email_status = "spam"
            elif email_category in ['legitimate', 'safe']:
                email_status = "safe"
            else:
                email_status = "unknown"
            
            analysis_method = "ml_model"
            print(f"[DEBUG] Email classified as: {email_category} -> {email_status} (confidence: {email_confidence:.3f})")
            
        except Exception as e:
            print(f"[DEBUG] Email model failed: {e}")
            # Fall back to rule-based
            try:
                from email_feature_extractor import get_email_risk_score
                
                risk_score = get_email_risk_score({
                    'subject': subject,
                    'body': body, 
                    'sender': sender
                })
                
                # Classify based on risk score
                if risk_score > 0.7:
                    email_status = "phishing"
                    email_category = "phishing"
                elif risk_score > 0.4:
                    email_status = "spam"
                    email_category = "spam"
                else:
                    email_status = "safe"
                    email_category = "legitimate"
                    
                email_confidence = risk_score
                analysis_method = "rule_based"
                print(f"[DEBUG] Rule-based classification: {email_status} (risk score: {risk_score:.3f})")
                
            except Exception as e2:
                print(f"[DEBUG] Both ML and rule-based failed: {e2}")
                email_status = "error"
                email_category = "error"
                analysis_method = "failed"
    else:
        print(f"[DEBUG] No email model available")
        email_status = "error"
        email_category = "no_model"
        analysis_method = "unavailable"
    
    # Return pure email content analysis results
    response = {
        "status": email_status,
        "category": email_category,
        "confidence": float(email_confidence),
        "analysis_method": analysis_method,
        "model_used": "Email ML model" if analysis_method == "ml_model" else analysis_method,
        "email_length": len(body),
        "subject_length": len(subject),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    print(f"[DEBUG] Email content analysis result: {response}")
    return jsonify(response)

@app.route('/scan-email', methods=['POST', 'OPTIONS'])
def scan_email():
    """Endpoint to scan an email for phishing"""
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,access-control-allow-origin')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response
    
    # Get the email content from the request
    data = request.get_json()
    email_content = data.get('email_content', '')
    subject = data.get('subject', '')
    sender = data.get('sender', '')
    
    print(f"[ShieldBox] Email scan requested: Subject: '{subject}', Content length: {len(email_content)}")
    
    if not email_content:
        return jsonify({
            "status": "error", 
            "message": "No email content provided"
        })
    
    # Log the request
    print(f"[{datetime.now()}] Email scan request received - Subject: {subject}")
    
    # Extract features from the email content using the PROPER email feature extractor
    from email_feature_extractor import extract_email_features as proper_extract_email_features
    
    # Use the correct feature extractor that matches the trained model
    email_data = {
        "subject": subject,
        "sender": sender, 
        "body": email_content
    }
    
    # Check if we can use the email ML model
    if email_model:
        try:
            print(f"[DEBUG] Email model type: {type(email_model)}")
            print(f"[DEBUG] Email model attributes: {dir(email_model)[:10]}...")  # Show first 10 attributes
            
            # Extract proper features using the trained feature extractor
            processed_text = proper_extract_email_features(email_data)
            print(f"[DEBUG] Processed email text length: {len(processed_text)}")
            print(f"[DEBUG] Processed text sample: {processed_text[:100]}...")
            
            # The email model expects TF-IDF features, not raw features
            # Let's check if it's a pipeline (which it should be)
            if hasattr(email_model, 'predict'):
                # Use the model to predict the class - it should handle TF-IDF internally
                prediction = email_model.predict([processed_text])[0]
                probabilities = email_model.predict_proba([processed_text])[0]
                
                # Get the category and confidence
                category = EMAIL_CATEGORIES[prediction] if prediction < len(EMAIL_CATEGORIES) else "unknown"
                confidence = max(probabilities)
                
                print(f"[DEBUG] Email model prediction: {prediction}, category: {category}, confidence: {confidence}")
                
                # Get key features that influenced the decision
                key_features = get_key_email_features(email_content, subject, category)
                
                # Map categories to our expected format
                if category in ["phishing", "fraudulent", "scam"]:
                    final_status = "fraud"
                elif category in ["spam"]:
                    final_status = "spam"
                elif category in ["malware"]:
                    final_status = "malware"
                elif category in ["legitimate", "safe"]:
                    final_status = "safe"
                else:
                    final_status = "safe"  # Default to safe for unknown
                
                print(f"[DEBUG] ML Model Result - Category: {category} -> Final Status: {final_status}, Confidence: {confidence}")
                
                return jsonify({
                    "status": final_status,
                    "email_status": final_status,
                    "category": category,
                    "confidence": float(confidence),
                    "key_features": key_features,
                    "classification_method": "ML_Model"
                })
            else:
                print(f"[DEBUG] Email model doesn't have predict method")
                
        except Exception as e:
            print(f"Error using email model: {e}")
            print(f"[DEBUG] Full error details: {type(e).__name__}: {str(e)}")
            # Fall back to the enhanced keyword-based system
    
    # If we don't have a model or it failed, use basic checks
    result = basic_email_check(email_content, subject, sender)
    return jsonify(result)

def extract_email_features(content, subject, sender):
    """Extract features from email content for classification"""
    # This is a placeholder - in production, you would use a proper feature extractor
    features = [0] * 10  # Create a fixed-size feature vector
    
    # Simple feature extraction based on content
    lowercase_content = content.lower()
    lowercase_subject = subject.lower()
    
    # Count suspicious words
    suspicious_words = ["urgent", "verify", "account", "password", "click", "link", 
                       "login", "confirm", "bank", "update", "security"]
    
    for i, word in enumerate(suspicious_words[:5]):
        features[i] = lowercase_content.count(word) + lowercase_subject.count(word) * 2
    
    # Check for suspicious patterns
    features[5] = 1 if re.search(r'https?://bit\.ly|goo\.gl|tinyurl\.com', content) else 0
    features[6] = len(re.findall(r'https?://[^\s]+', content))
    features[7] = 1 if re.search(r'password|credential|username|login|ssn|social security', 
                                 lowercase_content, re.IGNORECASE) else 0
    
    # Analyze sender
    features[8] = 0 if '@' in sender and '.' in sender.split('@')[1] else 1
    features[9] = 1 if 'no-reply' in sender or 'noreply' in sender else 0
    
    return features

def get_key_email_features(content, subject, category):
    """Extract key features that influenced the classification"""
    features = []
    
    # Add relevant features based on category
    if category in ["phishing", "fraud"]:
        if re.search(r'urgent|immediate|attention required', subject, re.IGNORECASE):
            features.append("Urgent language in subject")
            
        if re.search(r'verify your account|confirm your details', content, re.IGNORECASE):
            features.append("Requests account verification")
            
        if re.search(r'click here|click the link|follow this link', content, re.IGNORECASE):
            features.append("Pressuring to click links")
            
        if re.search(r'password|login credentials|username', content, re.IGNORECASE):
            features.append("Requests sensitive information")
            
        urls = re.findall(r'https?://[^\s]+', content)
        if any('bit.ly' in url or 'goo.gl' in url or 'tinyurl' in url for url in urls):
            features.append("Contains shortened URLs")
            
        if re.search(r'bank account|credit card|payment|billing', content, re.IGNORECASE):
            features.append("References financial information")
    
    elif category == "spam":
        if re.search(r'offer|free|deal|discount|save|buy|purchase|limited time', content, re.IGNORECASE):
            features.append("Contains promotional language")
            
        if re.search(r'unsubscribe|opt[ -]?out', content, re.IGNORECASE):
            features.append("Contains unsubscribe option")
            
    elif category == "legitimate":
        features.append("No suspicious patterns detected")
        
    # Limit to top 3 features if we have more
    return features[:3]

def basic_email_check(content, subject, sender):
    """Perform basic checks on the email content to detect phishing and classify email type"""
    lowercase_content = content.lower()
    lowercase_subject = subject.lower()
    
    # Initialize scores for different categories
    phishing_score = 0
    fraud_score = 0
    spam_score = 0
    malware_score = 0
    key_features = []
    
    # Check for phishing indicators
    phishing_terms = ["verify", "account", "login", "password", "click", "confirm"]
    for term in phishing_terms:
        if term in lowercase_content or term in lowercase_subject:
            phishing_score += 1
            
    if re.search(r'password|login credentials|username|account verification', lowercase_content, re.IGNORECASE):
        phishing_score += 2
        key_features.append("Requests sensitive information")
    
    # Check for fraud indicators
    fraud_terms = ["money", "bank", "transfer", "urgently", "wire", "western union", "transaction"]
    for term in fraud_terms:
        if term in lowercase_content or term in lowercase_subject:
            fraud_score += 1
    
    if re.search(r'bank account|send money|transfer funds|payment|inheritance', lowercase_content, re.IGNORECASE):
        fraud_score += 2
        key_features.append("Solicits financial transaction")
    
    # Check for spam indicators
    spam_terms = ["offer", "free", "discount", "save", "limited time", "deal", "buy", "sale"]
    for term in spam_terms:
        if term in lowercase_content or term in lowercase_subject:
            spam_score += 1
    
    if re.search(r'unsubscribe|opt[ -]?out|marketing|newsletter|buy now|special offer', lowercase_content, re.IGNORECASE):
        spam_score += 1
        key_features.append("Marketing/promotional content")
    
    # Check for malware indicators
    malware_terms = ["attachment", "download", "exe", "zip", "file", "invoice", "document"]
    for term in malware_terms:
        if term in lowercase_content or term in lowercase_subject:
            malware_score += 1
    
    # Check for suspicious links
    urls = re.findall(r'https?://[^\s]+', content)
    shortened_urls = [url for url in urls if any(short in url for short in ['bit.ly', 'goo.gl', 'tinyurl'])]
    
    if shortened_urls:
        phishing_score += 1
        key_features.append("Contains shortened URLs")
    
    # Check for urgent language (common in phishing and fraud)
    urgent_terms = ["urgent", "immediate", "attention required", "alert", "important", "immediately"]
    if any(term in lowercase_subject for term in urgent_terms):
        phishing_score += 1
        fraud_score += 1
        key_features.append("Urgent language in subject")
    
    # Determine the category based on highest score
    scores = {
        "phishing": phishing_score,
        "fraud": fraud_score,
        "spam": spam_score,
        "malware": malware_score
    }
    
    # Get the category with the highest score
    max_category = max(scores, key=scores.get)
    max_score = scores[max_category]
    
    # Calculate confidence (scale score to 0-1 range)
    confidence = min(max_score / 5.0, 0.95)  # Cap at 0.95
    
    # If the highest score is too low, consider it legitimate
    if max_score < 2:
        return {
            "status": "safe",
            "category": "legitimate",
            "confidence": 0.8,
            "key_features": ["No suspicious patterns detected"]
        }
    
    # Add category-specific features
    if max_category == "phishing":
        if not key_features:
            key_features.append("Contains phishing indicators")
        return {
            "status": "phishing",
            "category": "phishing",
            "confidence": confidence,
            "key_features": key_features[:3]
        }
    elif max_category == "fraud":
        if not key_features:
            key_features.append("Contains fraud indicators")
        return {
            "status": "phishing",  # Still mark as phishing for status, but with fraud category
            "category": "fraud",
            "confidence": confidence,
            "key_features": key_features[:3]
        }
    elif max_category == "spam":
        if not key_features:
            key_features.append("Contains promotional content")
        return {
            "status": "safe",  # Spam is annoying but not necessarily harmful
            "category": "spam",
            "confidence": confidence,
            "key_features": key_features[:3]
        }
    elif max_category == "malware":
        if not key_features:
            key_features.append("Potential malicious attachments or downloads")
        return {
            "status": "phishing",  # Mark as phishing for status, but with malware category
            "category": "malware",
            "confidence": confidence,
            "key_features": key_features[:3]
        }

if __name__ == '__main__':
    print("ShieldBox backend starting...")
    print("API will be available at http://127.0.0.1:5000/")
    print("Test endpoint: http://127.0.0.1:5000/test")
    app.run(debug=True, host="127.0.0.1", port=5000)
