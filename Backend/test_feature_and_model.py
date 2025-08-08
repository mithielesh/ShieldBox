import joblib
from feature_extractor import extract_features
import random

# Load model and scaler
model_package = joblib.load("phishing_model.pkl")
model = model_package['model']
scaler = model_package['scaler']
threshold = model_package['threshold']

# 10 phishing and 10 safe URLs (jumbled)
test_urls = [
    # Phishing
    "http://paypal-login-security-alert.com/verify?user=abc",
    "http://secure-update-account.com/login",
    "http://appleid-verify.com/security",
    "http://bankofamerica-alerts.com/confirm",
    "http://microsoft-support-login.com/reset",
    "http://amazon-billing-center.com/update",
    "http://netflix-account-verify.com/validate",
    "http://chasebank-login-alert.com/authenticate",
    "http://citibank-security-check.com/verify-account",
    "http://wellsfargo-customer-support.com/validate",
    "http://instagram.recovery-helpcenter.org",  # new phishing test
    # Safe
    "https://www.google.com/",
    "https://www.wikipedia.org/",
    "https://www.openai.com/",
    "https://www.python.org/",
    "https://www.microsoft.com/",
    "https://www.apple.com/",
    "https://www.amazon.com/",
    "https://www.netflix.com/",
    "https://www.chase.com/",
    "https://www.citibank.com/",
    "https://www.wellsfargo.com/"
]

random.shuffle(test_urls)

for url in test_urls:
    features = extract_features(url)
    print(f"\nURL: {url}")
    print(f"Feature vector: {features}")
    X = scaler.transform([features])
    prob = model.predict_proba(X)[0][1]
    print(f"Predicted phishing probability: {prob:.4f}")
    print(f"Classified as: {'phishing' if prob >= threshold else 'safe'} (threshold={threshold})")
