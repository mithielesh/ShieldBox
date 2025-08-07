"""
Email classification model training script for ShieldBox extension.
This script processes email datasets to train a model that can classify emails into multiple categories.
"""

import pandas as pd
import numpy as np
import re
import os
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from sklearn.pipeline import Pipeline
from sklearn.multiclass import OneVsRestClassifier
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb
from datetime import datetime

# Email categories to classify
EMAIL_CATEGORIES = [
    "phishing",       # Phishing attempts
    "spam",           # General spam
    "legitimate",     # Legitimate emails
    "malware",        # Emails with potential malware links
    "scam",           # Scam emails (different from phishing)
    "spear_phishing", # Targeted phishing
    "fraudulent",     # Fraudulent emails (e.g., Nigerian prince)
    "safe"            # Safe emails (alternate name for legitimate)
]

print("Starting email model training...")
print(f"Target categories: {', '.join(EMAIL_CATEGORIES)}")

# Define datasets and their default categories
DATASETS = {
    "phishing_email.csv": "phishing",
    "CEAS_08.csv": "spam",
    "Enron.csv": "legitimate",
    "Ling.csv": "legitimate",
    "Nazario.csv": "phishing",
    "Nigerian_Fraud.csv": "fraudulent",
    "SpamAssasin.csv": "spam"
}

# Function to extract email features
def extract_email_features(email_data):
    """
    Extract features from email content for classification.
    Args:
        email_data: Dictionary with subject, sender, body, etc.
    Returns:
        String containing preprocessed email text
    """
    # Combine subject and body if available
    text = ""
    
    if 'subject' in email_data and email_data['subject']:
        text += email_data['subject'] + " "
    
    if 'body' in email_data and email_data['body']:
        text += email_data['body']
    
    # If text is empty or None, return empty string
    if not text:
        return ""
    
    # Normalize text
    text = text.lower()
    
    # Remove URLs - we'll handle them separately
    url_regex = r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+'
    text = re.sub(url_regex, " URL ", text)
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

# Function to load and process datasets
def load_datasets(dataset_folder):
    """
    Load datasets from folder and prepare for training.
    """
    print(f"Loading datasets from: {dataset_folder}")
    
    all_data = []
    dataset_sizes = {}
    
    # Process each dataset file
    for filename, default_category in DATASETS.items():
        file_path = os.path.join(dataset_folder, filename)
        
        if not os.path.exists(file_path):
            print(f"Warning: Dataset file {filename} not found, skipping.")
            continue
        
        print(f"Processing {filename}...")
        
        try:
            # First try to read with common CSV formats
            try:
                # Use on_bad_lines='skip' instead of error_bad_lines=False (deprecated)
                df = pd.read_csv(file_path, encoding='utf-8', on_bad_lines='skip')
            except:
                # If the standard read fails, try with different encoding
                df = pd.read_csv(file_path, encoding='latin1', on_bad_lines='skip')
            
            # Check for required columns or use defaults
            if 'body' not in df.columns:
                if 'content' in df.columns:
                    df['body'] = df['content']
                elif 'text' in df.columns:
                    df['body'] = df['text']
                elif 'message' in df.columns:
                    df['body'] = df['message']
                elif 'email' in df.columns:
                    df['body'] = df['email']
                elif len(df.columns) > 0:
                    # If no obvious body column, use the first column
                    df['body'] = df[df.columns[0]]
                else:
                    df['body'] = ""
                    
            if 'subject' not in df.columns:
                if 'subject_line' in df.columns:
                    df['subject'] = df['subject_line']
                else:
                    df['subject'] = ""
                
            # Add category based on the dataset source
            if 'category' not in df.columns:
                df['category'] = default_category
                
            # Basic preprocessing - handle NaN values
            df['body'] = df['body'].fillna("")
            df['subject'] = df['subject'].fillna("")
            
            # Create combined text field for classification
            df['email_text'] = df.apply(
                lambda row: extract_email_features({
                    'subject': row['subject'], 
                    'body': row['body']
                }), 
                axis=1
            )
            
            # Add sampling if datasets are very large - use smaller samples for faster training
            if len(df) > 2000:
                print(f"  Dataset is large ({len(df)} records), sampling 2000 records")
                df = df.sample(2000, random_state=42)
                
            dataset_sizes[filename] = len(df)
            all_data.append(df[['email_text', 'category']])
            
        except Exception as e:
            print(f"Error processing {filename}: {str(e)}")
    
    # Combine all datasets
    if not all_data:
        raise ValueError("No datasets could be loaded. Check file paths and formats.")
        
    combined_data = pd.concat(all_data, ignore_index=True)
    print(f"Dataset loading complete. Total samples: {len(combined_data)}")
    
    # Print category distribution
    print("\nCategory distribution:")
    for category, count in combined_data['category'].value_counts().items():
        print(f"  {category}: {count} emails")
        
    return combined_data

# Main training function
def train_email_model(data):
    """Train the email classification model using the provided data"""
    print("\nPreparing data for training...")
    
    # Split data into features and target
    X = data['email_text']
    y = data['category']
    
    # Split into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print(f"Training set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    # Create a pipeline with TF-IDF vectorization and RandomForest classifier
    print("\nTraining model using RandomForest...")
    
    # Use RandomForest directly since it's more stable for this task
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=3000, ngram_range=(1, 2))),
        ('classifier', OneVsRestClassifier(RandomForestClassifier(
            n_estimators=100, 
            max_depth=None,
            random_state=42,
            n_jobs=-1  # Use all cores
        )))
    ])
    
    pipeline.fit(X_train, y_train)
    model_type = "RandomForest"
    
    # Evaluate the model
    print("\nEvaluating model...")
    y_pred = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {accuracy:.4f}")
    
    # Print detailed classification report
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Package the model
    model_package = {
        'model': pipeline,
        'accuracy': accuracy,
        'model_type': model_type,
        'categories': list(set(y)),
        'training_date': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'samples': len(X)
    }
    
    return model_package

# Function to extract features from a new email for prediction
def email_feature_extractor(email_data):
    """
    Extract features from email for the trained model.
    This function will be used in production.
    """
    return extract_email_features(email_data)

# Main execution
if __name__ == "__main__":
    try:
        # Define datasets folder
        dataset_folder = "Dataset for email analyses"
        
        # Load and process datasets
        email_data = load_datasets(dataset_folder)
        
        # Train the model
        model_package = train_email_model(email_data)
        
        # Save the model
        output_path = "email_model.pkl"
        joblib.dump(model_package, output_path)
        
        print(f"\nModel training complete!")
        print(f"Model saved to {output_path}")
        print(f"Accuracy: {model_package['accuracy']:.4f}")
        print(f"Model type: {model_package['model_type']}")
        print(f"Categories: {', '.join(model_package['categories'])}")
        
        # Also save the feature extractor function
        feature_extractor_code = """
def extract_email_features(email_data):
    \"\"\"
    Extract features from email content for classification.
    Args:
        email_data: Dictionary with subject, sender, body, etc.
    Returns:
        String containing preprocessed email text
    \"\"\"
    import re
    
    # Combine subject and body if available
    text = ""
    
    if 'subject' in email_data and email_data['subject']:
        text += email_data['subject'] + " "
    
    if 'body' in email_data and email_data['body']:
        text += email_data['body']
    
    # If text is empty or None, return empty string
    if not text:
        return ""
    
    # Normalize text
    text = text.lower()
    
    # Remove URLs - we'll handle them separately
    url_regex = r'https?://(?:[-\\w.]|(?:%[\\da-fA-F]{2}))+' 
    text = re.sub(url_regex, " URL ", text)
    
    # Remove extra whitespace
    text = re.sub(r'\\s+', ' ', text).strip()
    
    return text
"""
        
        with open("email_feature_extractor.py", "w") as f:
            f.write(feature_extractor_code)
        
        print("Email feature extractor function saved to email_feature_extractor.py")
        
    except Exception as e:
        print(f"Error in training process: {str(e)}")
