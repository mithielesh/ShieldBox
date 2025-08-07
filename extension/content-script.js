// Note: URL change tracking is already handled by the existing
// Gmail-specific URL monitoring functionality below

// Bridge: Listen for window.postMessage from injected panel and relay to background
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  // Handle link scanning
  if (event.data && event.data.type === 'scan_link') {
    chrome.runtime.sendMessage({
      action: 'scanLink',
      data: event.data.url
    }, (response) => {
      window.postMessage({ type: 'scan_link_result', result: response }, '*');
    });
  }

  // Handle email scanning
  if (event.data && event.data.type === 'scan_email_request') {
    // First check if an email is actually open before scanning
    const isEmailOpen = detectEmailContent();
    console.log('[ShieldBox] 🚀 Content script loaded on:', window.location.href);

    // Add debugging functions for manual testing
    window.debugShieldBox = {
      triggerAutoScan: function () {
        console.log('[ShieldBox] 🔧 DEBUG: Manually triggering auto-scan...');
        scanCurrentEmail(true); // Manual trigger, bypass toggle check
      },
      checkEmailDetection: function () {
        console.log('[ShieldBox] 🔧 DEBUG: Checking email detection...');
        const isDetected = detectEmailContent();
        console.log('[ShieldBox] Email detected:', isDetected);
        return isDetected;
      },
      extractEmail: function () {
        console.log('[ShieldBox] 🔧 DEBUG: Extracting email data...');
        const emailData = extractEmailData();
        console.log('[ShieldBox] Email data:', emailData);
        return emailData;
      },
      testAutoScanMessage: function () {
        console.log('[ShieldBox] 🔧 DEBUG: Sending test auto-scan message...');
        chrome.runtime.sendMessage({
          action: 'displayAutoScanResult',
          result: 'DEBUG: Test auto-scan message',
          status: 'safe',
          htmlContent: '<b>🔧 DEBUG TEST</b><br>This is a test auto-scan message.',
          data: { timestamp: new Date().toISOString(), debug: true }
        });
      },
      forcePhishingResult: function () {
        console.log('[ShieldBox] 🔧 DEBUG: Forcing phishing result display...');
        // Send the message exactly as the background script would
        const testMessage = {
          action: 'displayAutoScanResult',
          result: 'Auto-scan: Phishing email detected by ML analysis',
          status: 'phishing',
          htmlContent: '<b>⚠️ PHISHING DETECTED</b><br>This email contains suspicious content!',
          data: {
            message: 'Auto-scan: Phishing email detected by ML analysis',
            status: 'phishing',
            timestamp: new Date().toISOString(),
            linkCount: 0,
            suspiciousLinkCount: 0,
            phishingLinks: [],
            subject: 'Test Subject',
            sender: 'test@example.com',
            emailId: 'test123'
          }
        };

        // Send via chrome.runtime
        chrome.runtime.sendMessage(testMessage);

        // Also send directly via window message
        window.postMessage({
          type: 'shield_box_update',
          ...testMessage
        }, '*');
      },
      showCache: function () {
        console.log('[ShieldBox] 🔧 DEBUG: Current scan results cache:');
        console.log('Cache size:', emailScanResults.size);
        console.log('Cached emails:', Array.from(emailScanResults.keys()));
        console.log('Full cache:', emailScanResults);
        return {
          size: emailScanResults.size,
          emails: Array.from(emailScanResults.keys()),
          cache: Object.fromEntries(emailScanResults)
        };
      },
      clearCache: function () {
        console.log('[ShieldBox] 🔧 DEBUG: Clearing scan results cache...');
        emailScanResults.clear();
        scannedEmails.clear();
        lastScannedEmailId = null;
        console.log('[ShieldBox] Cache and scanned emails cleared successfully');
      }
    };

    console.log('[ShieldBox] 🚀 Content script loaded on:', window.location.href);

    if (!isEmailOpen) {
      // No email is open, return appropriate message with more user-friendly format
      window.postMessage({
        type: 'scan_email_result',
        result: 'No email detected. Please open an email first.',
        status: 'no-email',
        htmlContent: "<b>No Email Detected</b><br>Please open an email first to scan.",
        explanation: "ShieldBox needs an open email to analyze"
      }, '*');
      return;
    }

    // Email is open, proceed with scan
    chrome.runtime.sendMessage({ action: 'scanEmail' }, (response) => {
      console.log("[ShieldBox] Email scan response from background:", response);

      // Handle error responses
      if (response && response.error) {
        window.postMessage({
          type: 'scan_email_result',
          result: response.error,
          status: response.status || 'error',
          htmlContent: response.htmlContent || null
        }, '*');
        return;
      }

      // Handle successful responses - enhance with better formatting
      const emailType = response && response.emailType ? response.emailType : 'unknown';
      let htmlContent = null;

      // Create enhanced HTML content for successful scans
      if (emailType === 'phishing') {
        htmlContent = '<b>⚠️ PHISHING DETECTED</b><br>This email contains suspicious content!';
      } else if (emailType === 'safe' || emailType === 'legitimate') {
        htmlContent = '<b>✅ EMAIL SAFE</b><br>No threats detected in this email.';
      } else if (emailType === 'spam') {
        htmlContent = '<b>📧 SPAM DETECTED</b><br>This email appears to be spam.';
      } else if (emailType === 'fraud') {
        htmlContent = '<b>💰 FRAUD DETECTED</b><br>This email appears to be fraudulent.';
      } else if (emailType === 'malware') {
        htmlContent = '<b>🦠 MALWARE DETECTED</b><br>This email may contain malware.';
      } else {
        htmlContent = '<b>🔍 SCAN COMPLETE</b><br>Email analysis finished.';
      }

      window.postMessage({
        type: 'scan_email_result',
        result: response && response.result ? response.result : 'Scan completed.',
        status: emailType,
        details: response && response.details ? response.details : null,
        htmlContent: htmlContent
      }, '*');
    });
  }

  // Handle auto email scanning result
  if (event.data && event.data.type === 'update_auto_scan') {
    // Update the floating panel with auto scan results
    chrome.runtime.sendMessage({
      action: 'displayAutoScanResult',
      result: event.data.result
    });
  }
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[ShieldBox] Content script received message:", message);

  // Handle floating panel toggle
  if (message.action === "toggleFloatingPanel") {
    console.log("[ShieldBox] Toggle floating panel visibility:", message.visible);

    // Create or toggle the floating panel
    const floatingPanel = document.getElementById('shieldbox-floating-panel');
    if (floatingPanel) {
      floatingPanel.style.display = message.visible ? 'block' : 'none';
    } else if (message.visible) {
      // If panel doesn't exist and should be visible, create it
      injectFloatingPanel();
    }

    sendResponse({ success: true });
    return true;
  }

  // Pass results to any panels or UI components on the page
  if (message.action === "displayResult" || message.action === "displayAutoScanResult") {
    console.log('[ShieldBox] 🔄 Forwarding message to floating panel:', message.action);

    // ⭐ If this is an auto-scan result, try to cache it for future re-entries
    if (message.action === "displayAutoScanResult" && message.status && message.status !== 'scanning' && message.status !== 'inactive') {
      // Try to determine which email this result is for
      if (lastScannedEmailId && message.data && message.data.subject) {
        console.log('[ShieldBox] 💾 Caching auto-scan result from background script');
        emailScanResults.set(lastScannedEmailId, {
          result: message.result,
          status: message.status,
          htmlContent: message.htmlContent,
          data: message.data
        });

        // ⭐ NOW mark this email as scanned (only after successful cache from background)
        scannedEmails.add(lastScannedEmailId);
        console.log('[ShieldBox] ✅ Email marked as scanned AFTER background result. Total scanned emails:', scannedEmails.size);
      }
    }

    // Forward the complete message to the floating panel iframe
    const iframe = document.getElementById('shield-box-iframe');
    if (iframe && iframe.contentWindow) {
      console.log('[ShieldBox] 📤 Sending message to iframe:', message);
      iframe.contentWindow.postMessage({
        type: 'chrome_extension_message',
        data: message
      }, '*');
    } else {
      console.log('[ShieldBox] ⚠️ ShieldBox iframe not found or not ready');
    }

    // Also post to the main window for any direct listeners
    window.postMessage({
      type: 'shield_box_update',
      action: message.action,
      source: message.source,
      result: message.result,
      status: message.status,
      htmlContent: message.htmlContent,
      data: message.data
    }, '*');
  }

  // Handle reset scan status request
  if (message.action === "resetScanStatus" || message.action === "resetEmailScan") {
    console.log("[ShieldBox] Resetting scan status");
    window.postMessage({
      type: 'shield_box_update',
      action: 'resetScanStatus',
      status: 'inactive',
      result: 'No email activity detected'
    }, '*');

    // Also reset any other status variables as needed
    window.postMessage({
      type: 'scan_email_result',
      result: 'No email currently open',
      status: 'no-email'
    }, '*');

    return true;
  }

  // Check if an email is currently open
  if (message.action === "check_email_open") {
    console.log("[ShieldBox] Checking if an email is open");

    // Triple check - use multiple methods to detect email and report all results
    const isEmailOpen = detectEmailContent();
    console.log("[ShieldBox] Email open status (detectEmailContent):", isEmailOpen);

    // Additional methods to verify if in Gmail (for debugging)
    const isGmail = window.location.hostname.includes('mail.google.com');
    const hasMessageBody = document.querySelector('.a3s.aiL') !== null;
    const hasSubject = document.querySelector('h2.hP') !== null;
    const isInboxView = document.querySelector('.Cp') !== null && !hasMessageBody;
    const currentUrl = window.location.href;

    console.log("[ShieldBox] Additional checks - Gmail:", isGmail,
      "hasMessageBody:", hasMessageBody,
      "hasSubject:", hasSubject,
      "isInboxView:", isInboxView,
      "URL:", currentUrl);

    // Force to true for testing if we're on Gmail and have a message body element
    const forceDetection = isGmail && hasMessageBody && hasSubject;
    if (forceDetection && !isEmailOpen) {
      console.warn("[ShieldBox] Email detection mismatch! URL shows message body but detection failed. Forcing to true.");
    }

    // Return the most permissive result
    sendResponse({ isOpen: isEmailOpen || forceDetection });
    return true;
  }

  // Handle request for current email status
  if (message.action === "requestCurrentStatus") {
    console.log("[ShieldBox] Status request received, checking current email state");
    // Trigger a status check
    setTimeout(() => {
      scanCurrentEmail();
    }, 100);
  }

  // Handle UI update requests from background script
  if (message.action === "updateUIStatus") {
    console.log("[ShieldBox] UI status update received:", message.status);

    // Forward this message to the floating panel
    window.postMessage({
      type: 'shield_box_update',
      action: 'updateUIStatus',
      status: message.status,
      message: message.message || "Status updated",
      timestamp: new Date().toISOString()
    }, '*');

    // If this is a no-email status, also send a more specific message
    if (message.status === "no-email") {
      window.postMessage({
        type: 'scan_email_result',
        result: message.message || 'No email detected',
        status: 'no-email',
        htmlContent: "<b>📧 No Email Detected</b><br>ShieldBox needs an open email to scan."
      }, '*');
    }

    return true;
  }

  // Handle request to get email content
  if (message.action === "getEmailContent") {
    console.log("[ShieldBox] Email content request received");

    // Try to use emailParser.js first, then fallback
    let emailContent = null;

    if (typeof extractEmailDetails === 'function') {
      console.log("[ShieldBox] Using extractEmailDetails from emailParser.js for content");
      const emailDetails = extractEmailDetails();
      if (emailDetails && emailDetails.body) {
        emailContent = {
          content: emailDetails.body,
          subject: emailDetails.subject || document.title,
          sender: emailDetails.sender || emailDetails.senderEmail || ''
        };
      }
    }

    // Fallback to content-script.js method
    if (!emailContent || !emailContent.content) {
      console.log("[ShieldBox] Falling back to extractEmailContent method");
      emailContent = extractEmailContent();
    }

    sendResponse(emailContent);
    return true;
  }

  // Handle extract email request
  if (message.action === "extract_email") {
    console.log("[ShieldBox] Extract email request received");

    try {
      // First check if we're on an email page with more detailed logging
      const isEmailPage = detectEmailContent();
      console.log("[ShieldBox] On an email page?", isEmailPage);

      if (!isEmailPage) {
        console.log("[ShieldBox] Not on an email page. URL:", window.location.href);
        sendResponse({ error: "No email detected. Please open an email first." });
        return true;
      }

      // Try to extract email data using emailParser.js first, then fallback
      let emailData = null;

      if (typeof extractEmailDetails === 'function') {
        console.log("[ShieldBox] Using extractEmailDetails from emailParser.js");
        const emailDataFromParser = extractEmailDetails();
        console.log("[ShieldBox] emailParser.js returned:", emailDataFromParser);

        // Convert emailParser.js format to expected format if we have content
        if (emailDataFromParser && (emailDataFromParser.body || emailDataFromParser.subject) &&
          (emailDataFromParser.body?.length > 10 || emailDataFromParser.subject?.length > 3)) {
          emailData = {
            subject: emailDataFromParser.subject || '',
            sender: emailDataFromParser.sender || emailDataFromParser.senderEmail || '',
            body: emailDataFromParser.body || '',
            hasAttachments: emailDataFromParser.hasAttachments || false,
            links: emailDataFromParser.links || []
          };
          console.log("[ShieldBox] Successfully converted emailParser.js data for manual scan");
        } else {
          console.log("[ShieldBox] emailParser.js did not return sufficient content for manual scan");
        }
      }

      // Fallback to content-script.js extraction method
      if (!emailData || !emailData.body) {
        console.log("[ShieldBox] Falling back to extractEmailData method");
        emailData = extractEmailData('manual'); // Mark as manual scan
      }

      console.log("[ShieldBox] Email extraction result:", emailData ? "Success" : "Failed");

      if (!emailData) {
        console.log("[ShieldBox] Failed to extract email data");
        sendResponse({ error: "Could not extract email data" });
        return true;
      }

      if (!emailData.body) {
        console.log("[ShieldBox] Email has no body content");
        sendResponse({ error: "Email has no content to scan" });
        return true;
      }

      console.log("[ShieldBox] Email data extracted successfully:", {
        subjectLength: emailData.subject?.length || 0,
        bodyLength: emailData.body?.length || 0,
        sender: emailData.sender || "Unknown"
      });

      sendResponse(emailData);
    } catch (error) {
      console.error("[ShieldBox] Error extracting email:", error);
      sendResponse({ error: "Error extracting email: " + error.message });
    }
    return true;
  }  // Handle auto-scan toggle changes from popup
  if (message.action === "toggleAutoScan") {
    autoScanEnabled = message.enabled;
    console.log('[ShieldBox] Auto-scan toggle changed:', autoScanEnabled);

    if (autoScanEnabled) {
      // Enable auto-scanning
      console.log('[ShieldBox] 🟢 Auto-scan ENABLED - Starting monitoring');
      scanningActive = true;
      startAutoScan();
      showFloatingPanel();
    } else {
      // Disable auto-scanning
      console.log('[ShieldBox] 🔴 Auto-scan DISABLED - Stopping all monitoring');
      scanningActive = false;
      stopAutoScan();
      hideFloatingPanel();

      // Clear any existing status messages
      window.postMessage({
        type: 'shield_box_update',
        action: 'displayAutoScanResult',
        result: 'Auto-scan disabled',
        status: 'disabled'
      }, '*');
    }

    sendResponse({ success: true });
    return true;
  }

  // Handle request for current auto-scan status
  if (message.action === "getAutoScanStatus") {
    sendResponse({
      enabled: autoScanEnabled,
      scanningActive: scanningActive
    });
    return true;
  }

  // Handle auto-scan settings changes from background
  if (message.action === "autoScanSettingsChanged") {
    const newEnabled = message.settings && message.settings.enabled;
    console.log('[ShieldBox] 🔄 Auto-scan settings changed. New enabled state:', newEnabled);

    if (newEnabled !== autoScanEnabled) {
      autoScanEnabled = newEnabled;

      if (autoScanEnabled) {
        console.log('[ShieldBox] 🟢 Auto-scan ENABLED via settings');
        scanningActive = true;
        startAutoScan();
      } else {
        console.log('[ShieldBox] 🔴 Auto-scan DISABLED via settings');
        scanningActive = false;
        stopAutoScan();
      }
    }

    sendResponse({ received: true });
    return true;
  }

  // Acknowledge receipt
  sendResponse({ received: true });
});

// Function to inject floating panel into the current page
function injectFloatingPanel() {
  console.log('[ShieldBox] 🚀 Injecting floating panel');

  // Check if panel already exists
  if (document.getElementById('shieldbox-floating-panel')) {
    console.log('[ShieldBox] Panel already exists, making it visible');
    document.getElementById('shieldbox-floating-panel').style.display = 'block';
    return;
  }

  // Create panel container
  const panelContainer = document.createElement('div');
  panelContainer.id = 'shieldbox-floating-panel';
  panelContainer.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    width: 320px;
    max-height: 480px;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 5px 25px rgba(0, 0, 0, 0.3);
    transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
  `;

  // Create shadow DOM for isolation
  const shadow = panelContainer.attachShadow({ mode: 'open' });

  // Create and load floating panel iframe
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('floatingpanel.html');
  iframe.style.cssText = `
    border: none;
    width: 100%;
    height: 100%;
    background: transparent;
    min-height: 320px;
  `;

  // Add minimize button
  const minimizeBtn = document.createElement('div');
  minimizeBtn.textContent = '—';
  minimizeBtn.style.cssText = `
    position: absolute;
    top: 5px;
    right: 30px;
    width: 25px;
    height: 25px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    z-index: 10;
  `;

  // Add close button
  const closeBtn = document.createElement('div');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    width: 25px;
    height: 25px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    z-index: 10;
  `;

  // Add elements to shadow DOM
  shadow.appendChild(iframe);
  shadow.appendChild(minimizeBtn);
  shadow.appendChild(closeBtn);

  // Add panel to page
  document.body.appendChild(panelContainer);

  // Add event listeners
  minimizeBtn.addEventListener('click', () => {
    panelContainer.style.transform = 'translateY(calc(100% - 40px))';
  });

  closeBtn.addEventListener('click', () => {
    panelContainer.style.display = 'none';
    // Update the state in the background script
    chrome.runtime.sendMessage({
      action: 'toggleFloatingPanel',
      visible: false
    });
  });

  console.log('[ShieldBox] Floating panel injected successfully');
  return panelContainer;
}

// AUTO-SCANNING FEATURE
// This section automatically collects URLs from the page and sends them for scanning,
// and also monitors for emails to scan automatically

// Track which URLs and emails we've already scanned to avoid duplicates
const scannedUrls = new Set();
const scannedEmails = new Set();
const emailScanResults = new Map(); // Store scan results for quick re-display
let scanningActive = true; // Whether auto scanning is enabled (can be toggled by user settings)
let autoScanEnabled = true; // Global state for auto-scan toggle
let scanInterval = null;
let emailScanInterval = null;

// Function to collect all URLs from the current page
function collectPageUrls() {
  const links = Array.from(document.getElementsByTagName('a'));
  const urls = links.map(link => link.href)
    .filter(url => url && url.startsWith('http') && !scannedUrls.has(url))
    .slice(0, 50); // Limit to 50 new URLs at a time to avoid overwhelming the backend

  urls.forEach(url => scannedUrls.add(url)); // Mark as processed

  return urls;
}

// Function to scan collected URLs
function scanCollectedUrls() {
  if (!scanningActive || !autoScanEnabled) {
    // console.log('[ShieldBox] Auto-scan is disabled, skipping URL collection.');
    return;
  }

  const urls = collectPageUrls();
  if (urls.length === 0) return;

  console.log(`[ShieldBox] Auto-scanning ${urls.length} URLs`);

  // Send the URLs to the background script for scanning
  chrome.runtime.sendMessage({
    action: 'autoScanUrls',
    data: { urls }
  }, (response) => {
    if (response && response.results) {
      processAutoScanResults(response.results);
    }
  });
}

// Function to extract email content for scanning
function extractEmailContent() {
  console.log('[ShieldBox] Extracting email content for scanning');

  // For debugging - remove this in production
  console.log('[ShieldBox] Page URL:', window.location.href);

  // Initialize variables for email content
  let content = '';
  let subject = document.title || '';
  let sender = '';

  // First try to use the extractEmailDetails function from emailParser.js if it exists
  if (typeof extractEmailDetails === 'function') {
    console.log('[ShieldBox] Using extractEmailDetails function from emailParser.js');
    const emailData = extractEmailDetails();
    if (emailData && emailData.body) {
      console.log('[ShieldBox] Successfully extracted email data from emailParser.js');
      return {
        content: emailData.body,
        subject: emailData.subject || document.title,
        sender: emailData.sender || ''
      };
    }
  }

  // Fallback: try to use the extractEmailData function if it exists
  if (typeof extractEmailData === 'function') {
    console.log('[ShieldBox] Using extractEmailData function');
    const emailData = extractEmailData();
    if (emailData && emailData.body) {
      console.log('[ShieldBox] Successfully extracted email data');
      return {
        content: emailData.body,
        subject: emailData.subject || document.title,
        sender: emailData.sender || ''
      };
    }
  }

  // Gmail-specific extraction

  // Gmail subject
  const subjectElement = document.querySelector('.ha h2');
  if (subjectElement) {
    subject = subjectElement.textContent.trim();
  }

  // Gmail sender
  const senderElement = document.querySelector('.gD');
  if (senderElement) {
    sender = senderElement.getAttribute('email') || senderElement.textContent.trim();
  }

  // Gmail body
  const bodyElement = document.querySelector('.ii.gt');
  if (bodyElement) {
    content = bodyElement.textContent.trim();
  }

  // Outlook-specific extraction
  if (!content) {
    const outlookBody = document.querySelector('.allowTextSelection');
    if (outlookBody) {
      content = outlookBody.textContent.trim();
    }

    const outlookSubject = document.querySelector('._2LiMA');
    if (outlookSubject) {
      subject = outlookSubject.textContent.trim();
    }

    const outlookSender = document.querySelector('._1Bnf8');
    if (outlookSender) {
      sender = outlookSender.textContent.trim();
    }
  }

  // If we still don't have content, try a more generic approach
  if (!content) {
    // Get all text from the main part of the page
    const mainContent = document.querySelector('main') || document.body;
    content = mainContent.textContent.trim();

    // Try to extract just the email part (this is a simplistic approach)
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    if (lines.length > 10) {
      // Take everything after the first few lines (likely headers)
      content = lines.slice(5).join('\n');
    }
  }

  // Log what we've found for debugging
  console.log(`[ShieldBox] Extracted email content - Subject: "${subject}" (${subject.length} chars)`);
  console.log(`[ShieldBox] Content length: ${content.length} chars`);

  // Always return something for analysis, even if minimal
  // If we have no real content, use the page title and URL as fallback
  if (!content || content.length < 50) {
    content = `${document.title}\n${window.location.href}\n${document.body.innerText.substring(0, 1000)}`;
    console.log('[ShieldBox] Using fallback content extraction method');
  }

  return {
    content: content,
    subject: subject,
    sender: sender
  };
}// Process the results of the auto scan
function processAutoScanResults(results) {
  // Find any phishing URLs
  const phishingUrls = results.filter(result => result.status === 'phishing');

  if (phishingUrls.length > 0) {
    console.warn('[ShieldBox] Detected phishing URLs:', phishingUrls);

    // Highlight the dangerous links on the page
    highlightDangerousLinks(phishingUrls.map(result => result.url));

    // Show a warning notification
    chrome.runtime.sendMessage({
      action: 'showPhishingWarning',
      data: {
        count: phishingUrls.length,
        urls: phishingUrls.map(result => result.url)
      }
    });
  }
}

// Highlight dangerous links on the page with a red border and warning icon
function highlightDangerousLinks(dangerousUrls) {
  // Find all links on the page that match dangerous URLs
  const links = Array.from(document.getElementsByTagName('a'));

  links.forEach(link => {
    if (dangerousUrls.includes(link.href)) {
      // Apply visual warning
      link.style.border = '2px solid red';
      link.style.padding = '2px';
      link.style.position = 'relative';
      link.dataset.shieldboxWarning = 'true';

      // Add warning icon
      const warningIcon = document.createElement('span');
      warningIcon.innerHTML = '⚠️';
      warningIcon.style.position = 'relative';
      warningIcon.style.marginLeft = '5px';
      warningIcon.title = 'ShieldBox Warning: Potential phishing link';
      link.appendChild(warningIcon);

      // Add click interceptor
      link.addEventListener('click', function (e) {
        if (confirm('ShieldBox Warning: This link has been identified as potentially dangerous. Are you sure you want to proceed?')) {
          // User confirmed, allow navigation
          return true;
        } else {
          // User canceled, prevent navigation
          e.preventDefault();
          return false;
        }
      });
    }
  });
}

// Function to detect if the page contains email content
function detectEmailContent() {
  console.log('[ShieldBox] Checking for email content...');

  // Debug mode - set to true to get more detailed console logs about elements found on the page
  const DEBUG_EMAIL_DETECTION = true;

  if (DEBUG_EMAIL_DETECTION) {
    // Log important Gmail elements to help with debugging
    console.log('[ShieldBox DEBUG] URL:', window.location.href);
    console.log('[ShieldBox DEBUG] .ii.gt element exists:', !!document.querySelector('.ii.gt'));
    console.log('[ShieldBox DEBUG] .h7 element exists:', !!document.querySelector('.h7'));
    console.log('[ShieldBox DEBUG] .a3s.aiL element exists:', !!document.querySelector('.a3s.aiL'));
    console.log('[ShieldBox DEBUG] .a3s element exists:', !!document.querySelector('.a3s'));
    console.log('[ShieldBox DEBUG] h2.hP element exists:', !!document.querySelector('h2.hP'));
    console.log('[ShieldBox DEBUG] .ha h2 element exists:', !!document.querySelector('.ha h2'));
    console.log('[ShieldBox DEBUG] .gD element exists:', !!document.querySelector('.gD'));
    console.log('[ShieldBox DEBUG] [role="main"] exists:', !!document.querySelector('[role="main"]'));
    console.log('[ShieldBox DEBUG] [data-message-id] exists:', !!document.querySelector('[data-message-id]'));

    // Try the emailParser.js function if available
    if (typeof extractEmailDetails === 'function') {
      console.log('[ShieldBox DEBUG] Testing extractEmailDetails...');
      const testExtraction = extractEmailDetails();
      console.log('[ShieldBox DEBUG] extractEmailDetails result:', {
        hasSubject: !!(testExtraction && testExtraction.subject),
        hasSender: !!(testExtraction && testExtraction.sender),
        hasBody: !!(testExtraction && testExtraction.body),
        bodyLength: testExtraction && testExtraction.body ? testExtraction.body.length : 0,
        subjectLength: testExtraction && testExtraction.subject ? testExtraction.subject.length : 0,
        fullResult: testExtraction
      });
    }

    // Take a snapshot of the full HTML structure (for internal debugging only)
    const htmlStructure = document.documentElement.outerHTML.substring(0, 500) + '... (truncated)';
    console.log('[ShieldBox DEBUG] Page structure preview:', htmlStructure);
  }

  try {
    // PRIORITY CHECK: Use emailParser.js extraction to determine if email content exists
    if (typeof extractEmailDetails === 'function') {
      console.log('[ShieldBox] Testing email extraction to determine if email content exists...');
      const extractionTest = extractEmailDetails();
      if (extractionTest && (extractionTest.body || extractionTest.subject) &&
        (extractionTest.body?.length > 20 || extractionTest.subject?.length > 3)) {
        console.log('[ShieldBox] Email content confirmed via extraction test');
        return true;
      }
    }

    // Check if we're on a common email domain
    const emailDomains = [
      'mail.google.com',
      'outlook.live.com',
      'outlook.office.com',
      'mail.yahoo.com',
      'mail.proton.me',
      'mail.aol.com'
    ];

    const isEmailDomain = emailDomains.some(domain => window.location.hostname.includes(domain));
    console.log('[ShieldBox] Is email domain:', isEmailDomain, 'Domain:', window.location.href);

    // If we're not on an email domain, we can immediately return false
    if (!isEmailDomain) {
      console.log('[ShieldBox] Not on an email domain, returning false');
      return false;
    }

    const currentUrl = window.location.href;
    let viewType = "unknown";

    // GMAIL DETECTION - More precise URL pattern checks
    if (window.location.hostname.includes('mail.google.com')) {
      // Check for standard /message/ pattern (most reliable)
      if (currentUrl.includes("/message/")) {
        console.log('[ShieldBox] Gmail /message/ pattern detected in URL');
        return true;
      }

      // Check URL patterns for an open email in Gmail - ANY message ID
      if (currentUrl.includes("#inbox/") && /[a-zA-Z0-9]{6,}$/i.test(currentUrl)) {
        console.log('[ShieldBox] Gmail inbox message pattern detected in URL');
        return true;
      }

      // Check specific sent message pattern - ANY message ID
      if (currentUrl.includes("#sent/") && /[a-zA-Z0-9]{6,}$/i.test(currentUrl)) {
        console.log('[ShieldBox] Gmail sent message pattern detected in URL');
        return true;
      }

      // More general pattern for any section with a message ID
      if (/#[a-z]+\/[a-zA-Z0-9]{6,}$/i.test(currentUrl)) {
        console.log('[ShieldBox] Gmail section with message ID detected in URL');
        return true;
      }

      // Check for label with message ID pattern
      if ((currentUrl.includes("#label/") || currentUrl.includes("#all/") ||
        currentUrl.includes("#category/") || currentUrl.includes("#inbox/")) &&
        /[a-zA-Z0-9]{6,}$/i.test(currentUrl)) {
        console.log('[ShieldBox] Gmail labeled email pattern detected in URL');
        return true;
      }      // Check for Gmail specific DOM elements for an open email - COMPREHENSIVE CHECK
      // Method 1: Classic Gmail elements
      if (document.querySelector('.h7') && document.querySelector('.ii.gt')) {
        console.log('[ShieldBox] Gmail classic email UI elements detected');
        return true;
      }

      // Method 2: Modern Gmail elements
      const messageBody = document.querySelector('.a3s.aiL');
      const subjectHeader = document.querySelector('h2.hP');
      if (messageBody && subjectHeader) {
        console.log('[ShieldBox] Gmail message body and subject detected');
        return true;
      }

      // Method 3: Alternative Gmail selectors for message content
      if (document.querySelector('[role="main"]') && document.querySelector('[data-message-id]')) {
        console.log('[ShieldBox] Gmail message with message-id detected');
        return true;
      }

      // Method 4: Look for specific Gmail thread structure
      const threadContainer = document.querySelector('.Bs.nH.iY.bAt');
      const emailBody = document.querySelector('.adn.ads');
      if (threadContainer && emailBody) {
        console.log('[ShieldBox] Gmail thread and email body detected');
        return true;
      }

      // Method 5: Check for the presence of email action buttons (reply, forward, etc.)
      const emailActions = document.querySelector('.ams.bkH, .iN > .aaq');
      if (emailActions) {
        console.log('[ShieldBox] Gmail email action buttons detected');
        return true;
      }

      // Check if we're in inbox view
      const inboxContainer = document.querySelector('.AO'); // Gmail inbox container
      const threadList = document.querySelector('.Cp'); // Thread list element
      if (inboxContainer && threadList) {
        console.log('[ShieldBox] Gmail inbox view detected - NOT an open email');
        viewType = "inbox";
      }
    }

    // OUTLOOK DETECTION
    if (window.location.hostname.includes('outlook.')) {
      // Check Outlook URL patterns
      if (currentUrl.includes('/mail/readmessage') || currentUrl.includes('/mail/read')) {
        console.log('[ShieldBox] Outlook email read view detected in URL');
        return true;
      }

      // Check Outlook DOM elements
      const outlookReadPane = document.querySelector('[aria-label="Reading Pane"]');
      const outlookMessageBody = document.querySelector('[aria-label="Message body"]');
      if (outlookReadPane || outlookMessageBody) {
        console.log('[ShieldBox] Outlook email reading elements detected');
        return true;
      }
    }

    // GENERAL EMAIL CHECKS - Fallback detection for all email providers
    // Check for typical email content structure - Expanded selectors
    const subjectSelectors = [
      '.ha h2', '.hP', 'h2[data-legacy-thread-id]', '[data-testid="message-header"] h1',
      '.message-subject', '.email-subject', '.subject-line', '[aria-label="Subject"]'
    ];

    const senderSelectors = [
      '.gD', '[email]', '[data-testid="message-header-from"]', '.sender',
      '.from-name', '.email-from', '[aria-label="From"]', '.mail-sender'
    ];

    const bodySelectors = [
      '.ii.gt div', '.ii.gt', '[aria-label="Message body"]', '[aria-label="Email body"]',
      '.email-content', '.message-content', '.mail-message-content', '.email-body-content',
      '.a3s.aiL', '.message-body-content', '[role="main"] [role="presentation"]'
    ];

    // Check if any of these selectors match elements on the page
    const hasSubject = subjectSelectors.some(selector => document.querySelector(selector) !== null);
    const hasSender = senderSelectors.some(selector => document.querySelector(selector) !== null);
    const hasBody = bodySelectors.some(selector => document.querySelector(selector) !== null);

    console.log('[ShieldBox] General email checks - Subject:', hasSubject, 'Sender:', hasSender, 'Body:', hasBody);

    // Improved detection logic: 
    // 1. If we have both subject and body, it's very likely an email
    if (hasSubject && hasBody) {
      console.log('[ShieldBox] Email content detected (subject + body)');
      return true;
    }

    // 2. If we have both sender and body, also likely an email
    if (hasSender && hasBody) {
      console.log('[ShieldBox] Email content detected (sender + body)');
      return true;
    }

    // 3. If all three elements exist, definitely an email
    if (hasSubject && hasSender && hasBody) {
      console.log('[ShieldBox] Email content definitely detected (all elements)');
      return true;
    } console.log('[ShieldBox] No email detected, view type:', viewType);
    return false;
  } catch (error) {
    console.error('[ShieldBox] Error in email detection:', error);
    // Default to false if there's an error
    return false;
  }
}

// Extract email data from the page
function extractEmailData() {
  try {
    console.log('[ShieldBox] Extracting email data...');

    // First try to use the comprehensive extractEmailDetails function from emailParser.js
    if (typeof extractEmailDetails === 'function') {
      console.log('[ShieldBox] Using extractEmailDetails from emailParser.js in extractEmailData');
      const emailDetails = extractEmailDetails();
      console.log('[ShieldBox] emailParser result in extractEmailData:', emailDetails);

      if (emailDetails && (emailDetails.body || emailDetails.subject) &&
        (emailDetails.body?.length > 10 || emailDetails.subject?.length > 3)) {
        console.log('[ShieldBox] Successfully extracted email using emailParser.js in extractEmailData');

        // Create a unique ID for this email to avoid duplicate scans
        const urlPart = window.location.href.split('#')[1] || '';
        const emailId = `${urlPart}|${emailDetails.subject}|${emailDetails.sender}|${emailDetails.body ? emailDetails.body.substring(0, 100) : ''}`;

        // For manual scans, always allow extraction
        const isManualScan = arguments.length > 0 && arguments[0] === 'manual';

        // ⭐ DON'T add to scannedEmails here - only add AFTER successful scan result
        console.log('[ShieldBox] Email extracted (emailParser path), not marking as scanned yet');

        return {
          subject: emailDetails.subject || '',
          sender: emailDetails.sender || emailDetails.senderEmail || '',
          body: emailDetails.body || '',
          emailId: emailId
        };
      }
    }

    // Try to find the subject line
    const subjectSelectors = [
      '.ha h2', // Gmail 
      '.ha .hP', // Gmail subject alternative
      'h2[data-legacy-thread-id]', // Gmail subject with thread ID
      '[data-testid="message-header"] h1', // Outlook
      '.message-subject', // Yahoo
      '[aria-label="Subject"]',
      '.email-subject',
      'h1.subject',
      '.mail-header h2'
    ];

    let subject = '';
    for (const selector of subjectSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        subject = element.innerText.trim();
        console.log('[ShieldBox] Found subject with selector:', selector, 'Subject:', subject);
        break;
      }
    }

    // Try to find the sender - Gmail specific
    const senderSelectors = [
      '.go .gb .gD', // Gmail sender name
      '.go .gb', // Gmail sender area
      '[email]', // Email attribute
      '[data-testid="message-header-from"]', // Outlook
      '.sender-info',
      '.from-text',
      '.mail-sender'
    ];

    let sender = '';
    for (const selector of senderSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        sender = element.innerText.trim() || element.getAttribute('email') || '';
        if (sender) {
          console.log('[ShieldBox] Found sender with selector:', selector, 'Sender:', sender);
          break;
        }
      }
    }

    // Try to find the email body - Gmail specific
    const bodySelectors = [
      '.ii.gt div', // Gmail email body content
      '.ii.gt', // Gmail email body
      '[aria-label="Message body"]',
      '[aria-label="Email body"]',
      '.message-body',
      '.email-content',
      '.mail-message-body',
      '.body-content'
    ];

    let body = '';
    for (const selector of bodySelectors) {
      const element = document.querySelector(selector);
      if (element) {
        body = element.innerText.trim();
        if (body) {
          console.log('[ShieldBox] Found body with selector:', selector, 'Body length:', body.length);
          break;
        }
      }
    }

    // If we couldn't find the body with selectors, try a more generic approach
    if (!body) {
      console.log('[ShieldBox] No body found with selectors, trying generic approach...');
      // Get all links in the email area for basic phishing detection
      const links = Array.from(document.querySelectorAll('a[href^="http"]'));
      body = links.map(link => link.href).join('\n');
      console.log('[ShieldBox] Extracted', links.length, 'links as body content');
    }

    // Create a unique ID for this email to avoid duplicate scans
    // Use URL + subject + first part of body for uniqueness
    const urlPart = window.location.href.split('#')[1] || ''; // Gmail hash part
    const emailId = `${urlPart}|${subject}|${sender}|${body.substring(0, 100)}`;

    console.log('[ShieldBox] Generated email ID:', emailId.substring(0, 100) + '...');

    // For manual scans, always allow extraction
    const isManualScan = arguments.length > 0 && arguments[0] === 'manual';

    // ⭐ NEW LOGIC: Always return email data for re-entries to allow cached results
    // Only skip if this is an auto-scan AND we don't have enough content
    if (!body || body.length < 20) { // Increased threshold from 10 to 20
      console.log('[ShieldBox] Email content too short or empty, skipping scan');
      return null;
    }

    // ⭐ DON'T add to scannedEmails here - only add AFTER successful scan result  
    console.log('[ShieldBox] Email extracted (fallback path), not marking as scanned yet');

    return {
      subject,
      sender,
      body,
      emailId
    };
  } catch (err) {
    console.error('[ShieldBox] Error extracting email data:', err);
    return null;
  }
}

// Function to show the floating panel
function showFloatingPanel() {
  console.log('[ShieldBox] 📱 Showing floating panel');

  // Send message to any existing floating panels
  window.postMessage({
    type: 'shield_box_control',
    action: 'show_panel'
  }, '*');

  // Also ensure the floating panel container is visible if it exists
  const panel = document.getElementById('shieldbox-floating-panel');
  if (panel) {
    panel.style.display = 'block';
    panel.style.opacity = '1';
    panel.style.visibility = 'visible';
    panel.style.transform = 'none';
    console.log('[ShieldBox] Floating panel container shown');
  }

  // Legacy iframe support (in case any old implementation exists)
  const iframe = document.getElementById('shield-box-iframe');
  if (iframe) {
    iframe.style.display = 'block';
    iframe.style.opacity = '1';
    console.log('[ShieldBox] Legacy iframe shown');
  }
}

// Function to hide the floating panel
function hideFloatingPanel() {
  console.log('[ShieldBox] 📱 Hiding floating panel');

  // Send message to floating panels to hide
  window.postMessage({
    type: 'shield_box_control',
    action: 'hide_panel'
  }, '*');

  // Also hide the floating panel container if it exists
  const panel = document.getElementById('shieldbox-floating-panel');
  if (panel) {
    panel.style.display = 'none';
    panel.style.opacity = '0';
    panel.style.visibility = 'hidden';
    panel.style.transform = 'translateX(-9999px)';
    console.log('[ShieldBox] Floating panel container hidden');
  }

  // Legacy iframe support (in case any old implementation exists)
  const iframe = document.getElementById('shield-box-iframe');
  if (iframe) {
    iframe.style.display = 'none';
    iframe.style.opacity = '0';
    console.log('[ShieldBox] Legacy iframe hidden');
  }
}

// Scan the current email if we're on an email page
let lastScannedEmailId = null; // Track the last scanned email to avoid re-scanning
function scanCurrentEmail(isManualTrigger = false) {
  console.log('[ShieldBox] scanCurrentEmail() called, manual trigger:', isManualTrigger);

  // ⭐ FIRST CHECK: Is auto-scan enabled? (Skip this check for manual triggers)
  if (!isManualTrigger && (!autoScanEnabled || !scanningActive)) {
    console.log('[ShieldBox] Auto-scan is disabled, skipping automatic email scan');
    return;
  }

  // Check for email content with detailed debugging
  const isEmailDetected = detectEmailContent();

  if (!isEmailDetected) {
    console.log('[ShieldBox] Not on an email page, skipping scan');

    // Reset last scanned email when no email is detected
    lastScannedEmailId = null;

    // Add additional information about why detection failed
    const isGmail = window.location.hostname.includes('mail.google.com');
    let detailedMessage = 'No email activity detected';
    let statusClass = 'inactive';

    if (isGmail) {
      detailedMessage = 'Detected Gmail, but no open email found';
      statusClass = 'no-email';
    }

    // Send enhanced "no activity" status when not on email page
    chrome.runtime.sendMessage({
      action: 'displayAutoScanResult',
      result: detailedMessage,
      status: statusClass,
      data: {
        timestamp: new Date().toISOString(),
        reason: 'No email content detected in current view'
      }
    });

    // Also update the UI through window messaging for direct UI updates
    window.postMessage({
      type: 'shield_box_update',
      action: 'displayAutoScanResult',
      result: detailedMessage,
      status: statusClass
    }, '*');

    return; // Not an email page
  }

  console.log('[ShieldBox] Email page detected, extracting email data...');

  // Try to extract email data using emailParser.js first, then fallback
  let emailData = null;

  if (typeof extractEmailDetails === 'function') {
    console.log('[ShieldBox] Using extractEmailDetails from emailParser.js for auto-scan');
    const emailDetails = extractEmailDetails();
    console.log('[ShieldBox] emailParser.js returned for auto-scan:', emailDetails);

    if (emailDetails && (emailDetails.body || emailDetails.subject) &&
      (emailDetails.body?.length > 20 || emailDetails.subject?.length > 3)) { // Increased threshold
      const urlPart = window.location.href.split('#')[1] || '';
      const emailId = `${urlPart}|${emailDetails.subject}|${emailDetails.sender}|${emailDetails.body ? emailDetails.body.substring(0, 100) : ''}`;

      emailData = {
        subject: emailDetails.subject || '',
        sender: emailDetails.sender || emailDetails.senderEmail || '',
        body: emailDetails.body || '',
        emailId: emailId
      };
      console.log('[ShieldBox] Successfully extracted email using emailParser.js for auto-scan');
    } else {
      console.log('[ShieldBox] emailParser.js did not find sufficient content for auto-scan');
    }
  }

  // Fallback to content-script.js extraction method
  if (!emailData || !emailData.body) {
    console.log('[ShieldBox] Falling back to extractEmailData method');
    emailData = extractEmailData(); // Don't mark as manual for auto-scans
  }

  if (!emailData) {
    console.log('[ShieldBox] No email data found');
    lastScannedEmailId = null;
    // Send "no content" status
    chrome.runtime.sendMessage({
      action: 'displayAutoScanResult',
      result: 'Email detected but no content found',
      status: 'no-content',
      data: { timestamp: new Date().toISOString() }
    });
    return;
  }

  if (!emailData.body) {
    console.log('[ShieldBox] No email body content found');
    lastScannedEmailId = null;
    // Send "no body" status
    chrome.runtime.sendMessage({
      action: 'displayAutoScanResult',
      result: 'Email opened but no body content to scan',
      status: 'no-content',
      data: { timestamp: new Date().toISOString() }
    });
    return;
  }

  // ⭐ PRIORITY 1: Check if we have a cached result for this email (ALWAYS show cached results first)
  if (emailScanResults.has(emailData.emailId)) {
    const cachedResult = emailScanResults.get(emailData.emailId);
    console.log('[ShieldBox] 📋 LEVEL 1: Found cached result for this email, showing immediately:', cachedResult);

    // Send the cached result immediately
    chrome.runtime.sendMessage({
      action: 'displayAutoScanResult',
      result: cachedResult.result,
      status: cachedResult.status,
      htmlContent: cachedResult.htmlContent,
      data: {
        ...cachedResult.data,
        timestamp: new Date().toISOString(),
        cached: true
      }
    });

    // Also send directly to UI
    window.postMessage({
      type: 'shield_box_update',
      action: 'displayAutoScanResult',
      result: cachedResult.result,
      status: cachedResult.status,
      htmlContent: cachedResult.htmlContent,
      data: {
        ...cachedResult.data,
        timestamp: new Date().toISOString(),
        cached: true
      }
    }, '*');

    // Update tracking
    lastScannedEmailId = emailData.emailId;
    return; // Don't scan again, show cached result
  }

  // ⭐ PRIORITY 2: Check if this is the same email we just scanned (avoid immediate re-scan)
  if (lastScannedEmailId === emailData.emailId) {
    console.log('[ShieldBox] 📋 LEVEL 2: Same email as last scan, no cached result found');
    return; // Don't scan again for same email
  }

  // Update the last scanned email ID
  lastScannedEmailId = emailData.emailId;

  // ⭐ PRIORITY 3: Check if this email was scanned before but we lost the cache (show generic message)
  if (scannedEmails.has(emailData.emailId)) {
    console.log('[ShieldBox] 📝 LEVEL 3: Email was scanned before but no cache found. Showing generic message.');

    // Send a generic "previously scanned" message
    chrome.runtime.sendMessage({
      action: 'displayAutoScanResult',
      result: `Previously scanned: "${emailData.subject || 'No subject'}"`,
      status: 'safe', // Default to safe if we don't have cached result
      htmlContent: '<b>✅ PREVIOUSLY SCANNED</b><br>This email was analyzed before.',
      data: {
        subject: emailData.subject,
        sender: emailData.sender,
        timestamp: new Date().toISOString(),
        previouslyScanned: true
      }
    });

    window.postMessage({
      type: 'shield_box_update',
      action: 'displayAutoScanResult',
      result: `Previously scanned: "${emailData.subject || 'No subject'}"`,
      status: 'safe',
      htmlContent: '<b>✅ PREVIOUSLY SCANNED</b><br>This email was analyzed before.',
      data: {
        subject: emailData.subject,
        sender: emailData.sender,
        timestamp: new Date().toISOString(),
        previouslyScanned: true
      }
    }, '*');

    return; // Don't scan again
  }

  console.log('[ShieldBox] ✅ NEW EMAIL OPENED - Auto-scanning email:', {
    subject: emailData.subject || 'No subject',
    sender: emailData.sender || 'Unknown sender',
    bodyLength: emailData.body ? emailData.body.length : 0,
    emailId: emailData.emailId
  });

  // Send "email found and scanning" status with details
  chrome.runtime.sendMessage({
    action: 'displayAutoScanResult',
    result: `Scanning email: "${emailData.subject || 'No subject'}"`,
    status: 'scanning',
    data: {
      subject: emailData.subject,
      sender: emailData.sender,
      timestamp: new Date().toISOString(),
      bodyLength: emailData.body.length
    }
  });

  // Also send directly to any listening UI components
  window.postMessage({
    type: 'shield_box_update',
    action: 'displayAutoScanResult',
    result: `Scanning email: "${emailData.subject || 'No subject'}"`,
    status: 'scanning',
    data: {
      subject: emailData.subject,
      sender: emailData.sender,
      timestamp: new Date().toISOString(),
      bodyLength: emailData.body.length
    }
  }, '*');

  // Send to background for ACTUAL scanning (this will trigger the real scan)
  console.log('[ShieldBox] 📤 Sending scanAutoEmail message to background script...');
  chrome.runtime.sendMessage({
    action: 'scanAutoEmail',
    data: emailData
  }, (response) => {
    console.log('[ShieldBox] 📬 Auto-scan response received from background:', response);

    if (chrome.runtime.lastError) {
      console.error('[ShieldBox] ❌ Chrome runtime error in auto-scan callback:', chrome.runtime.lastError);
    }

    if (response) {
      console.log('[ShieldBox] ✅ Background processed auto-scan successfully');

      // If we got a response, also send the result directly to ensure UI updates
      if (response.status === 'done' && response.emailType) {
        console.log('[ShieldBox] 🔄 Sending auto-scan result directly to UI as backup');

        const directMessage = {
          action: 'displayAutoScanResult',
          result: `Auto-scan: ${response.emailType} detected`,
          status: response.emailType,
          htmlContent: response.htmlContent || `<b>Auto-scan complete</b><br>Result: ${response.emailType}`,
          data: {
            timestamp: new Date().toISOString(),
            emailType: response.emailType,
            directCallback: true
          }
        };

        // ⭐ CACHE THE RESULT for future re-entries to this email
        emailScanResults.set(emailData.emailId, {
          result: directMessage.result,
          status: directMessage.status,
          htmlContent: directMessage.htmlContent,
          data: directMessage.data
        });
        console.log('[ShieldBox] 💾 Cached scan result for email:', emailData.emailId);

        // ⭐ NOW mark this email as scanned (only after successful cache)
        scannedEmails.add(emailData.emailId);
        console.log('[ShieldBox] ✅ Email marked as scanned AFTER successful result. Total scanned emails:', scannedEmails.size);

        // Clean up cache if it gets too large (keep only last 50 results)
        if (emailScanResults.size > 50) {
          const firstKey = emailScanResults.keys().next().value;
          emailScanResults.delete(firstKey);
          console.log('[ShieldBox] 🧹 Cleaned up old cache entry');
        }

        // Send directly via window message as backup
        window.postMessage({
          type: 'shield_box_update',
          ...directMessage
        }, '*');

        // Also try to send to iframe directly
        const iframe = document.getElementById('shield-box-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'chrome_extension_message',
            data: directMessage
          }, '*');
        }
      }
    } else {
      console.log('[ShieldBox] ⚠️ No response from background script');

      // Send a fallback result after 5 seconds if no proper result comes
      setTimeout(() => {
        console.log('[ShieldBox] 🔄 Sending fallback auto-scan result...');
        window.postMessage({
          type: 'shield_box_update',
          action: 'displayAutoScanResult',
          result: 'Auto-scan completed (fallback)',
          status: 'safe',
          htmlContent: '<b>✅ AUTO-SCAN COMPLETE</b><br>Analysis finished (using fallback).',
          data: { timestamp: new Date().toISOString(), fallback: true }
        }, '*');
      }, 5000);
    }

    // The background script will send displayAutoScanResult messages automatically
    // so we don't need to send completion status here unless there's an error
  });
}

// Start auto scanning when the page is loaded
function startAutoScan() {
  // Initial scan after 2 seconds to allow page to load completely
  setTimeout(() => {
    scanCollectedUrls();
    // Also check for email content
    scanCurrentEmail();
  }, 2000);

  // Then scan every 2 minutes for any new links that might have been added to the page
  scanInterval = setInterval(scanCollectedUrls, 120000);

  // Check for new emails every 5 seconds for responsive navigation
  emailScanInterval = setInterval(scanCurrentEmail, 5000);
}// Function to stop auto scanning
function stopAutoScan() {
  scanningActive = false;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  if (emailScanInterval) {
    clearInterval(emailScanInterval);
    emailScanInterval = null;
  }
  if (urlCheckInterval) {
    clearInterval(urlCheckInterval);
    urlCheckInterval = null;
  }
  console.log('[ShieldBox] Auto-scanning stopped');
}

// Check user preferences before starting and set up toggle listener
chrome.runtime.sendMessage({ action: 'getAutoScanPreference' }, (response) => {
  if (response && response.autoScanEnabled !== false) {
    // Auto scan is enabled by default or explicitly enabled
    autoScanEnabled = true;
    scanningActive = true;
    startAutoScan();
    showFloatingPanel();
    console.log('[ShieldBox] 🟢 Auto-scan initialized as ENABLED');
  } else {
    // Auto scan is disabled
    autoScanEnabled = false;
    scanningActive = false;
    hideFloatingPanel();
    console.log('[ShieldBox] 🔴 Auto-scan initialized as DISABLED');
  }
});

// Handle mutations to detect new links added to the page dynamically
const observer = new MutationObserver((mutations) => {
  if (!scanningActive || !autoScanEnabled) return;

  let newLinksAdded = false;
  let emailContentChanged = false;
  let emailContentRemoved = false;

  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      const links = Array.from(mutation.addedNodes)
        .filter(node => node.nodeType === 1) // Element nodes
        .flatMap(node => {
          if (node.tagName === 'A') return [node];
          return Array.from(node.getElementsByTagName('a'));
        });

      if (links.length > 0) {
        newLinksAdded = true;
      }

      // Check if email content was added to the page
      const emailElements = Array.from(mutation.addedNodes)
        .filter(node => node.nodeType === 1)
        .some(node => {
          // Gmail specific selectors for email content
          return node.matches && (
            node.matches('[role="main"]') ||
            node.matches('.ii.gt') || // Gmail email body
            node.matches('[data-message-id]') ||
            node.matches('.ha') || // Gmail subject area
            node.matches('.email-body') ||
            node.matches('.message-body')
          );
        });

      if (emailElements) {
        emailContentChanged = true;
        console.log('[ShieldBox] New email content detected via DOM mutation');
      }

      // Check if email content was removed from the page
      const emailElementsRemoved = Array.from(mutation.removedNodes)
        .filter(node => node.nodeType === 1)
        .some(node => {
          return node.matches && (
            node.matches('[role="main"]') ||
            node.matches('.ii.gt') ||
            node.matches('[data-message-id]') ||
            node.matches('.ha')
          );
        });

      if (emailElementsRemoved) {
        emailContentRemoved = true;
        console.log('[ShieldBox] Email content removed - email likely closed');
      }
    }
  });

  if (newLinksAdded) {
    // New links were added to the page, scan after a short delay
    setTimeout(scanCollectedUrls, 1000);
  }

  if (emailContentChanged) {
    // New email content detected, scan immediately
    console.log('[ShieldBox] Triggering immediate email scan due to content change');
    setTimeout(scanCurrentEmail, 200);
  }

  if (emailContentRemoved) {
    // Email content removed, reset all scan statuses
    console.log('[ShieldBox] Email content removed, resetting scan status');
    lastScannedEmailId = null; // Reset the last scanned email ID
    setTimeout(() => {
      // Reset auto-scan status
      chrome.runtime.sendMessage({
        action: 'displayAutoScanResult',
        result: 'No email activity detected',
        status: 'inactive',
        data: { timestamp: new Date().toISOString() }
      });

      // Reset manual scan status
      chrome.runtime.sendMessage({
        action: 'displayResult',
        source: 'email',
        result: 'No email currently open',
        status: 'inactive'
      });

      // Send resetEmailScan message to reset any scan UI
      chrome.runtime.sendMessage({
        action: 'resetEmailScan'
      });
    }, 300); // Faster reset for responsiveness
  }
});

// Gmail-specific: Monitor URL changes for email navigation
let lastUrl = window.location.href;
let lastEmailState = null; // Track if we were previously on an email
let urlCheckInterval = setInterval(() => {
  // Skip URL monitoring if auto-scan is disabled
  if (!autoScanEnabled || !scanningActive) return;

  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    console.log('[ShieldBox] URL changed, checking for new email content');
    console.log('[ShieldBox] Previous URL:', lastUrl);
    console.log('[ShieldBox] Current URL:', currentUrl);

    lastUrl = currentUrl;

    // Check if this looks like an email view URL
    const isEmailView = currentUrl.includes('mail.google.com') &&
      (currentUrl.includes('#inbox/') || currentUrl.includes('#search/') ||
        currentUrl.includes('#sent/') || currentUrl.includes('#drafts/'));

    if (isEmailView) {
      console.log('[ShieldBox] Email navigation detected, scanning after delay');
      lastEmailState = 'email_open';
      // Wait a bit for content to load, then scan
      setTimeout(scanCurrentEmail, 800);
    } else if (lastEmailState === 'email_open') {
      // User navigated away from email view
      console.log('[ShieldBox] User navigated away from email, resetting scan status');
      lastEmailState = 'email_closed';
      lastScannedEmailId = null; // Reset the last scanned email ID

      // Use the resetScanStatus action to handle resetting all UI elements
      chrome.runtime.sendMessage({
        action: 'resetScanStatus'
      });
    }
  }
}, 500); // Check every 500ms for very responsive navigation

// Start observing the document for changes
observer.observe(document.body, {
  childList: true,
  subtree: true
});
