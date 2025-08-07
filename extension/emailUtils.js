// Helper function for email classification based on extracted content
function classifyEmailType(emailData) {
    // Extract indicators from email data
    const { subject, sender, senderEmail, body, hasAttachments, links, indicators } = emailData;

    // Quick checks for obvious phishing attempts
    if (indicators.urgency && indicators.personalInfo) {
        return "phishing";
    }

    // Check for potential fraud emails
    if (indicators.fraud && (indicators.suspiciousSender || indicators.links > 0)) {
        return "fraud";
    }

    // Check for potential malware emails
    if (indicators.malware && hasAttachments) {
        return "malware";
    }

    // Check for spam indicators
    const spamIndicators = [
        body.toLowerCase().includes('unsubscribe'),
        body.toLowerCase().includes('click here'),
        subject.toLowerCase().includes('discount'),
        subject.toLowerCase().includes('offer'),
        subject.toLowerCase().includes('limited time'),
        subject.toLowerCase().includes('%'),
        subject.toLowerCase().includes('free'),
        subject.toLowerCase().includes('sale'),
        indicators.suspiciousSender
    ];

    // If email has multiple spam indicators, classify as spam
    if (spamIndicators.filter(Boolean).length >= 3) {
        return "spam";
    }

    // Default to legitimate
    return "legitimate";
}

// Function to get threat details based on email type
function getThreatDetails(emailType) {
    switch (emailType.toLowerCase()) {
        case "phishing":
            return {
                title: "Phishing Detected",
                description: "This email appears to be a phishing attempt trying to steal your personal information.",
                recommendation: "Do not click any links or reply with personal information.",
                threatLevel: "high"
            };
        case "fraud":
            return {
                title: "Fraud Detected",
                description: "This email appears to be a fraudulent message attempting financial deception.",
                recommendation: "Do not respond or send any money or personal information.",
                threatLevel: "high"
            };
        case "malware":
            return {
                title: "Potential Malware",
                description: "This email may contain malicious attachments or links to harmful software.",
                recommendation: "Do not download attachments or click suspicious links.",
                threatLevel: "high"
            };
        case "spam":
            return {
                title: "Spam Email",
                description: "This appears to be unsolicited bulk email or marketing.",
                recommendation: "Consider marking as spam or unsubscribing if from a legitimate source.",
                threatLevel: "medium"
            };
        case "legitimate":
            return {
                title: "Legitimate Email",
                description: "This email appears to be legitimate.",
                recommendation: "No action needed.",
                threatLevel: "low"
            };
        default:
            return {
                title: "Analysis Complete",
                description: "Email analysis complete.",
                recommendation: "Use caution with unfamiliar emails.",
                threatLevel: "unknown"
            };
    }
}
