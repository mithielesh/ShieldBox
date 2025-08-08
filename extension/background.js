// Default settings for auto-scan feature
let autoScanSettings = {
  enabled: true,        // Auto-scanning enabled by default
  scanInterval: 30000,  // Scan every 30 seconds
  notifyOnPhishing: true // Show notifications for phishing URLs
};

// Track the visibility state of the floating panel
let floatingPanelVisible = false;

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
  // CRITICAL FIX: Check if the tab is a valid page to inject scripts into.
  // This prevents the "Receiving end does not exist" error on chrome:// pages.
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('https://chrome.google.com/webstore')) {
    console.log('[ShieldBox] Cannot toggle panel on a restricted page.');
    // Optionally, you could open a new tab or show a notification here.
    return;
  }

  floatingPanelVisible = !floatingPanelVisible;

  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: "toggleFloatingPanel",
      visible: floatingPanelVisible
    });
  } catch (error) {
    console.warn("[ShieldBox] Could not toggle floating panel. Content script might not be injected or ready on this page.", error.message);
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
          console.warn("[ShieldBox] Error checking email open state:", chrome.runtime.lastError.message);
          try {
            sendResponse({ error: "Could not check email status" });
          } catch (e) {
            console.log("[ShieldBox] Could not send email check error response, original sender likely gone.", e);
          }
          return;
        }

        console.log("[ShieldBox] Email open check response:", emailCheckResponse);

        if (!emailCheckResponse || !emailCheckResponse.isOpen) {
          console.log("[ShieldBox] No email is open, returning error");

          try {
            // Enhanced error response with UI elements
            sendResponse({
              error: "No email detected. Please open an email first.",
              status: "no-email",
              htmlContent: "<b>📧 No Email Detected</b><br>Please open an email first to scan.",
              explanation: "ShieldBox couldn't find an open email in the current view"
            });
          } catch (e) {
            console.log("[ShieldBox] Could not send 'no-email' response, original sender likely gone.", e);
          }

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
            console.warn("[ShieldBox] Error sending message to content script:", chrome.runtime.lastError.message);
            try {
              sendResponse({ error: "Could not access email content. Make sure you're on an email page." });
            } catch (e) {
              console.log("[ShieldBox] Could not send email extraction error response, original sender likely gone.", e);
            }
            return;
          }

          console.log("[ShieldBox] Email extraction response:", response);

          if (!response || response.error) {
            console.log("[ShieldBox] No email detected:", response?.error || "No response");
            try {
              sendResponse({ error: response?.error || "No email detected. Please open an email first." });
            } catch (e) {
              console.log("[ShieldBox] Could not send 'no-email-detected' response, original sender likely gone.", e);
            }
            return;
          }

          if (!response.body) {
            console.error("[ShieldBox] No email body found");
            try {
              sendResponse({ error: "No email content found. Please open a valid email." });
            } catch (e) {
              console.log("[ShieldBox] Could not send 'no-body' response, original sender likely gone.", e);
            }
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
                console.error("[ShieldBox] Backend ML model for manual scan failed:", error);
                let errorMessage = "The backend analysis server is unavailable. Please try again later.";
                if (error.name === 'AbortError') {
                  errorMessage = "The analysis request timed out. The server might be busy.";
                } else if (error.message && error.message.includes("Failed to fetch")) {
                  errorMessage = "Could not connect to the analysis server. Please ensure it is running.";
                }

                try {
                  sendResponse({
                    error: errorMessage,
                    result: "error",
                    emailType: "error",
                    details: {
                      title: "Scan Failed",
                      description: errorMessage,
                      recommendation: "Check your connection or try again later.",
                      threatLevel: "unknown"
                    },
                    source: 'backend_error'
                  });
                } catch (e) {
                  console.log("[ShieldBox] Could not send response for manual scan fallback, original sender likely gone.", e);
                }
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
        // Badge update removed as per user request
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
    // Badge update removed as per user request
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
    // Capture the sender's tab ID to send the final result back
    const senderTabId = sender.tab?.id;

    // Send immediate response with local analysis
    const scanningResponse = {
      result: {
        url: processedUrl,
        status: "scanning",
        timestamp: new Date().toISOString(),
        details: "Analyzing URL with ML model...",
        analysis_type: "local_quick_scan"
      }
    };

    // Send immediate response
    sendResponse(scanningResponse);

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

        // Generate detailed response without confidence percentages
        if (data.status === "phishing") {
          data.details = "Warning: This URL shows signs of a phishing threat.";

          // Add details about suspicious indicators
          if (data.suspicious_keywords_found) {
            data.details += "\n• Contains keywords often used in phishing.";
          }
          if (data.debug_info?.url_length > 75) {
            data.details += "\n• The URL is unusually long, a common phishing tactic.";
          }

          // Add risk level recommendation based on confidence
          if (data.confidence > 0.8) {
            data.details += "\n\nRecommendation: HIGH RISK! Avoid this website.";
          } else if (data.confidence > 0.5) {
            data.details += "\n\nRecommendation: MEDIUM RISK. Exercise extreme caution.";
          } else {
            data.details += "\n\nRecommendation: LOW RISK, but be careful.";
          }
        } else {
          data.details = "This URL appears to be safe.";
          // Note if there are any suspicious keywords despite being marked safe
          if (data.suspicious_keywords_found) {
            data.details += "\n\nNote: While the structure seems safe, it contains some suspicious keywords. Please exercise caution.";
          }
        }

        // Send updated analysis to the UI via message
        const updateMessage = {
          action: "updateScanResult",
          result: {
            url: data.url,
            status: data.status,
            confidence: data.confidence,
            details: data.details || "ML scan complete",
            timestamp: new Date().toISOString(),
            analysis_type: "ml_model"
          }
        };

        if (senderTabId) {
          chrome.tabs.sendMessage(senderTabId, updateMessage, () => {
            if (chrome.runtime.lastError) { /* Ignore error if tab is closed */ }
          });
        } else {
          // Fallback for contexts without a tab (e.g., popup)
          chrome.runtime.sendMessage(updateMessage, () => {
            if (chrome.runtime.lastError) { /* Ignore error if popup is closed */ }
          });
        }

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
        const fallbackMessage = {
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
        };

        if (senderTabId) {
          chrome.tabs.sendMessage(senderTabId, fallbackMessage, () => {
            if (chrome.runtime.lastError) { /* Ignore error if tab is closed */ }
          });
        } else {
          chrome.runtime.sendMessage(fallbackMessage, () => {
            if (chrome.runtime.lastError) { /* Ignore error if popup is closed */ }
          });
        }
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
          try {
            chrome.runtime.sendMessage({
              action: "displayResult",
              source: "email",
              result: "No email data found. Make sure you're on an email page."
            });
            sendResponse({ error: "No email data" });
          } catch (e) {
            console.log("[ShieldBox] Could not send 'no-email-data' response, original sender likely gone.", e);
          }
          return;
        }

        // Check for links in email body
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = emailData.body.match(urlRegex) || [];

        if (links.length === 0) {
          console.log("[ShieldBox] No links found in email");
          try {
            chrome.runtime.sendMessage({
              action: "displayResult",
              source: "email",
              result: "No links found in email."
            });
            sendResponse({ result: "No links found" });
          } catch (e) {
            console.log("[ShieldBox] Could not send 'no-links' response, original sender likely gone.", e);
          }
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

            try {
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
            } catch (e) {
              console.log("[ShieldBox] Could not send email scan success response, original sender likely gone.", e);
            }
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

            try {
              chrome.runtime.sendMessage({
                action: "displayResult",
                source: "email",
                result: resultMessage,
                status: status
              });

              sendResponse({ result: status, links: links });
            } catch (e) {
              console.log("[ShieldBox] Could not send email scan fallback response, original sender likely gone.", e);
            }
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
        try {
          // Optionally send a message to UI to show an inactive state
          chrome.runtime.sendMessage({
            action: "displayAutoScanResult",
            status: "inactive",
            message: "No email content to scan.",
            data: { status: "inactive", message: "No email content to scan." }
          });
          sendResponse({ error: "Invalid email data" });
        } catch (e) {
          console.log("[ShieldBox] Could not send 'invalid-data' response, original sender likely gone.", e);
        }
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
          //"Access-Control-Allow-Origin": "*"
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
        })
        .catch((err) => {
          console.error("[ShieldBox] Error during auto-scan:", err);

          let resultMessage = "Auto-scan failed: Backend unavailable";
          let displayStatus = "error";
          let htmlContent = "<b>⚠️ Auto-Scan Failed</b><br>Could not connect to the analysis server.";

          if (err.name === 'AbortError') {
            resultMessage = "Auto-scan timed out.";
            htmlContent = "<b>⌛ Auto-Scan Timed Out</b><br>The server is taking too long to respond.";
          }

          // Prepare a result object to send to the UI
          const errorResult = {
            message: resultMessage,
            status: displayStatus,
            htmlContent: htmlContent,
            timestamp: new Date().toISOString(),
            isError: true,
            subject: emailData.subject || "Unknown subject",
            sender: emailData.sender || "Unknown sender",
            emailId: emailData.emailId || ""
          };

          // Send message to update any open popups/panels
          chrome.runtime.sendMessage({
            action: "displayAutoScanResult",
            result: resultMessage,
            status: displayStatus,
            htmlContent: htmlContent,
            data: errorResult
          }, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
          });

          // Send a response back to the content script
          sendResponse({
            status: "error",
            result: "error",
            error: err.message
          });
        });
    });

    // Keep the message channel open for async response
    return true;
  }
});
