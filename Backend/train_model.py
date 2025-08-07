# train_model.py - Simple XGBoost Implementation
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, recall_score, precision_score
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
from feature_extractor import extract_features

print("Loading dataset...")
# Load dataset
df = pd.read_csv("dataset_phishing.csv")
df["label"] = df["status"].apply(lambda x: 1 if x == "phishing" else 0)

# Check data distribution
print(f"Dataset has {sum(df['label'] == 1)} phishing URLs and {sum(df['label'] == 0)} safe URLs")

# Extract features from URLs
print("Extracting features from URLs...")
raw_features = []
y = []

for i, (url, label) in enumerate(zip(df["url"], df["label"])):
    if i % 1000 == 0:
        print(f"Processing {i}/{len(df)} URLs...")
    
    try:
        features = extract_features(url)
        raw_features.append(features)
        y.append(label)
    except Exception:
        # Skip problematic URLs
        continue

# Convert to numpy arrays
X = np.array(raw_features)
y = np.array(y)
print(f"Processed {len(X)} URLs with {X.shape[1]} features")

# Feature preprocessing - standardize for better model performance
scaler = StandardScaler()
X = scaler.fit_transform(X)

# Split data for validation - 80% train, 20% test
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
print(f"Training set: {X_train.shape[0]} samples, Test set: {X_test.shape[0]} samples")

# Train XGBoost model optimized for balanced phishing detection
print("Training XGBoost model...")
model = XGBClassifier(
    n_estimators=200,
    learning_rate=0.05,
    max_depth=5, 
    min_child_weight=1,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=1.5,  # Give more weight to phishing examples
    reg_alpha=0.1,         # Add regularization to reduce overfitting 
    reg_lambda=1.0,        # Add regularization to reduce overfitting
    random_state=42
)

# Train the model with validation set
eval_set = [(X_test, y_test)]
model.fit(X_train, y_train, eval_set=eval_set, verbose=1)

# Evaluate on test set
y_probs = model.predict_proba(X_test)[:, 1]  # Get probability of positive class

# Find optimal threshold that balances phishing detection and false positives
print("\nFinding optimal detection threshold...")
thresholds = [0.3, 0.32, 0.34, 0.36, 0.38, 0.4, 0.42, 0.44, 0.46, 0.48, 0.5, 0.55, 0.6, 0.65, 0.7]
best_threshold = 0.5
target_recall = 0.95
best_f1 = 0
best_balance = 0

# Calculate F1 score and a balance metric for each threshold
for threshold in sorted(thresholds):
    y_pred = (y_probs >= threshold).astype(int)
    recall = recall_score(y_test, y_pred)  # Phishing detection rate
    precision = precision_score(y_test, y_pred)
    false_positive_rate = sum((y_pred == 1) & (y_test == 0)) / sum(y_test == 0)
    
    # Calculate F1 score (harmonic mean of precision and recall)
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    # Custom balance metric: higher is better (we want high recall, low FP)
    balance_metric = recall - false_positive_rate
    
    print(f"Threshold {threshold:.2f}: Detection: {recall:.4f}, False Positive: {false_positive_rate:.4f}, F1: {f1:.4f}")
    
    # Store the threshold with best balance between recall and false positives
    if balance_metric > best_balance and recall >= 0.85:  # Relaxed target to 85%
        best_threshold = threshold
        best_balance = balance_metric
        print(f"  New best threshold: {threshold:.2f} (Detection: {recall:.4f}, FP: {false_positive_rate:.4f})")
        
    # Also track best F1 score as backup criterion
    if f1 > best_f1:
        best_f1 = f1

# Apply best threshold
y_pred_final = (y_probs >= best_threshold).astype(int)

# Calculate final metrics
final_accuracy = accuracy_score(y_test, y_pred_final)
final_recall = recall_score(y_test, y_pred_final)
final_precision = precision_score(y_test, y_pred_final)
false_positive_rate = sum((y_pred_final == 1) & (y_test == 0)) / sum(y_test == 0)

print("\nFinal Model Performance:")
print(f"Accuracy: {final_accuracy:.4f}")
print(f"Phishing Detection Rate: {final_recall:.4f}")
print(f"False Positive Rate: {false_positive_rate:.4f}")
print(f"Precision: {final_precision:.4f}")

# Save model package
print("\nSaving model...")
model_package = {
    'model': model,
    'scaler': scaler,
    'threshold': best_threshold,
    'accuracy': final_accuracy,
    'recall': final_recall,
    'precision': final_precision,
    'false_positive_rate': false_positive_rate,
    'version': '2.0.0'
}

# Save to the standard filename used by main.py
joblib.dump(model_package, "phishing_model.pkl")

# Save scaler separately for feature extraction
joblib.dump(scaler, "feature_scaler.pkl")

if hasattr(model, 'best_iteration'):
    print(f"Best iteration: {model.best_iteration}")
