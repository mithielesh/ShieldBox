// Wait for DOM content to be fully loaded before accessing elements
document.addEventListener('DOMContentLoaded', () => {
  // Get references to DOM elements
  const autoScanToggle = document.getElementById('autoScanToggle');
  const iotToggle = document.getElementById('iotToggle');
  const scanBtn = document.getElementById('scanBtn');
  const urlInput = document.getElementById('urlInput');
  const manualResultBox = document.getElementById('manualResultBox');
  const autoResultBox = document.getElementById('autoResultBox');

  // Handle paste events on URL input to prevent freezing
  urlInput.addEventListener('paste', (e) => {
    // Instead of preventing default, let the default paste happen
    // and then process the input afterward with a very short delay
    setTimeout(() => {
      // Now the input has the pasted content
      let pastedText = urlInput.value.trim();

      if (pastedText.length > 100) {
        console.log("[ShieldBox] Long URL detected, processing...");
        try {
          // Try to extract the base URL without query params and fragments
          const url = new URL(pastedText);
          const simplified = url.origin + url.pathname;
          if (simplified.length < pastedText.length) {
            console.log("[ShieldBox] Simplified URL:", simplified);
            urlInput.value = simplified;
          }
        } catch (err) {
          console.log("[ShieldBox] URL parsing failed, using original");
          // If URL is extremely long, truncate it
          if (pastedText.length > 500) {
            urlInput.value = pastedText.substring(0, 500);
          }
        }
      }

      // Clear any previous scan results when pasting a new URL
      manualResultBox.textContent = "URL pasted. Click Scan to analyze.";
      manualResultBox.className = "result-box";
    }, 10); // Very short delay to let paste complete first
  });

  // Listen for ML scan updates from background.js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updateScanResult") {
      const result = message.result;
      console.log("[ShieldBox] Received updated scan result:", result);

      if (result && result.url === urlInput.value.trim()) {
        updateResultDisplay(result);
      }
    }

    // Handle auto-scan result updates
    if (message.action === "displayAutoScanResult") {
      console.log("[ShieldBox] Received auto-scan update:", message);
      updateAutoScanResultDisplay(message.result, message.status, message.data);
    }

    // Handle email scan results from background.js
    if (message.action === "displayEmailResult") {
      console.log("[ShieldBox] Received email scan result:", message);
      const emailResultBox = document.getElementById('emailResultBox');
      const status = message.result;
      const details = message.details || {};

      // Create a formatted display for email scan results
      let displayHTML = '';

      // Get email category with proper capitalization
      const category = details.category ? details.category.charAt(0).toUpperCase() + details.category.slice(1) : "Unknown";

      // Log detailed information for debugging
      console.log(`[ShieldBox] Email scan status: ${status}, category: ${category}`);
      console.log(`[ShieldBox] Email scan details:`, details);

      if (status === "phishing") {
        // Show specific email type in the main status message
        if (details.category && details.category !== "phishing") {
          displayHTML = `<div class="scan-status phishing">⚠️ ${category} email detected!</div>`;
        } else {
          displayHTML = `<div class="scan-status phishing">⚠️ Phishing email detected!</div>`;
        }
        emailResultBox.className = "result-box phishing";
      } else if (status === "safe") {
        if (details.category === "spam") {
          // Special case for spam, which is "safe" but still highlighted
          displayHTML = `<div class="scan-status">⚠️ Spam email detected</div>`;
          emailResultBox.className = "result-box spam";
        } else {
          displayHTML = `<div class="scan-status safe">✅ Email appears safe.</div>`;
          emailResultBox.className = "result-box safe";
        }
      } else if (status === "scanning") {
        displayHTML = `<div class="scan-status scanning">🔍 Scanning email...</div>`;
        emailResultBox.className = "result-box scanning";
      } else if (status === "error") {
        // Handle error cases
        displayHTML = `<div class="scan-status error">⚠️ Error scanning email</div>`;
        if (details.message) {
          displayHTML += `<div>${details.message}</div>`;
        }
        emailResultBox.className = "result-box error";
      } else {
        // For other statuses, show category if available
        if (details.category) {
          displayHTML = `<div class="scan-status">Email type: ${category}</div>`;
        } else {
          displayHTML = `<div class="scan-status">Email scan: ${status}</div>`;
        }
        emailResultBox.className = "result-box";
      }

      // Add email classification type with badge
      if (details.category) {
        displayHTML += `<div class="email-type-badge ${details.category}">${category}</div>`;
      }

      if (details.confidence) {
        const confidencePercent = Math.round(details.confidence * 100);
        displayHTML += `<div><strong>Confidence:</strong> ${confidencePercent}%</div>`;
      }

      if (details.features && details.features.length > 0) {
        displayHTML += `<div><strong>Key indicators:</strong>`;
        displayHTML += `<ul class="feature-list">`;
        details.features.forEach(feature => {
          displayHTML += `<li>${feature}</li>`;
        });
        displayHTML += `</ul></div>`;
      }

      emailResultBox.innerHTML = displayHTML;
    }
  });

  // Function to update the result display based on scan result
  function updateResultDisplay(result) {
    const status = result.status || "Unknown";

    if (status.toLowerCase() === "phishing") {
      chrome.storage.sync.get('iotEnabled', (data) => {
        const iotStatus = data.iotEnabled;
        manualResultBox.textContent = result.details || (iotStatus
          ? "⚠️ Phishing detected. IoT alert sent!"
          : "⚠️ Phishing detected.");
        manualResultBox.className = "result-box phishing";
      });
    } else if (status.toLowerCase() === "safe") {
      manualResultBox.textContent = result.details || "✅ Link is safe.";
      manualResultBox.className = "result-box safe";
    } else {
      manualResultBox.textContent = result.details || `Status: ${status.toUpperCase()}`;
      manualResultBox.className = "result-box";
    }
  }

  function updateAutoScanResultDisplay(message, status, details) {
    if (!message) return;

    // Create a formatted display for auto-scan results
    let displayHTML = '';

    if (typeof details === 'object' && details) {
      // Handle different status types
      if (status === 'scanning') {
        displayHTML = `<div>🔍 ${message}</div>`;
        if (details.subject) {
          displayHTML += `<div><strong>Subject:</strong> ${details.subject}</div>`;
        }
        if (details.sender) {
          displayHTML += `<div><strong>From:</strong> ${details.sender}</div>`;
        }
      } else if (status === 'inactive') {
        displayHTML = `<div>😴 ${message}</div>`;
      } else if (status === 'no-content') {
        displayHTML = `<div>⚠️ ${message}</div>`;
      } else {
        // This is a completed scan result with details
        displayHTML = `<div>${message}</div>`;

        if (details.subject) {
          displayHTML += `<div><strong>Email:</strong> ${details.subject}</div>`;
        }

        if (details.phishingLinks && details.phishingLinks.length > 0) {
          displayHTML += `<div class="phishing-links">`;
          displayHTML += `<strong>Suspicious Links (${details.phishingLinks.length}):</strong>`;
          displayHTML += `<ul>`;
          details.phishingLinks.forEach(link => {
            // Truncate long URLs for display
            const displayUrl = link.length > 50 ? link.substring(0, 47) + '...' : link;
            displayHTML += `<li title="${link}">${displayUrl}</li>`;
          });
          displayHTML += `</ul>`;
          displayHTML += `</div>`;
        }
      }
    } else {
      // Simple message without details
      if (status === 'scanning') {
        displayHTML = `🔍 ${message}`;
      } else if (status === 'inactive') {
        displayHTML = `😴 ${message}`;
      } else if (status === 'no-content') {
        displayHTML = `⚠️ ${message}`;
      } else {
        displayHTML = message;
      }
    }

    // Set appropriate CSS class based on status
    if (status === "phishing") {
      autoResultBox.innerHTML = displayHTML;
      autoResultBox.className = "result-box phishing";
    } else if (status === "safe") {
      autoResultBox.innerHTML = displayHTML;
      autoResultBox.className = "result-box safe";
    } else if (status === "scanning") {
      autoResultBox.innerHTML = displayHTML;
      autoResultBox.className = "result-box scanning";
    } else if (status === "inactive") {
      autoResultBox.innerHTML = displayHTML;
      autoResultBox.className = "result-box inactive";
    } else {
      autoResultBox.innerHTML = displayHTML;
      autoResultBox.className = "result-box";
    }
  }

  // Get references to the new auto scan controls
  const scanIntervalSelect = document.getElementById('scanIntervalSelect');
  const notifyToggle = document.getElementById('notifyToggle');
  const highlightToggle = document.getElementById('highlightToggle');
  const autoScanSettings = document.getElementById('autoScanSettings');
  const scanEmailBtn = document.getElementById('scanEmailBtn'); // Add scan email button reference

  // Add scan email button functionality
  if (scanEmailBtn) {
    scanEmailBtn.addEventListener('click', () => {
      const emailResultBox = document.getElementById('emailResultBox');
      emailResultBox.innerHTML = "<div class='scan-status scanning'>🔍 Scanning email...</div>";
      emailResultBox.className = "result-box scanning";

      chrome.runtime.sendMessage({ action: "scanEmail" }, (response) => {
        console.log("[ShieldBox] Email scan response:", response);
        // Response should come via displayEmailResult message listener

        // But as a fallback, if we get a direct response, use it
        if (response && response.status === "success") {
          const result = response.result;
          const category = response.category;

          console.log(`[ShieldBox] Received direct scan response: ${result} (${category})`);

          // If 10 seconds pass and we haven't updated the UI, show the result
          setTimeout(() => {
            if (emailResultBox.classList.contains("scanning")) {
              console.log("[ShieldBox] Using fallback display for scan results");

              if (result === "phishing") {
                const displayCategory = category.charAt(0).toUpperCase() + category.slice(1);
                emailResultBox.innerHTML = `<div class="scan-status phishing">⚠️ ${displayCategory} email detected!</div>`;
                emailResultBox.className = "result-box phishing";
              } else if (result === "safe") {
                emailResultBox.innerHTML = `<div class="scan-status safe">✅ Email appears safe.</div>`;
                emailResultBox.className = "result-box safe";
              } else {
                emailResultBox.innerHTML = `<div class="scan-status">Email scan complete: ${result}</div>`;
                emailResultBox.className = "result-box";
              }
            }
          }, 5000);
        }
      });
    });
  }

  // Function to update auto scan settings
  function updateAutoScanSettings() {
    const settings = {
      enabled: autoScanToggle.checked,
      scanInterval: parseInt(scanIntervalSelect.value),
      notifyOnPhishing: notifyToggle.checked,
      highlightLinks: highlightToggle.checked
    };

    // Update background script settings
    chrome.runtime.sendMessage({
      action: "updateAutoScanSettings",
      data: settings
    }, (response) => {
      console.log("[ShieldBox] Auto scan settings updated:", response);
    });

    // Save settings to storage for content scripts to read
    chrome.storage.sync.set({ autoScanSettings: settings });
    chrome.storage.local.set({ autoScan: settings.enabled });

    // Update UI
    autoScanSettings.style.display = settings.enabled ? 'block' : 'none';

    // Only update the result box if there's no active status message
    if (settings.enabled) {
      // Check if there's already a dynamic status (scanning, inactive, etc.)
      if (!autoResultBox.className.includes('scanning') &&
        !autoResultBox.className.includes('inactive') &&
        !autoResultBox.className.includes('phishing') &&
        !autoResultBox.className.includes('safe')) {
        autoResultBox.textContent = `Auto scan active. Waiting for email activity...`;
        autoResultBox.className = "result-box monitoring";
      }
    } else {
      autoResultBox.textContent = 'Auto scan disabled.';
      autoResultBox.className = "result-box";
    }
  }

  // Load saved states
  chrome.storage.sync.get(['autoScanSettings', 'iotEnabled'], (data) => {
    const settings = data.autoScanSettings || {
      enabled: true,
      scanInterval: 30000,
      notifyOnPhishing: true,
      highlightLinks: true
    };

    // Update UI with saved settings
    autoScanToggle.checked = settings.enabled;
    scanIntervalSelect.value = settings.scanInterval.toString();
    notifyToggle.checked = settings.notifyOnPhishing;
    highlightToggle.checked = settings.highlightLinks;

    // Show/hide settings section based on auto scan toggle
    autoScanSettings.style.display = settings.enabled ? 'block' : 'none';

    // IoT toggle (unrelated to auto scan)
    iotToggle.checked = data.iotEnabled ?? true;

    // Initialize UI based on current state
    autoScanSettings.style.display = settings.enabled ? 'block' : 'none';

    // Update auto scan result display
    if (settings.enabled) {
      // Only set default message if there's no dynamic status already
      if (!autoResultBox.className.includes('scanning') &&
        !autoResultBox.className.includes('inactive') &&
        !autoResultBox.className.includes('phishing') &&
        !autoResultBox.className.includes('safe')) {
        autoResultBox.textContent = `Auto scan active. Waiting for email activity...`;
        autoResultBox.className = "result-box monitoring";
      }
    }
  });

  // Event listeners for auto scan controls
  autoScanToggle.addEventListener('change', updateAutoScanSettings);
  scanIntervalSelect.addEventListener('change', updateAutoScanSettings);
  notifyToggle.addEventListener('change', updateAutoScanSettings);
  highlightToggle.addEventListener('change', updateAutoScanSettings);

  // IoT toggle event listener
  iotToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ iotEnabled: iotToggle.checked });
  });

  // Define a function to process URLs safely
  function processSafeUrl(inputUrl) {
    let url = inputUrl.trim();
    // Remove common problematic characters
    url = url.replace(/[\n\r\t]/g, '');

    try {
      // Try to create a URL object to validate and normalize
      const urlObj = new URL(url);
      // For very long URLs, simplify by removing query parameters
      if (url.length > 100) {
        return urlObj.origin + urlObj.pathname;
      }
      return url;
    } catch (e) {
      // If it's not a valid URL, just return the cleaned string
      return url.substring(0, 500); // Limit length as a safety measure
    }
  }

  scanBtn.addEventListener('click', () => {
    try {
      let url = urlInput.value.trim();
      if (!url) {
        manualResultBox.textContent = "Please enter a URL.";
        manualResultBox.className = "result-box";
        return;
      }

      // Process the URL safely
      const processedUrl = processSafeUrl(url);

      // Update the input with the processed URL
      if (processedUrl !== url) {
        urlInput.value = processedUrl;
        url = processedUrl;
      }

      // Immediately show scanning status
      manualResultBox.textContent = "Scanning...";
      manualResultBox.className = "result-box";

      // Set timeout to ensure UI doesn't freeze
      const timeoutId = setTimeout(() => {
        manualResultBox.textContent = "Scan is taking longer than expected. Is the backend server running?";
        manualResultBox.className = "result-box";

        // After another 4 seconds, assume backend is unavailable
        setTimeout(() => {
          if (manualResultBox.textContent.includes("taking longer")) {
            manualResultBox.textContent = "⚠️ Backend server unavailable. Is it running at http://127.0.0.1:5000?";
            manualResultBox.className = "result-box phishing";
          }
        }, 4000);
      }, 2000); // Show message after 2 seconds if no response

      // Use the background.js functionality for consistency
      chrome.runtime.sendMessage({ action: "scanLink", data: { url: url } }, (response) => {
        clearTimeout(timeoutId); // Clear the timeout
        console.log("[ShieldBox] Popup scan response:", response);

        if (chrome.runtime.lastError) {
          console.error("[ShieldBox] Runtime error:", chrome.runtime.lastError.message);
          manualResultBox.textContent = "Extension error occurred.";
          manualResultBox.className = "result-box";
          return;
        }

        // Handle different response formats from background.js
        let status;
        if (response?.status) {
          status = response.status;
        } else if (response?.result?.status) {
          status = response.result.status;
        } else {
          status = "Unknown";
        }

        if (status.toLowerCase() === "phishing") {
          chrome.storage.sync.get('iotEnabled', (data) => {
            const iotStatus = data.iotEnabled;
            manualResultBox.textContent = iotStatus
              ? "Phishing detected. IoT alert sent!"
              : "Phishing detected.";
            manualResultBox.className = "result-box phishing";
          });
        } else if (status.toLowerCase() === "safe") {
          manualResultBox.textContent = "Link is safe.";
          manualResultBox.className = "result-box safe";
        } else if (response?.error) {
          manualResultBox.textContent = `Error: ${response.error}`;
          manualResultBox.className = "result-box";
        } else {
          manualResultBox.textContent = `Status: ${status.toUpperCase()}`;
          manualResultBox.className = "result-box";
        }
      });
    } catch (err) {
      console.error("[ShieldBox] Error in scan process:", err);
      manualResultBox.textContent = "Error occurred while scanning. Please try again.";
      manualResultBox.className = "result-box";
    }
  });

  // Load the latest auto-scan result when the popup opens
  chrome.storage.local.get('latestAutoScanResult', (data) => {
    const result = data.latestAutoScanResult;
    if (result) {
      console.log("[ShieldBox] Found stored auto-scan result:", result);

      // Calculate how long ago the scan was performed
      const scanTime = new Date(result.timestamp);
      const now = new Date();
      const minutesAgo = Math.floor((now - scanTime) / (1000 * 60));

      let timeString = "";
      if (minutesAgo < 1) {
        timeString = "just now";
      } else if (minutesAgo === 1) {
        timeString = "1 minute ago";
      } else if (minutesAgo < 60) {
        timeString = `${minutesAgo} minutes ago`;
      } else {
        const hoursAgo = Math.floor(minutesAgo / 60);
        timeString = `${hoursAgo} ${hoursAgo === 1 ? 'hour' : 'hours'} ago`;
      }

      // Display the result with timestamp
      const message = `${result.message} (Scanned ${timeString})`;
      updateAutoScanResultDisplay(message, result.status, result);
    } else {
      // No previous auto-scan result
      autoResultBox.textContent = "No auto-scan results yet. Visit a webpage to activate auto-scanning.";
      autoResultBox.className = "result-box";
    }
  });

  // Initialize auto scan settings from storage
  chrome.storage.sync.get(['autoScanSettings'], (result) => {
    if (result.autoScanSettings) {
      const settings = result.autoScanSettings;
      autoScanToggle.checked = settings.enabled;
      scanIntervalSelect.value = settings.scanInterval || 30000;
      notifyToggle.checked = settings.notifyOnPhishing;
      highlightToggle.checked = settings.highlightLinks;

      // Show/hide settings based on toggle
      autoScanSettings.style.display = settings.enabled ? 'block' : 'none';

      // Update result box based on current state
      if (settings.enabled) {
        // Only set default message if there's no dynamic status already
        if (!autoResultBox.className.includes('scanning') &&
          !autoResultBox.className.includes('inactive') &&
          !autoResultBox.className.includes('phishing') &&
          !autoResultBox.className.includes('safe')) {
          autoResultBox.textContent = `Auto scan active. Waiting for email activity...`;
          autoResultBox.className = "result-box monitoring";
        }
      }
    }
  });

  // Initialize IoT settings
  chrome.storage.sync.get(['iotEnabled'], (result) => {
    if (result.iotEnabled !== undefined) {
      iotToggle.checked = result.iotEnabled;
    }
  });

  // Request current email scan status when popup opens
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('mail.google.com')) {
      // We're on Gmail, request current status
      chrome.tabs.sendMessage(tabs[0].id, { action: 'requestCurrentStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[ShieldBox] Could not get current status from content script');
        }
      });
    }
  });
});
