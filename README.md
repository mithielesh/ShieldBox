## 🔮 Future Work

We plan to extend ShieldBox with IoT-based alerting. The system will connect to an ESP32 microcontroller, which will relay email security alerts to:
- A set of LEDs (for visual threat indication)
- A voice module (for spoken warnings)
- An LCD display (for real-time alert messages)

This integration will enable physical, real-world notifications for critical email threats, making ShieldBox even more effective for high-security environments.
## 🧩 Testcases & Debugging

The `testcases/` folder contains a comprehensive set of scripts and HTML files used to debug, validate, and improve the ShieldBox classification system. It includes:
- Python scripts for testing email and URL classification, edge cases, and fraud/spam/malware detection
- HTML/JS files for simulating extension UI and Chrome integration
- Specialized tests for error handling, toggle features, and category-specific scenarios

Use these testcases to:
- Debug and improve model classification
- Test new features and fixes
- Validate extension and backend integration
- Reproduce and diagnose classification or extraction errors
# ShieldBox - Advanced Email & URL Security Chrome Extension

ShieldBox is a comprehensive Chrome extension that protects users from phishing attacks, fraudulent emails, spam, and malware by analyzing both URLs and email content in real-time using advanced machine learning algorithms.

## 🚀 Features

### **Email Security & Analysis**
- **Real-time Email Scanning**: Automatically detects phishing emails as you open them
- **Manual Email Analysis**: Scan specific emails on-demand with detailed threat assessment
- **Advanced Threat Detection**: Identifies phishing, fraud, malware, spam, and legitimate emails
- **Visual Security Indicators**: Color-coded badges and alerts for different threat levels
- **Gmail Integration**: Seamless integration with Gmail interface
- **Auto-Scan Toggle**: Enable/disable automatic email monitoring with intelligent UI hiding

### **URL & Link Protection**
- **Manual URL Scanning**: Paste and analyze any URL for security threats
- **Link Validation**: Advanced URL pattern matching and threat detection
- **Real-time Results**: Instant feedback on link safety status
- **Multiple Threat Categories**: Detects phishing, spam, fraud, malware, and safe links

### **Smart User Interface**
- **Floating Security Panel**: Draggable, always-accessible security interface
- **Dark Mode Support**: Toggle between light and dark themes
- **Responsive Design**: Clean, intuitive interface with status-based styling
- **Real-time Notifications**: Immediate alerts with detailed threat information
- **Card-based Layout**: Organized sections for different scanning functions
- **Animation & Feedback**: Visual cues and animations for better user experience

### **Advanced Controls**
- **Auto-Scan Management**: Smart toggle that hides monitoring interface when disabled
- **Settings Persistence**: Remembers user preferences across browser sessions
- **Cross-Tab Synchronization**: Settings sync across all Gmail tabs
- **Debug Functions**: Built-in debugging tools for troubleshooting

## 📁 Project Structure


```
ShieldBox/
├── Backend/                         # Python ML backend
│   ├── dataset_phishing.csv         # Phishing URL training dataset (not included)
│   ├── [other email datasets].csv   # Email datasets (not included)
│   ├── feature_extractor.py         # URL feature extraction (phishing model)
│   ├── email_feature_extractor.py   # Email feature extraction (email model)
│   ├── feature_scaler.pkl           # Trained feature scaler (phishing model)
│   ├── main.py                      # FastAPI backend server
│   ├── phishing_model.pkl           # Trained phishing URL model
│   ├── phishing_model_package.pkl   # Packaged phishing model
│   ├── email_model.pkl              # Trained email classification model
│   ├── requirements.txt             # Python dependencies
│   ├── train_model.py               # Phishing URL model training script
│   └── train_email_model.py         # Email classification model training script
│
└── extension/                       # Chrome extension
   ├── background.js                # Extension background service
   ├── content-script.js            # Page injection & Gmail integration
   ├── emailParser.js               # Email content extraction
   ├── emailUtils.js                # Email utility/helper functions
   ├── emailWarning.js              # Warning/notification logic for emails
   ├── floatingpanel.html           # Security panel UI structure
   ├── floatingpanel.js             # Panel logic & interactions
   ├── icons/                       # Extension icons (16x16, 48x48, 128x128)
   ├── manifest.json                # Extension configuration
   ├── popup.html                   # Extension popup interface
   ├── popup_simple.html            # Minimal/simple popup UI
   ├── popup.js                     # Popup functionality
   └── style.css                    # Complete styling system
```

## 📊 Model Training & Validation

### Phishing URL Model
- **Model:** XGBoost Classifier (see `Backend/train_model.py`)
- **Feature extraction:** See `feature_extractor.py`
- **Dataset split:** 80% training, 20% validation (stratified, random_state=42)
- **Preprocessing:** StandardScaler for feature normalization
- **Validation set:** The 20% test split (`X_test`, `y_test`) is used for model validation and evaluation.

### Email Classification Model
- **Model:** RandomForest (OneVsRest, with TF-IDF features) (see `Backend/train_email_model.py`)
- **Feature extraction:** See `email_feature_extractor.py` (subject + body, normalized, URLs replaced, whitespace cleaned)
- **Categories:** phishing, spam, legitimate, malware, scam, spear_phishing, fraudulent, safe
- **Dataset split:** 80% training, 20% validation (stratified, random_state=42)
- **Validation set:** The 20% test split is used for model validation and evaluation.

## 📦 Dataset
**Note:** The training datasets are not included in this repository. Please download the required datasets and place them in the `Backend/` directory. the datasets are publicly available Kaggle datasets.

## 🔍 Email Classification System

ShieldBox uses advanced machine learning to classify emails into distinct security categories:

| Email Type | Description | Visual Indicator | Behavior |
|------------|-------------|------------------|----------|
| **Phishing** | Attempts to steal credentials/personal info | 🚨 Red alert badge | High-priority warning |
| **Fraud** | Financial scams and deception attempts | 💰 Orange warning badge | Financial threat alert |
| **Malware** | Contains harmful attachments or links | 🦠 Purple warning badge | Malware threat warning |
| **Spam** | Unsolicited bulk emails and marketing | 📧 Yellow warning badge | Spam notification |
| **Safe/Legitimate** | Verified safe and normal emails | ✅ Green safety badge | Safe confirmation |

## 🛠️ Advanced Functionality

### **Auto-Scan Toggle System**
- **Smart UI Management**: When auto-scan is disabled, the monitoring interface elegantly hides
- **Manual Access Preserved**: Manual scanning features remain accessible even when auto-scan is off
- **Seamless Integration**: Toggle works across all Gmail tabs with instant synchronization
- **Visual Feedback**: Clear indicators show current auto-scan status

### **Multi-Level Security Analysis**
- **Content Analysis**: Deep scanning of email text, headers, and metadata
- **Link Verification**: URL reputation checking and pattern analysis
- **Behavioral Detection**: Identifies suspicious email patterns and structures
- **Confidence Scoring**: Provides confidence levels for threat assessments

### **Developer Features**
- **Debug Console**: Built-in debugging functions accessible via browser console
- **Status Monitoring**: Real-time status checking and panel management
- **Error Handling**: Comprehensive error detection and user-friendly messaging
- **Performance Optimization**: Efficient scanning with minimal resource usage

## 🚀 Installation & Setup

### **Backend Setup**
1. **Navigate to Backend Directory**
   ```bash
   cd Backend
   ```

2. **Install Python Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the ML Backend Server**
   ```bash
   python main.py
   ```
   The server will start on `http://localhost:5000`

### **Chrome Extension Installation**
1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

2. **Load the Extension**
   - Click "Load unpacked"
   - Select the `extension` directory from the ShieldBox project
   - The ShieldBox icon should appear in your Chrome toolbar

3. **Verify Installation**
   - Visit Gmail in Chrome
   - The floating security panel should appear automatically
   - Test the extension by opening an email

## 📖 Usage Guide

### **Manual Email Scanning**
1. Open any email in Gmail
2. Click the "Scan Current Email" button in the floating panel
3. View the detailed security assessment with color-coded results

### **Manual URL Analysis**
1. Paste any URL into the "Enter URL" field in the floating panel
2. Click "Scan Link" button
3. Receive instant security feedback on the URL

### **Auto-Scan Configuration**
1. **Enable Auto-Scan**: Toggle ON to automatically monitor emails as you open them
2. **Disable Auto-Scan**: Toggle OFF to hide monitoring interface while preserving manual scanning
3. **Settings Sync**: Changes automatically apply across all Gmail tabs

### **Interface Management**
- **Dark Mode**: Toggle the theme switch for comfortable viewing
- **Panel Movement**: Drag the floating panel to reposition it on screen
- **Debug Access**: Use browser console commands for troubleshooting

## 🔧 Development & Technical Details

### **Technology Stack**
- **Frontend**: JavaScript ES6+, HTML5, CSS3
- **Backend**: Python 3.x with FastAPI framework
- **Machine Learning**: Scikit-learn for email classification
- **Browser Integration**: Chrome Extension APIs v3

### **Key Components**
- **Content Script**: Gmail integration and email extraction
- **Background Service**: Extension lifecycle and cross-tab communication
- **Floating Panel**: Main user interface with real-time updates
- **ML Backend**: Advanced threat detection and classification

### **Security Features**
- **Real-time Analysis**: Immediate threat detection without data storage
- **Local Processing**: Sensitive data analyzed locally when possible
- **Privacy Protection**: No user data transmitted unnecessarily
- **Secure Communication**: Encrypted API communication with backend

## 🧪 Testing & Debugging

### **Debug Console Commands**
Access these functions in the browser console on any Gmail page:

```javascript
// Show/hide auto-scan functionality
window.debugFloatingPanel.showAutoScan()
window.debugFloatingPanel.hideAutoScan()

// Display entire floating panel
window.debugFloatingPanel.showPanel()

// Check current status
window.debugFloatingPanel.checkStatus()
```

### **Manual Testing**
1. **Email Testing**: Open various types of emails (promotional, personal, suspicious)
2. **URL Testing**: Test different URLs including known phishing sites (safely)
3. **Toggle Testing**: Verify auto-scan toggle functionality works correctly
4. **Theme Testing**: Switch between light and dark modes

## 🎯 Current Implementation Status

### ✅ **Completed Features**
- Complete floating panel UI with advanced styling
- Manual email and URL scanning functionality
- Auto-scan toggle with intelligent UI hiding
- Real-time threat detection and classification
- Cross-tab settings synchronization
- Dark mode support with theme persistence
- Comprehensive error handling and user feedback
- Gmail integration with email content extraction
- Machine learning backend with trained models
- Debug functionality for troubleshooting

### 🔄 **Ongoing Development**
- Enhanced threat detection algorithms
- Additional email provider support
- Advanced reporting and analytics
- Performance optimizations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔒 Privacy & Security

ShieldBox is designed with privacy in mind:
- No user data is stored permanently
- Email content is analyzed locally when possible
- Only necessary data is sent to the ML backend
- All communications use secure protocols
- User settings are stored locally in the browser

---

**Note**: This extension is designed for educational and security research purposes. Always exercise caution when dealing with suspicious emails and URLs.
