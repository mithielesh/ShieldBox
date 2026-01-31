# ShieldBox

---

## Overview

ShieldBox is a machine-learning-powered browser extension designed to secure web-based email environments against advanced phishing, malware, and social engineering attacks. Unlike static blacklist filters, ShieldBox utilizes real-time natural language processing (NLP) and behavioral analysis to evaluate the intent and safety of incoming communications.

The system integrates directly into the browser DOM to provide seamless, context-aware security analysis without disrupting the user workflow.

---

## Architecture & Threat Detection

ShieldBox operates on a hybrid client-server architecture. The browser client handles DOM extraction and user interaction, while the Python backend executes heavy-duty inference using trained classification models.

### 1. Dual-Engine Analysis
The platform employs two distinct modeling approaches for comprehensive coverage:
* **Contextual Email Analysis:** A RandomForest classifier utilizing TF-IDF vectorization to detect semantic indicators of fraud, spear-phishing, and spam within the email body.
* **Heuristic URL Scanning:** An XGBoost classifier analyzing URL lexical features to identify zero-day phishing links and obfuscated redirection attacks.

### 2. Real-Time Intervention
Analysis occurs in real-time as emails are opened. The system injects visual security indicators directly into the UI, providing immediate feedback (Safe, Suspicious, Malicious) based on confidence scoring.

---

## Technology Stack

### Core Engine & ML
<p align="left">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Scikit_Learn-F7931E?style=flat&logo=scikit-learn&logoColor=white" alt="Scikit Learn" />
  <img src="https://img.shields.io/badge/XGBoost-15B550?style=flat" alt="XGBoost" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI" />
</p>

### Browser Extension
<p align="left">
  <img src="https://img.shields.io/badge/JavaScript_ES6+-F7DF1E?style=flat&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Chrome_Extension_API-4285F4?style=flat&logo=google-chrome&logoColor=white" alt="Chrome API" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white" alt="CSS3" />
</p>

### Infrastructure & Processing
<p align="left">
  <img src="https://img.shields.io/badge/Uvicorn-000000?style=flat" alt="Uvicorn" />
  <img src="https://img.shields.io/badge/JSON_Serialization-000000?style=flat&logo=json&logoColor=white" alt="JSON" />
  <img src="https://img.shields.io/badge/DOM_Manipulation-4B0082?style=flat" alt="DOM Manipulation" />
</p>

---

## Capabilities

### Automated Threat Classification
The system classifies incoming data into granular security tiers:
* **Phishing/Spear-Phishing:** Credential harvesting and impersonation attempts.
* **Malware/Fraud:** Payload delivery vectors and financial scams.
* **Spam:** Unsolicited bulk messaging.
* **Legitimate:** Verified safe communication.

### On-Demand Forensics
Beyond automatic scanning, ShieldBox offers a "Floating Security Panel" allowing users to manually trigger deep scans on specific URLs or email bodies, providing detailed probability scores for potential threats.

---

## Installation

### Backend Services
The machine learning inference engine requires a local Python environment.

```bash
cd Backend
pip install -r requirements.txt
python main.py
```

---

## Browser Extension
1.  Navigate to `chrome://extensions/` in your browser.
2.  Enable **Developer Mode** in the top-right corner.
3.  Click **Load Unpacked** and select the `/extension` directory from the project root.

---

## Testing & Validation

The system includes a comprehensive suite of test cases to validate both model accuracy and UI responsiveness.

* **Model Validation:** The `Backend/` directory contains specific scripts for training and validating the XGBoost and RandomForest models against a stratified 20% validation split.
* **Integration Tests:** The `testcases/` folder includes HTML simulations designed to verify the extension's DOM injection logic and error handling capabilities in a controlled environment.

---

## License

This project is open-source software designed for educational and security research purposes.
Distributed under the **MIT License**.
