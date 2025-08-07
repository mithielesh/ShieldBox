// Default settings for auto-scan feature
let autoScanSettings = {
  enabled: true,        // Auto-scanning enabled by default
  scanInterval: 30000,  // Scan every 30 seconds
  notifyOnPhishing: true // Show notifications for phishing URLs
};

// Track the visibility state of the floating panel
let floatingPanelVisible = false;

// Helper function for email classification based on extracted content
function classifyEmailType(emailData) {
  // Extract indicators from email data
  const { subject, sender, senderEmail, body, hasAttachments, links, indicators } = emailData;

  if (!indicators) {
    return "unknown";
  }

  // Using the same logic as the backend's basic_email_check function
  const scores = {
    "phishing": indicators.phishingScore || 0,
    "fraud": indicators.fraudScore || 0,
    "spam": indicators.spamScore || 0,
    "malware": indicators.malwareScore || 0
  };

  // Adjust scores based on additional indicators
  if (indicators.sensitiveInfoRequested) {
    scores.phishing += 2;
  }

  if (indicators.financialInfoRequested) {
    scores.fraud += 2;
  }

  if (indicators.promotionalContent) {
    scores.spam += 1;
  }

  if (indicators.shortenedUrls) {
    scores.phishing += 1;
  }

  if (indicators.hasUrgentSubject) {
    scores.phishing += 1;
    scores.fraud += 1;
  }

  // Get category with highest score
  const maxCategory = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  const maxScore = scores[maxCategory];

  // If the highest score is too low, consider it legitimate (same threshold as backend)
  if (maxScore < 2) {
    return "legitimate";
  }

  return maxCategory;
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

// Listen for messages from popup or floating panel
// Handle extension icon click to toggle the floating panel
chrome.action.onClicked.addListener(async (tab) => {
  floatingPanelVisible = !floatingPanelVisible;

  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: "toggleFloatingPanel",
      visible: floatingPanelVisible
    });
  } catch (error) {
    console.error("[ShieldBox] Error toggling floating panel:", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Toggle floating panel visibility
  if (message.action === "toggleFloatingPanel") {
    if (sender.tab) {
      floatingPanelVisible = message.visible !== undefined ? message.visible : !floatingPanelVisible;
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "toggleFloatingPanel",
        visible: floatingPanelVisible
      }).catch(error => {
        // This error is expected if the content script is not on the page
        // (e.g., chrome://extensions or New Tab page).
        if (!error.message.includes("Receiving end does not exist")) {
          console.error("[ShieldBox] Error sending toggle message:", error);
        }
      });
    }
    return;
  }

  // Handle resetting scan status when navigating away from emails
  if (message.action === "resetScanStatus" || message.action === "resetEmailScan") {
    console.log("[ShieldBox] Resetting scan status due to navigation");

    // Send message to all views (popup and floating panel) to reset UI
    chrome.runtime.sendMessage({
      action: 'displayAutoScanResult',
      result: 'No email detected',
      status: 'no-email',
      data: { timestamp: new Date().toISOString() }
    }, () => { if (chrome.runtime.lastError) { /* ignore - no active views */ } });

    chrome.runtime.sendMessage({
      action: 'displayResult',
      source: 'email',
      result: 'No email currently open',
      status: 'no-email'
    }, () => { if (chrome.runtime.lastError) { /* ignore - no active views */ } });

    // No response needed
    return true;
  }

  // Handle email scanning
  if (message.action === "scanEmail") {
    console.log("[ShieldBox] Received scanEmail request");

    // Get the current active tab to extract email content
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.error("[ShieldBox] No active tab found");
        sendResponse({ error: "No active tab found" });
        return;
      }

      // First check if an email is actually open
      chrome.tabs.sendMessage(tabs[0].id, { action: "check_email_open" }, (emailCheckResponse) => {
        if (chrome.runtime.lastError) {
          console.error("[ShieldBox] Error checking email open state:", chrome.runtime.lastError);
          sendResponse({ error: "Could not check email status" });
          return;
        }

        console.log("[ShieldBox] Email open check response:", emailCheckResponse);

        if (!emailCheckResponse || !emailCheckResponse.isOpen) {
          console.log("[ShieldBox] No email is open, returning error");

          // Enhanced error response with UI elements
          sendResponse({
            error: "No email detected. Please open an email first.",
            status: "no-email",
            htmlContent: "<b>📧 No Email Detected</b><br>Please open an email first to scan.",
            explanation: "ShieldBox couldn't find an open email in the current view"
          });

          // Also send a direct message to update UI elements
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "updateUIStatus",
            status: "no-email",
            message: "No email detected"
          });

          return;
        }

        // Now that we know an email is open, extract its content
        chrome.tabs.sendMessage(tabs[0].id, { action: "extract_email" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("[ShieldBox] Error sending message to content script:", chrome.runtime.lastError);
            sendResponse({ error: "Could not access email content. Make sure you're on an email page." });
            return;
          }

          console.log("[ShieldBox] Email extraction response:", response);

          if (!response || response.error) {
            console.log("[ShieldBox] No email detected:", response?.error || "No response");
            sendResponse({ error: response?.error || "No email detected. Please open an email first." });
            return;
          }

          if (!response.body) {
            console.error("[ShieldBox] No email body found");
            sendResponse({ error: "No email content found. Please open a valid email." });
            return;
          }

          try {
            // For manual scans, prioritize backend ML model over local classification
            console.log("[ShieldBox] Manual scan - trying backend email links scan first");

            const emailScanUrl = "http://127.0.0.1:5000/scan-email-links";
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout for manual scans

            fetch(emailScanUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              },
              body: JSON.stringify({
                body: response.body,
                subject: response.subject || "",
                sender: response.sender || ""
              }),
              signal: controller.signal
            })
              .then(res => {
                clearTimeout(timeoutId);
                if (!res.ok) {
                  throw new Error(`API responded with status: ${res.status}`);
                }
                return res.json();
              })
              .then(data => {
                console.log("[ShieldBox] Backend email links scan results:", data);

                // Handle different response formats from /scan-email-links
                let backendResult = 'safe';
                let threatDetails = null;

                // FIXED: Only use final processed statuses, not raw ML predictions

                // Always use email_status for main classification (for both autoscan and manual scan)
                const status = data.status?.toLowerCase() || 'unknown';
                const emailStatus = data.email_status?.toLowerCase() || status;

                // Use emailStatus as the main result for consistency
                backendResult = emailStatus || 'safe';
                threatDetails = getThreatDetails(backendResult);

                // Add specific details for phishing, spam, fraud, malware, or safe
                if (backendResult === 'phishing') {
                  if (data.has_phishing && data.phishing_link_count > 0) {
                    threatDetails.description = `Detected ${data.phishing_link_count} suspicious link(s) in this email that may be phishing attempts.`;
                    threatDetails.recommendation = "Avoid clicking any links in this email. Verify the sender's identity before taking any action.";
                  } else {
                    threatDetails.description = "Email content analysis detected phishing characteristics.";
                    threatDetails.recommendation = "This email appears to be a phishing attempt. Do not provide personal information or click links.";
                  }
                } else if (backendResult === 'spam') {
                  threatDetails.description = "This email appears to be spam or promotional content.";
                } else if (backendResult === 'fraud') {
                  threatDetails.description = "This email appears to be a fraudulent message attempting financial deception.";
                } else if (backendResult === 'malware') {
                  threatDetails.description = "This email may contain malicious attachments or links to harmful software.";
                } else if (backendResult === 'safe' || backendResult === 'legitimate') {
                  if (data.link_count > 0) {
                    threatDetails.description = `Scanned ${data.link_count} link(s) in this email - all appear legitimate.`;
                  } else {
                    threatDetails.description = "Email content appears legitimate and safe.";
                  }
                }

                console.log("[ShieldBox] Final result (consistent):", { backendResult, confidence: data.confidence });

                sendResponse({
                  result: backendResult,
                  emailType: backendResult,
                  details: threatDetails,
                  source: 'ml_model_links',
                  linkResults: data.links || [],
                  confidence: data.confidence || 0,
                  timestamp: data.timestamp
                });
              })
              .catch(error => {
                console.warn("[ShieldBox] Backend ML model failed, falling back to local classification:", error);

                // Fallback to local classification only if backend fails
                const emailType = classifyEmailType(response);
                const threatDetails = getThreatDetails(emailType);
                console.log(`[ShieldBox] Fallback local classification: ${emailType}`);

                sendResponse({
                  result: emailType,
                  emailType: emailType,
                  details: threatDetails,
                  source: 'local_fallback'
                });
              });
          } catch (error) {
            console.error("[ShieldBox] Email scan error:", error);
            sendResponse({
              error: "Error analyzing email: " + error.message,
              result: "unknown"
            });
          }
        });
      });
    });

    return true; // Keep the message channel open for async response
  }

  // Handle hardcoded scanning for debugging
  if (message.action === "hardcodeScan") {
    console.log("[ShieldBox] Received hardcodeScan. Simulating scan...");

    // 1. Immediately tell the UI we are scanning
    chrome.runtime.sendMessage({
      action: "displayAutoScanResult",
      status: "scanning",
      data: { status: "scanning", message: "Scanning email..." }
    });

    // 2. Simulate a delay for the scan
    setTimeout(() => {
      const hardcodedResult = {
        message: "Auto-scan: This email is safe (Hardcoded Result)",
        status: "safe",
        timestamp: new Date().toISOString(),
        linkCount: 3,
        suspiciousLinkCount: 0,
        phishingLinks: [],
        subject: "Test Email",
        sender: "test@example.com",
        emailId: "hardcoded123"
      };

      // 3. Send the final hardcoded result
      chrome.runtime.sendMessage({
        action: "displayAutoScanResult",
        status: "safe",
        data: hardcodedResult
      });

      console.log("[ShieldBox] Sent hardcoded 'safe' result.");
    }, 2000); // 2-second delay

    sendResponse({ status: "simulation_started" });
    return true; // Keep channel open for async operations
  }

  // Handle resetting the UI
  if (message.action === "resetAutoScanUI") {
    console.log("[ShieldBox] Received resetAutoScanUI. Resetting UI.");
    chrome.runtime.sendMessage({
      action: "displayAutoScanResult",
      status: "inactive",
      data: { status: "inactive", message: "No activity yet." }
    });
    sendResponse({ status: "reset_sent" });
    return true;
  }

  // Handle resetting the email scan UI
  if (message.action === "resetEmailScan") {
    console.log("[ShieldBox] Received resetEmailScan. Resetting email scan UI.");
    // Get all tabs to reset UI in each one
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: "resetEmailScan"
        }, () => {
          if (chrome.runtime.lastError) {
            // Ignore errors - tab might not have content script
          }
        });
      });
    });

    // Also broadcast to any open popups
    chrome.runtime.sendMessage({
      action: "resetEmailScan"
    });

    sendResponse({ status: "reset_sent" });
    return true;
  }

  // Handle auto scan URL batch
  if (message.action === "autoScanUrls") {
    // Check if auto scanning is enabled
    if (!autoScanSettings.enabled) {
      sendResponse({ status: "disabled" });
      return true;
    }

    const autoScanUrl = "http://127.0.0.1:5000/auto-scan"; // New endpoint for batch scanning
    console.log("[ShieldBox] Auto-scanning URLs:", message.data.urls.length);

    // Send the batch of URLs to the backend with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

    fetch(autoScanUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ urls: message.data.urls }),
      signal: controller.signal
    })
      .then((res) => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`API responded with status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("[ShieldBox] Auto-scan results:", data);

        // Count phishing URLs
        const phishingUrls = data.results.filter(result => result.status === "phishing");
        console.log(`[ShieldBox] Found ${phishingUrls.length} potential phishing URLs`);

        // Send response back to content script
        sendResponse({
          status: "success",
          results: data.results,
          phishingCount: phishingUrls.length
        });

        // If phishing URLs found, update badge with count
        if (phishingUrls.length > 0) {
          chrome.action.setBadgeText({ text: phishingUrls.length.toString() });
          chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
        }
      })
      .catch((err) => {
        console.error("[ShieldBox] Error in auto-scan:", err);
        // Check if this was an abort error (timeout)
        if (err.name === 'AbortError') {
          console.log("[ShieldBox] Auto-scan request timed out");
          sendResponse({ status: "timeout", message: "Request timed out. Backend server might be unavailable." });
        } else {
          // Provide a more user-friendly error message
          let errorMessage = "An error occurred during scanning.";
          if (err.message && err.message.includes("Failed to fetch")) {
            errorMessage = "Failed to connect to backend server. Is it running at http://127.0.0.1:5000?";
          }
          sendResponse({ status: "error", message: errorMessage, error: err.toString() });
        }
      });

    return true; // Keep the message channel open for async response
  }

  // Handle get auto scan preference
  if (message.action === "getAutoScanPreference") {
    sendResponse({
      autoScanEnabled: autoScanSettings.enabled,
      scanInterval: autoScanSettings.scanInterval
    });
    return true;
  }

  // Handle update auto scan settings
  if (message.action === "updateAutoScanSettings") {
    // The payload can come from popup.js (message.data) or floatingpanel.js (message.settings)
    const newSettings = message.data || message.settings;
    if (newSettings) {
      const oldEnabled = autoScanSettings.enabled;
      autoScanSettings = { ...autoScanSettings, ...newSettings };

      // Save to storage
      chrome.storage.sync.set({ autoScanSettings: autoScanSettings });

      // If enabled state changed, notify all content scripts
      if (oldEnabled !== autoScanSettings.enabled) {
        console.log('[ShieldBox] Auto-scan toggle changed to:', autoScanSettings.enabled);

        // Notify all tabs about the settings change
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'autoScanSettingsChanged',
              settings: autoScanSettings
            }).catch(() => {
              // Ignore errors for tabs that don't have the content script
            });
          });
        });
      }

      sendResponse({ status: "success", settings: autoScanSettings });
    }
    return true;
  }

  // Handle showing phishing warning
  if (message.action === "showPhishingWarning") {
    if (autoScanSettings.notifyOnPhishing) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "ShieldBox: Phishing Alert",
        message: `Found ${message.data.count} potential phishing links on this page. They have been highlighted with a red border.`,
        priority: 2
      });
    }

    // Update badge with phishing count
    chrome.action.setBadgeText({ text: message.data.count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });

    sendResponse({ status: "warning_displayed" });
    return true;
  }

  // Handle link scanning
  if (message.action === "scanLink") {
    const scanUrl = "http://127.0.0.1:5000/scan-link"; // Flask backend API

    console.log("[ShieldBox] Background script received scanLink request");
    console.log("[ShieldBox] URL to scan:", message.data);
    console.log("[ShieldBox] Timestamp:", new Date().toISOString());

    // Process URL data safely
    if (!message.data) {
      console.log("[ShieldBox] Error: No data provided");
      sendResponse({ result: { url: "", status: "Please provide a URL" } });
      return true;
    }

    // Extract URL from message data - handle both string and object formats
    let rawUrl = typeof message.data === 'string' ? message.data : message.data.url || '';
    rawUrl = rawUrl.trim();

    if (!rawUrl) {
      console.log("[ShieldBox] Error: Empty URL provided");
      sendResponse({ result: { url: "", status: "Please provide a URL" } });
      return true;
    }

    // Sanitize URL properly to avoid processing delays
    let processedUrl = rawUrl;

    // Remove any problematic characters
    processedUrl = processedUrl.replace(/[\n\r\t]/g, '');

    try {
      // Use URL constructor to validate and normalize the URL
      const urlObj = new URL(processedUrl);

      // For long URLs, simplify by removing query parameters and fragments
      if (processedUrl.length > 100) {
        processedUrl = urlObj.origin + urlObj.pathname;
        console.log("[ShieldBox] Using simplified URL for analysis:", processedUrl);
      }
    } catch (err) {
      console.log("[ShieldBox] URL parsing failed, using cleaned version");
      // If parsing fails, at least ensure it's not too long
      if (processedUrl.length > 500) {
        processedUrl = processedUrl.substring(0, 500);
      }
    }

    console.log("[ShieldBox] Beginning URL analysis...");
    console.log("[ShieldBox] Sending request to ML backend for:", message.data);

    // IMPORTANT CHANGE: Run local analysis first and provide immediate feedback
    // Always prioritize returning a quick response to keep the UI responsive
    let localStatus = "unknown";
    let hasSuspiciousTerms = false;

    try {
      const url = processedUrl.toLowerCase();
      const suspiciousTerms = ["login", "verify", "account", "secure", "bank", "paypal",
        "password", "signin", "update", "confirm"];

      // Use a safer method to check for suspicious terms that won't hang on complex strings
      for (const term of suspiciousTerms) {
        if (url.indexOf(term) !== -1) {
          hasSuspiciousTerms = true;
          break;
        }
      }

      localStatus = hasSuspiciousTerms ? "phishing" : "safe";
      console.log("[ShieldBox] Local quick scan result:", localStatus);
    } catch (err) {
      // If anything goes wrong in local scanning, just mark as unknown to keep UI responsive
      console.error("[ShieldBox] Error in local scan:", err);
      console.log("[ShieldBox] Setting default local scan result due to error");
    }

    // Send immediate response with local analysis
    const localResponse = {
      result: {
        url: processedUrl,
        status: localStatus,
        timestamp: new Date().toISOString(),
        details: localStatus === "phishing" ?
          "Quick scan: This URL contains suspicious keywords often found in phishing sites. Running full analysis..." :
          "Quick scan: No obvious suspicious patterns detected. Running full analysis...",
        analysis_type: "local_quick_scan"
      }
    };

    // Send immediate response
    sendResponse(localResponse);

    // Try to connect to backend API in the background with timeout
    // Use a wrapper to ensure we can safely make the API call
    const safeApiCall = () => {
      return new Promise((resolve, reject) => {
        // Create a new controller for each call
        const controller = new AbortController();
        let timeoutId = null;

        // Setup timeout to abort if taking too long
        try {
          timeoutId = setTimeout(() => {
            try {
              controller.abort();
              console.log("[ShieldBox] API request timed out after 3 seconds");
              reject(new Error("API request timed out"));
            } catch (err) {
              console.error("[ShieldBox] Error aborting fetch:", err);
              reject(err);
            }
          }, 3000); // 3-second timeout
        } catch (err) {
          console.error("[ShieldBox] Error setting timeout:", err);
          reject(err);
          return;
        }

        try {
          fetch(scanUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({ url: processedUrl }),
            signal: controller.signal
          })
            .then((res) => {
              if (timeoutId) {
                try {
                  clearTimeout(timeoutId);
                } catch (err) {
                  console.error("[ShieldBox] Error clearing timeout:", err);
                }
              }
              resolve(res);
            })
            .catch((err) => {
              if (timeoutId) {
                try {
                  clearTimeout(timeoutId);
                } catch (clearErr) {
                  console.error("[ShieldBox] Error clearing timeout:", clearErr);
                }
              }
              console.error("[ShieldBox] Error connecting to backend:", err);
              reject(err);
            });
        } catch (err) {
          // Handle any synchronous errors in fetch setup
          console.error("[ShieldBox] Error setting up fetch:", err);
          if (timeoutId) {
            try {
              clearTimeout(timeoutId);
            } catch (clearErr) {
              console.error("[ShieldBox] Error clearing timeout:", clearErr);
            }
          }
          reject(err);
        }
      });
    };

    // Make the API call
    safeApiCall()
      .then((res) => {
        console.log("[ShieldBox] API response status:", res.status);
        if (!res.ok) {
          throw new Error(`API responded with status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("[ShieldBox] ML scan result received:", data);
        // Add timestamp to the response
        data.timestamp = new Date().toISOString();

        // Generate detailed response based on confidence level
        if (data.confidence !== undefined) {
          const confidencePercent = Math.round(data.confidence * 100);
          if (data.status === "phishing") {
            data.details = `WARNING: Potential phishing detected with ${confidencePercent}% confidence`;
            // Add details about suspicious indicators
            if (data.suspicious_keywords_found) {
              data.details += "\n• Contains suspicious keywords typically used in phishing";
            }
            if (data.debug_info?.url_length > 75) {
              data.details += "\n• Unusually long URL (common in phishing attempts)";
            }

            // Add risk level based on confidence
            if (data.confidence > 0.7) {
              data.details += "\n\nHIGH RISK! Please avoid this website.";
            } else if (data.confidence > 0.4) {
              data.details += "\n\nMEDIUM RISK. Exercise caution with this website.";
            } else {
              data.details += "\n\nLOW RISK. Still, be careful with this website.";
            }
          } else {
            data.details = `Our ML model verified this URL as safe with ${100 - confidencePercent}% confidence`;
            // Note if there are any suspicious keywords despite being marked safe
            if (data.suspicious_keywords_found) {
              data.details += "\n\nNote: Contains some common phishing keywords, but structure appears legitimate. Still exercise caution.";
            }
          }
        } else {
          data.details = data.status === "phishing" ?
            "Our ML model detected phishing indicators in this URL" :
            "Our ML model verified this URL as safe";
        }

        // Send updated analysis to the UI via message
        chrome.runtime.sendMessage({
          action: "updateScanResult",
          result: {
            url: data.url,
            status: data.status,
            confidence: data.confidence,
            details: data.details || "ML scan complete",
            timestamp: new Date().toISOString(),
            analysis_type: "ml_model"
          }
        });

        console.log("[ShieldBox] ML analysis complete - sent update message to UI");
        // Note: We don't use sendResponse here because we already sent the immediate response
      })
      .catch((err) => {
        console.error("[ShieldBox] Error connecting to backend:", err);
        console.log("[ShieldBox] Using local analysis only");

        // Check if this was an abort error (timeout)
        const errorMessage = err.name === 'AbortError' ?
          "Backend server timeout. Using local scan only." :
          "Backend server unavailable. Using local scan only.";

        // Send update that we're using local analysis only
        chrome.runtime.sendMessage({
          action: "updateScanResult",
          result: {
            url: message.data,
            status: localStatus, // Use the result from our quick local scan
            confidence: hasSuspiciousTerms ? 0.7 : 0.3, // Approximate confidence
            timestamp: new Date().toISOString(),
            details: localStatus === "phishing" ?
              `${errorMessage} This URL contains suspicious patterns.` :
              `${errorMessage} No obvious threats detected.`,
            analysis_type: "local_only"
          }
        });
      });

    // Keep the message channel open for async response
    return true;
  }

  // Handle email scanning
  if (message.action === "scanEmail") {
    console.log("[ShieldBox] Received scanEmail request");

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length === 0) {
        console.log("[ShieldBox] No active tab found for email extraction");
        sendResponse({ error: "No active tab found" });
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action: "extract_email" }, function (emailData) {
        console.log("[ShieldBox] Email data extracted:", emailData);

        if (!emailData || !emailData.body) {
          console.log("[ShieldBox] No email data found or not on email page");
          chrome.runtime.sendMessage({
            action: "displayResult",
            source: "email",
            result: "No email data found. Make sure you're on an email page."
          });
          sendResponse({ error: "No email data" });
          return;
        }

        // Check for links in email body
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = emailData.body.match(urlRegex) || [];

        if (links.length === 0) {
          console.log("[ShieldBox] No links found in email");
          chrome.runtime.sendMessage({
            action: "displayResult",
            source: "email",
            result: "No links found in email."
          });
          sendResponse({ result: "No links found" });
          return;
        }

        console.log("[ShieldBox] Links found in email:", links);

        // Prepare email data for backend scan
        const emailScanUrl = "http://127.0.0.1:5000/scan-email-links";

        // Create controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log("[ShieldBox] Email scan request timed out");
        }, 5000); // 5-second timeout

        // Send to backend for analysis with timeout
        fetch(emailScanUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            body: emailData.body,
            subject: emailData.subject || "",
            sender: emailData.sender || "",
            timestamp: new Date().toISOString()
          }),
          signal: controller.signal
        })
          .then((res) => {
            clearTimeout(timeoutId);
            console.log("[ShieldBox] Email API response status:", res.status);
            if (!res.ok) {
              throw new Error(`Email API responded with status: ${res.status}`);
            }
            return res.json();
          })
          .then((data) => {
            console.log("[ShieldBox] Email links scan result:", data);

            // Handle the response from /scan-email-links endpoint
            let resultMessage;
            if (data.status === 'no_links') {
              resultMessage = "No links found in email to scan.";
            } else if (data.status === "phishing" || data.has_phishing) {
              resultMessage = `Phishing detected! ${data.phishing_link_count || 0} of ${data.link_count || 0} links are suspicious.`;
            } else {
              resultMessage = `Email appears safe. ${data.link_count || 0} links checked.`;
            }

            chrome.runtime.sendMessage({
              action: "displayResult",
              source: "email",
              result: resultMessage,
              status: data.status,
              data: data // Pass full data for detailed view
            });

            sendResponse({
              result: data.status,
              links: data.links || [],
              email_status: data.email_status,
              link_count: data.link_count || 0,
              phishing_link_count: data.phishing_link_count || 0
            });
          })
          .catch((err) => {
            console.error("[ShieldBox] Error during email scan:", err);

            // Check if it's an abort error (timeout)
            const errorMessage = err.name === 'AbortError' ?
              "Backend server timed out. Using local analysis." :
              "Error connecting to backend. Using local analysis.";

            console.log("[ShieldBox]", errorMessage);

            // Fallback logic mirrored from auto-scan for consistency
            const bodyLowercase = (emailData.body || "").toLowerCase();
            const subjectLowercase = (emailData.subject || "").toLowerCase();

            const phishingKeywords = ["urgent", "verify", "password", "login", "account", "suspended",
              "security", "confirm", "update", "unusual activity", "limited time",
              "click here", "authenticate", "validate", "credentials"];

            const hasPhishingKeywords = phishingKeywords.some(keyword =>
              bodyLowercase.includes(keyword) || subjectLowercase.includes(keyword));

            const suspiciousLinks = (links || []).filter(link => {
              const url = link.toLowerCase();
              return ["login", "verify", "account", "secure", "bank", "update", "confirm", "password", "signin"].some(term => url.includes(term));
            });

            const status = (suspiciousLinks.length > 0 || hasPhishingKeywords) ? "phishing" : "safe";
            const resultMessage = status === "phishing"
              ? `Potential phishing detected! (local scan - backend unavailable)`
              : `No suspicious patterns found. (local scan - backend unavailable)`;

            chrome.runtime.sendMessage({
              action: "displayResult",
              source: "email",
              result: resultMessage,
              status: status
            });

            sendResponse({ result: status, links: links });
          });
      });
    });

    // Keep the message channel open for async response
    return true;
  }

  // Handle auto email scanning
  if (message.action === "scanAutoEmail") {
    console.log("[ShieldBox] AutoScanEmail message received:", message.data);

    // Check auto scan setting from chrome.storage.local
    chrome.storage.local.get(["autoScan"], (res) => {
      if (res.autoScan === false) {
        console.log("[ShieldBox] AutoScan is OFF. Skipping scan.");
        sendResponse({ status: "skipped", reason: "autoScan is off" });
        return;
      }

      console.log("[ShieldBox] AutoScan is ON. Processing email scan.");

      const emailData = message.data;
      if (!emailData || !emailData.body) {
        console.log("[ShieldBox] AutoScan: Invalid email data received.");
        // Optionally send a message to UI to show an inactive state
        chrome.runtime.sendMessage({
          action: "displayAutoScanResult",
          status: "inactive",
          message: "No email content to scan.",
          data: { status: "inactive", message: "No email content to scan." }
        });
        sendResponse({ error: "Invalid email data" });
        return;
      }

      // Extract links from email body
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const links = emailData.body.match(urlRegex) || [];

      console.log("[ShieldBox] Auto-scanning email. Links found:", links.length);

      // Prepare email data for backend scan
      const emailScanUrl = "http://127.0.0.1:5000/scan-email-links";

      // Send to backend for analysis
      fetch(emailScanUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          body: emailData.body,
          subject: emailData.subject || "",
          sender: emailData.sender || "",
          timestamp: new Date().toISOString()
        })
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`API responded with status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          console.log("[ShieldBox] AutoScanEmail result:", data);

          // Handle response from /scan-email-links endpoint with enhanced status mapping
          let resultMessage;
          let displayStatus;
          let htmlContent;

          // Map backend response to proper display format
          if (data.email_status) {
            // Use the ML model's email classification if available
            const emailStatus = data.email_status.toLowerCase();
            switch (emailStatus) {
              case "phishing":
                displayStatus = "phishing";
                htmlContent = "<b>⚠️ PHISHING DETECTED</b><br>This email contains suspicious content!";
                resultMessage = "Auto-scan: Phishing email detected by ML analysis";
                break;
              case "spam":
                displayStatus = "spam";
                htmlContent = "<b>📧 SPAM DETECTED</b><br>This email appears to be spam.";
                resultMessage = "Auto-scan: Spam email detected by ML analysis";
                break;
              case "fraud":
                displayStatus = "fraud";
                htmlContent = "<b>💰 FRAUD DETECTED</b><br>This email appears to be fraudulent.";
                resultMessage = "Auto-scan: Fraud detected by ML analysis";
                break;
              case "malware":
                displayStatus = "malware";
                htmlContent = "<b>🦠 MALWARE DETECTED</b><br>This email may contain malware.";
                resultMessage = "Auto-scan: Malware threat detected by ML analysis";
                break;
              case "safe":
              case "legitimate":
              default:
                displayStatus = "safe";
                htmlContent = "<b>✅ EMAIL SAFE</b><br>No threats detected in this email.";
                resultMessage = "Auto-scan: Email classified as safe by ML analysis";
                break;
            }
          } else if (data.status === 'no_links') {
            displayStatus = "safe";
            htmlContent = "<b>✅ EMAIL SAFE</b><br>No links found in this email.";
            resultMessage = "Auto-scan: No links found in email";
          } else if (data.status === "phishing" || data.has_phishing) {
            displayStatus = "phishing";
            htmlContent = "<b>⚠️ PHISHING DETECTED</b><br>Suspicious links found in this email!";
            resultMessage = `Auto-scan: Phishing detected! ${data.phishing_link_count || 0} of ${data.link_count || 0} links are suspicious`;
          } else {
            displayStatus = "safe";
            htmlContent = "<b>✅ EMAIL SAFE</b><br>No threats detected in this email.";
            resultMessage = `Auto-scan: Email appears safe. ${data.link_count || 0} links checked`;
          }

          // Include any suspicious links in the result
          let phishingLinks = [];
          if (data.links && data.links.length > 0) {
            phishingLinks = data.links
              .filter(link => link.status === "phishing")
              .map(link => link.url);
          }

          // Store the latest auto scan result in chrome.storage
          let autoScanResult = {
            message: resultMessage,
            status: displayStatus,
            htmlContent: htmlContent,
            timestamp: new Date().toISOString(),
            linkCount: data.link_count || 0,
            suspiciousLinkCount: data.phishing_link_count || phishingLinks.length,
            phishingLinks: phishingLinks,
            subject: emailData.subject || "Unknown subject",
            sender: emailData.sender || "Unknown sender",
            emailId: emailData.emailId || "",
            emailStatus: data.email_status || null
          };

          chrome.storage.local.set({ latestAutoScanResult: autoScanResult }, () => {
            console.log("[ShieldBox] Stored auto-scan result in chrome.storage");
          });

          // Send message to update any open popups with enhanced formatting
          console.log('[ShieldBox] 📤 Sending displayAutoScanResult message to UI:', {
            action: "displayAutoScanResult",
            result: resultMessage,
            status: displayStatus,
            htmlContent: htmlContent
          });

          chrome.runtime.sendMessage({
            action: "displayAutoScanResult",
            result: resultMessage,
            status: displayStatus,
            htmlContent: htmlContent,
            data: autoScanResult
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('[ShieldBox] Chrome runtime error sending auto-scan result:', chrome.runtime.lastError);
            } else {
              console.log('[ShieldBox] ✅ Auto-scan result message sent successfully');
            }
          });

          sendResponse({
            status: "done",
            result: displayStatus,
            emailType: displayStatus,
            htmlContent: htmlContent,
            links: data.links,
            email_status: data.email_status,
            link_count: data.link_count
          });
          const suspiciousLinks = links.filter(link => {
            const url = link.toLowerCase();

            return ["login", "verify", "account", "secure", "bank", "update", "confirm", "password", "signin"].some(term => url.includes(term));
          });

          const status = suspiciousLinks.length > 0 ? "phishing" : "safe";
          if (status === "phishing") {
            htmlContent = "<b>⚠️ PHISHING DETECTED</b><br>Suspicious links found! (Local analysis)";
            resultMessage = "Auto-scan: Potential phishing detected (local analysis - backend unavailable)";
          } else {
            htmlContent = "<b>✅ EMAIL SAFE</b><br>No threats detected. (Local analysis)";
            resultMessage = "Auto-scan: No suspicious links found (local analysis - backend unavailable)";
          }

          // Store the latest auto scan result in chrome.storage
          // Use existing autoScanResult object if defined, otherwise create a new one
          autoScanResult = typeof autoScanResult !== 'undefined' ? autoScanResult : {};
          autoScanResult.message = resultMessage;
          autoScanResult.status = status;
          autoScanResult.htmlContent = htmlContent;
          autoScanResult.timestamp = new Date().toISOString();
          autoScanResult.linkCount = links.length;
          autoScanResult.suspiciousLinkCount = suspiciousLinks.length;
          autoScanResult.phishingLinks = suspiciousLinks;
          autoScanResult.subject = emailData.subject || "Unknown subject";
          autoScanResult.sender = emailData.sender || "Unknown sender";
          autoScanResult.emailId = emailData.emailId || "";
          autoScanResult.emailStatus = null;
          autoScanResult.isLocalScan = true;

          chrome.storage.local.set({ latestAutoScanResult: autoScanResult }, () => {
            console.log("[ShieldBox] Stored auto-scan result in chrome.storage (fallback)");
          });

          console.log("[ShieldBox] 📤 Sending fallback auto-scan result message to UI:", {
            action: "displayAutoScanResult",
            result: resultMessage,
            status: status,
            htmlContent: htmlContent
          });

          chrome.runtime.sendMessage({
            action: "displayAutoScanResult",
            result: resultMessage,
            status: status,
            htmlContent: htmlContent,
            data: autoScanResult
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('[ShieldBox] Chrome runtime error sending fallback auto-scan result:', chrome.runtime.lastError);
            } else {
              console.log('[ShieldBox] ✅ Fallback auto-scan result message sent successfully');
            }
          });

          sendResponse({
            result: status,
            emailType: status,
            htmlContent: htmlContent,
            links: links,
            isLocalScan: true
          });
        });
    });

    // Keep the message channel open for async response
    return true;
  }
});
