console.log("floatingpanel.js loaded");

// Add window message listener for iframe communication
window.addEventListener('message', (event) => {
  // Handle floating panel control messages for auto-scan card only
  if (event.data && event.data.type === 'shield_box_control') {
    const autoScanCard = document.getElementById('shieldbox-floating-panel')?.shadowRoot?.getElementById('auto-scan-result')?.closest('.card');

    if (event.data.action === 'show_panel') {
      console.log('[ShieldBox] 📱 Floating panel received show auto-scan command');
      if (autoScanCard) {
        autoScanCard.style.display = 'block';
      }
    } else if (event.data.action === 'hide_panel') {
      console.log('[ShieldBox] 📱 Floating panel received hide auto-scan command');
      if (autoScanCard) {
        autoScanCard.style.display = 'none';
      }
    }
    return;
  }

  if (event.data && event.data.type === 'chrome_extension_message') {
    console.log('[ShieldBox] 📬 Floating panel received iframe message:', event.data.data);

    // Process the Chrome extension message as if it came from chrome.runtime.onMessage
    const message = event.data.data;

    // Trigger the same logic as the chrome.runtime.onMessage listener
    if (window.handleChromeMessage) {
      window.handleChromeMessage(message);
    }
  }

  // Also listen for direct shield_box_update messages
  if (event.data && event.data.type === 'shield_box_update') {
    console.log('[ShieldBox] 📬 Floating panel received direct window message:', event.data);

    // Process as chrome message
    if (window.handleChromeMessage) {
      window.handleChromeMessage(event.data);
    }
  }
});

fetch(chrome.runtime.getURL('floatingpanel.html'))
  .then(res => res.text())
  .then(html => {
    const container = document.createElement('div');
    container.id = 'shieldbox-floating-panel';
    container.style.position = 'fixed';
    container.style.top = '100px';
    container.style.left = '100px';
    container.style.zIndex = '999999';

    const shadow = container.attachShadow({ mode: 'open' });
    shadow.innerHTML = html;

    // ✅ Inject CSS
    fetch(chrome.runtime.getURL('style.css'))
      .then(res => res.text())
      .then(css => {
        const styleTag = document.createElement('style');
        styleTag.textContent = css;
        shadow.appendChild(styleTag);
      });

    document.body.appendChild(container);

    // 🔧 Initial visibility check based on auto-scan setting
    chrome.storage.local.get(['autoScan'], (data) => {
      const autoScanEnabled = data.autoScan !== false; // Default to true
      console.log('[ShieldBox] 📱 Initial auto-scan setting:', autoScanEnabled);

      // Always show the floating panel container
      container.style.display = 'block';
      container.style.opacity = '1';
      container.style.visibility = 'visible';
      container.style.transform = 'none';

      // Wait for auto-scan elements to be available, then handle auto-scan card visibility
      setTimeout(() => {
        const autoScanCard = shadow.getElementById("auto-scan-result")?.closest('.card');
        if (autoScanCard) {
          if (autoScanEnabled) {
            console.log('[ShieldBox] 📱 Auto-scan enabled - Showing auto-scan card');
            autoScanCard.style.display = 'block';
          } else {
            console.log('[ShieldBox] 📱 Auto-scan disabled - Hiding auto-scan card');
            autoScanCard.style.display = 'none';
          }
        }
      }, 100);
    });

    // --- Elements ---
    const scanBtn = shadow.getElementById("scanBtn");
    const urlInput = shadow.getElementById("urlInput");
    const manualLinkResult = shadow.getElementById("manual-link-result");
    const manualEmailResult = shadow.getElementById("manual-email-result");
    const scanEmailBtn = shadow.getElementById("scanEmailBtn");
    const autoScanResult = shadow.getElementById("auto-scan-result");

    // Get card elements for background color changes
    const linkCard = manualLinkResult?.closest('.card');
    const emailCard = manualEmailResult?.closest('.card');
    const autoCard = autoScanResult?.closest('.card');

    // Helper function to update card background based on status
    const updateCardBackground = (card, status) => {
      if (!card) return;

      // Remove all existing status classes
      card.classList.remove('safe', 'phishing', 'fraud', 'spam', 'malware', 'scanning', 'inactive');

      // Add new status class
      if (status) {
        card.classList.add(status);
      }
    };

    // ✅ Manual link scan
    if (scanBtn && urlInput && manualLinkResult) {
      scanBtn.addEventListener("click", () => {
        const url = urlInput.value.trim();
        console.log("[ShieldBox] Manual scan button clicked");

        if (!url) {
          console.log("[ShieldBox] Error: Empty URL provided");
          manualLinkResult.textContent = "Please enter a URL.";
          manualLinkResult.className = "result-box phishing";
          return;
        }

        // Validate URL format
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
        if (!urlPattern.test(url)) {
          console.log("[ShieldBox] Error: Invalid URL format:", url);
          manualLinkResult.textContent = "Please enter a valid URL (e.g., example.com or https://example.com)";
          manualLinkResult.className = "result-box phishing";
          return;
        }

        manualLinkResult.textContent = "Scanning...";
        manualLinkResult.className = "result-box";
        console.log("[ShieldBox] Initiating scan for URL:", url);
        console.log("[ShieldBox] Sending message to background script...");

        chrome.runtime.sendMessage({ action: "scanLink", data: url }, (response) => {
          console.log("[ShieldBox] Response received from background script:", response);

          if (response?.result) {
            const status = response.result.status || "Unknown";
            console.log("[ShieldBox] Scan result status:", status);

            if (status.toLowerCase() === "phishing") {
              console.log("[ShieldBox] ALERT: Phishing URL detected!");
              console.log("[ShieldBox] Details:", response.result.details || "No additional details");
              console.log("[ShieldBox] Timestamp:", response.result.timestamp || "No timestamp");

              // Create detailed message
              let detailMsg = `Warning: PHISHING DETECTED`;
              if (response.result.details) {
                detailMsg += ` - ${response.result.details}`;
              }

              manualLinkResult.textContent = detailMsg;
              manualLinkResult.className = "result-box phishing";
              updateCardBackground(linkCard, "phishing");
            } else if (status.toLowerCase() === "safe") {
              console.log("[ShieldBox] URL appears to be safe");
              console.log("[ShieldBox] Timestamp:", response.result.timestamp || "No timestamp");

              manualLinkResult.textContent = `Link is SAFE`;
              manualLinkResult.className = "result-box safe";
              updateCardBackground(linkCard, "safe");
            } else if (status.toLowerCase() === "spam") {
              manualLinkResult.textContent = `Link flagged as SPAM`;
              manualLinkResult.className = "result-box spam";
              updateCardBackground(linkCard, "spam");
            } else if (status.toLowerCase() === "fraud") {
              manualLinkResult.textContent = `Link flagged as FRAUD`;
              manualLinkResult.className = "result-box fraud";
              updateCardBackground(linkCard, "fraud");
            } else if (status.toLowerCase() === "malware") {
              manualLinkResult.textContent = `Link flagged as MALWARE`;
              manualLinkResult.className = "result-box malware";
              updateCardBackground(linkCard, "malware");
            } else {
              console.log("[ShieldBox] URL scan status:", status);
              console.log("[ShieldBox] Additional data:", response.result);

              manualLinkResult.textContent = `🔍 Status: ${status.toUpperCase()}`;
              manualLinkResult.className = "result-box";
              updateCardBackground(linkCard, null);
            }
          } else {
            console.error("[ShieldBox] Scan failed or returned invalid response:", response);
            manualLinkResult.textContent = "Scan failed. Try again.";
            manualLinkResult.className = "result-box";
            updateCardBackground(linkCard, null);
          }
        });
      });
    }

    // 📩 Email scan
    if (scanEmailBtn && manualEmailResult) {
      scanEmailBtn.addEventListener("click", () => {
        // First, do a quick check to see if we can detect an email
        const quickCheck = () => {
          // Quick Gmail check
          const hasGmailBody = document.querySelector('.a3s.aiL') !== null;
          const hasGmailSubject = document.querySelector('h2.hP') !== null;
          const isGmail = window.location.hostname.includes('mail.google.com');

          if (isGmail && (!hasGmailBody || !hasGmailSubject)) {
            return {
              detected: false,
              reason: 'Gmail detected but no open email found',
              suggestion: 'Please click on an email to open it first'
            };
          }

          return { detected: true };
        };

        const quickResult = quickCheck();

        if (!quickResult.detected) {
          // Show immediate feedback for failed detection
          manualEmailResult.innerHTML = `<b>📧 ${quickResult.reason}</b><br>${quickResult.suggestion}`;
          manualEmailResult.className = "result-box no-email";
          manualEmailResult.style.animation = "none";
          setTimeout(() => {
            manualEmailResult.style.animation = "no-email-pulse 2s infinite";
          }, 10);
          return;
        }

        // Show scanning state
        manualEmailResult.innerHTML = "🔍 <b>Scanning Email...</b><br>Analyzing content for threats";
        manualEmailResult.className = "result-box scanning";
        console.log("[ShieldBox] Scanning email");

        chrome.runtime.sendMessage({ action: "scanEmail" }, (response) => {
          console.log("[ShieldBox] Email scan response:", response);

          if (!response) {
            manualEmailResult.textContent = "⚠️ Connection error. Please try again.";
            manualEmailResult.className = "result-box";
            return;
          }

          if (response.error) {
            console.log("[ShieldBox] Email scan error:", response.error);

            // Apply special styling based on the error type
            if (response.error.includes("No email detected") || response.error.includes("not on an email page") ||
              response.error.includes("No email is open") || response.error.includes("open an email first")) {
              manualEmailResult.innerHTML = "<b>📧 No Email Detected</b><br>Please open an email first to scan.";
              manualEmailResult.className = "result-box no-email";
            } else if (response.error.includes("No email content") || response.error.includes("no content")) {
              manualEmailResult.innerHTML = "<b>📭 Empty Email</b><br>This email doesn't contain any content to scan.";
              manualEmailResult.className = "result-box no-email";
            } else {
              manualEmailResult.textContent = "⚠️ " + response.error;
              manualEmailResult.className = "result-box";
            }
            return;
          }

          // IMPROVED: Better status detection from response
          const emailType = response?.emailType?.toLowerCase() || response?.result?.toLowerCase() || "unknown";
          console.log("[ShieldBox] Detected email type:", emailType);

          let resultText = "";
          let resultClass = "result-box";

          // Create badge element
          const createBadge = (type, text) => {
            return `<div class="email-type-badge ${type}">${text}</div>`;
          };

          // ENHANCED: More comprehensive status mapping
          switch (emailType) {
            case "phishing":
              resultText = createBadge("phishing", "⚠️ PHISHING") +
                "This email contains suspicious links or content that may be attempting to steal your information.";
              resultClass = "result-box phishing";
              updateCardBackground(emailCard, "phishing");
              break;
            case "spam":
              resultText = createBadge("spam", "📧 SPAM") +
                "This email appears to be unsolicited marketing or bulk mail.";
              resultClass = "result-box spam";
              updateCardBackground(emailCard, "spam");
              break;
            case "fraud":
              resultText = createBadge("fraud", "💰 FRAUD") +
                "This email appears to be attempting financial fraud or deception.";
              resultClass = "result-box fraud";
              updateCardBackground(emailCard, "fraud");
              break;
            case "malware":
              resultText = createBadge("malware", "🦠 MALWARE") +
                "This email may contain malicious attachments or links to harmful software.";
              resultClass = "result-box malware";
              updateCardBackground(emailCard, "malware");
              break;
            case "safe":
            case "legitimate":
              resultText = createBadge("legitimate", "✅ SAFE") +
                "This email appears to be legitimate and safe.";
              resultClass = "result-box safe";
              updateCardBackground(emailCard, "safe");
              break;
            case "no_links":
              // Handle the backend's no_links response properly
              resultText = createBadge("legitimate", "✅ SAFE") +
                "No suspicious links found in this email.";
              resultClass = "result-box safe";
              updateCardBackground(emailCard, "safe");
              break;
            default:
              console.log("[ShieldBox] Unknown email type, using default:", emailType);
              resultText = `🔍 Analysis complete: ${emailType.toUpperCase()}`;
              resultClass = "result-box";
              updateCardBackground(emailCard, null);

              // Add confidence info if available
              if (response?.confidence) {
                resultText += `<br><small>Confidence: ${(response.confidence * 100).toFixed(1)}%</small>`;
              }
          }

          console.log("[ShieldBox] Setting result class:", resultClass);
          manualEmailResult.innerHTML = resultText;
          manualEmailResult.className = resultClass;
        });
      });
    }

    // 🔁 Message handling function (reusable for both chrome.runtime and window messages)
    window.handleChromeMessage = (message) => {
      console.log('[ShieldBox] 📬 Floating panel processing message with action:', message.action);

      if (message.action === "displayResult") {
        if (message.source === "email") {
          // Use HTML content if provided, otherwise use text
          if (message.htmlContent) {
            manualEmailResult.innerHTML = message.htmlContent;
          } else {
            manualEmailResult.textContent = message.result;
          }

          // Handle different statuses with appropriate color styling
          if (message.status === "inactive" || message.status === "no-content") {
            manualEmailResult.className = "result-box inactive";
            updateCardBackground(emailCard, "inactive");
          } else if (message.status === "no-email") {
            manualEmailResult.className = "result-box no-email";
            updateCardBackground(emailCard, null);
            // Reset animation to trigger it again
            manualEmailResult.style.animation = "none";
            setTimeout(() => {
              manualEmailResult.style.animation = "no-email-pulse 2s infinite";
            }, 10);
          } else if (message.status === "phishing") {
            manualEmailResult.className = "result-box phishing";
            updateCardBackground(emailCard, "phishing");
          } else if (message.status === "safe" || message.status === "legitimate") {
            manualEmailResult.className = "result-box safe";
            updateCardBackground(emailCard, "safe");
          } else if (message.status === "spam") {
            manualEmailResult.className = "result-box spam";
            updateCardBackground(emailCard, "spam");
          } else if (message.status === "fraud") {
            manualEmailResult.className = "result-box fraud";
            updateCardBackground(emailCard, "fraud");
          } else if (message.status === "malware") {
            manualEmailResult.className = "result-box malware";
            updateCardBackground(emailCard, "malware");
          } else if (message.status === "scanning") {
            manualEmailResult.className = "result-box scanning";
            updateCardBackground(emailCard, "scanning");
          } else {
            manualEmailResult.className = `result-box ${message.status || ""}`;
            updateCardBackground(emailCard, message.status || null);
          }
        } else if (message.source === "link") {
          if (message.htmlContent) {
            manualLinkResult.innerHTML = message.htmlContent;
          } else {
            manualLinkResult.textContent = message.result;
          }

          // Apply proper color styling for link results too
          if (message.status === "phishing") {
            manualLinkResult.className = "result-box phishing";
            updateCardBackground(linkCard, "phishing");
          } else if (message.status === "safe" || message.status === "legitimate") {
            manualLinkResult.className = "result-box safe";
            updateCardBackground(linkCard, "safe");
          } else if (message.status === "spam") {
            manualLinkResult.className = "result-box spam";
            updateCardBackground(linkCard, "spam");
          } else if (message.status === "fraud") {
            manualLinkResult.className = "result-box fraud";
            updateCardBackground(linkCard, "fraud");
          } else if (message.status === "malware") {
            manualLinkResult.className = "result-box malware";
            updateCardBackground(linkCard, "malware");
          } else if (message.status === "scanning") {
            manualLinkResult.className = "result-box scanning";
            updateCardBackground(linkCard, "scanning");
          } else {
            manualLinkResult.className = `result-box ${message.status || ""}`;
            updateCardBackground(linkCard, message.status || null);
          }
        }
      } else if (message.action === "displayAutoScanResult") {
        console.log('[ShieldBox] 📬 Floating panel received displayAutoScanResult message:', message);
        console.log('[ShieldBox] Auto-scan result element exists:', !!autoScanResult);
        console.log('[ShieldBox] Auto-scan card element exists:', !!autoCard);

        if (autoScanResult) {
          console.log('[ShieldBox] ✅ Updating auto-scan result display');
          // Use HTML content if provided, otherwise use text
          if (message.htmlContent) {
            console.log('[ShieldBox] Setting HTML content:', message.htmlContent);
            autoScanResult.innerHTML = message.htmlContent;
          } else {
            console.log('[ShieldBox] Setting text content:', message.result);
            autoScanResult.textContent = message.result;
          }

          // Apply appropriate color styling based on status
          console.log('[ShieldBox] Applying status styling:', message.status);
          if (message.status === "phishing") {
            autoScanResult.className = "result-box phishing";
            updateCardBackground(autoCard, "phishing");
          } else if (message.status === "safe" || message.status === "legitimate") {
            autoScanResult.className = "result-box safe";
            updateCardBackground(autoCard, "safe");
          } else if (message.status === "spam") {
            autoScanResult.className = "result-box spam";
            updateCardBackground(autoCard, "spam");
          } else if (message.status === "fraud") {
            autoScanResult.className = "result-box fraud";
            updateCardBackground(autoCard, "fraud");
          } else if (message.status === "malware") {
            autoScanResult.className = "result-box malware";
            updateCardBackground(autoCard, "malware");
          } else if (message.status === "scanning") {
            autoScanResult.className = "result-box scanning";
            updateCardBackground(autoCard, "scanning");
          } else if (message.status === "inactive") {
            autoScanResult.className = "result-box inactive";
            updateCardBackground(autoCard, "inactive");
          } else if (message.status === "no-email") {
            autoScanResult.className = "result-box no-email";
            updateCardBackground(autoCard, null);
            // Reset animation to trigger it again
            autoScanResult.style.animation = "none";
            setTimeout(() => {
              autoScanResult.style.animation = "no-email-pulse 2s infinite";
            }, 10);
          } else {
            autoScanResult.className = "result-box";
            updateCardBackground(autoCard, null);
          }
        }
        const external = document.getElementById("auto-email-result");
        if (external) external.textContent = message.result;
      } else if (message.action === "resetEmailScan") {
        // Reset manual email scan result when email is closed
        if (manualEmailResult) {
          manualEmailResult.innerHTML = "<b>📧 No Email Open</b><br>Email was closed or navigated away.";
          manualEmailResult.className = "result-box no-email";
          updateCardBackground(emailCard, null);
        }
      } else if (message.action === "updateScanResult") {
        // Handle link scan result updates with proper colors
        if (manualLinkResult && message.result) {
          const result = message.result;
          manualLinkResult.textContent = result.details || `Status: ${result.status}`;

          // Apply proper color styling based on status
          if (result.status === "phishing") {
            manualLinkResult.className = "result-box phishing";
            updateCardBackground(linkCard, "phishing");
          } else if (result.status === "safe") {
            manualLinkResult.className = "result-box safe";
            updateCardBackground(linkCard, "safe");
          } else if (result.status === "spam") {
            manualLinkResult.className = "result-box spam";
            updateCardBackground(linkCard, "spam");
          } else if (result.status === "fraud") {
            manualLinkResult.className = "result-box fraud";
            updateCardBackground(linkCard, "fraud");
          } else if (result.status === "malware") {
            manualLinkResult.className = "result-box malware";
            updateCardBackground(linkCard, "malware");
          } else {
            manualLinkResult.className = "result-box";
            updateCardBackground(linkCard, null);
          }
        }
      }
    };

    // 🔁 Listen for result updates from chrome.runtime
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      window.handleChromeMessage(message);
    });

    // 🌗 Dark mode and Auto Scan toggle logic
    const interval = setInterval(() => {
      const darkModeToggle = shadow.getElementById("darkModeToggle");
      const autoScanToggle = shadow.getElementById("autoScanToggle");
      if (!darkModeToggle || !autoScanToggle) return;

      clearInterval(interval);

      function applyTheme(mode) {
        if (mode === "dark") {
          shadow.host.classList.add("dark-mode");
          darkModeToggle.checked = true;
        } else {
          shadow.host.classList.remove("dark-mode");
          darkModeToggle.checked = false;
        }
        localStorage.setItem("theme", mode);
      }

      const savedTheme = localStorage.getItem("theme");
      applyTheme(savedTheme || "light");

      darkModeToggle.addEventListener("change", () => {
        applyTheme(darkModeToggle.checked ? "dark" : "light");
      });

      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["autoScan"], (data) => {
          const currentSetting = !!data.autoScan;
          autoScanToggle.checked = currentSetting;
          console.log('[ShieldBox] 📱 Floating panel loaded with auto-scan setting:', currentSetting);
        });

        autoScanToggle.addEventListener("change", () => {
          const isEnabled = autoScanToggle.checked;
          console.log("[ShieldBox] Auto Scan toggle changed to:", isEnabled);

          // Save the setting
          chrome.storage.local.set({ autoScan: isEnabled }, () => {
            console.log("[ShieldBox] Auto Scan setting saved:", isEnabled);
          });

          // Send message to background script to update all tabs
          chrome.runtime.sendMessage({
            action: 'updateAutoScanSettings',
            settings: { enabled: isEnabled }
          });

          // Hide/show only the auto-scan result card based on toggle state
          const autoScanCard = autoScanResult?.closest('.card');
          if (isEnabled) {
            console.log("[ShieldBox] 📱 Auto-scan ON - Showing auto-scan card");
            if (autoScanCard) {
              autoScanCard.style.display = 'block';
            }
            if (autoScanResult) {
              autoScanResult.innerHTML = "<b>📡 Monitoring</b><br>Auto-scan is now active";
              autoScanResult.className = "result-box";
            }
          } else {
            console.log("[ShieldBox] 📱 Auto-scan OFF - Hiding auto-scan card");
            if (autoScanCard) {
              autoScanCard.style.display = 'none';
            }
          }
        });
      }
    }, 50);

    // 🔧 Add global debug functions for testing
    window.debugFloatingPanel = {
      hideAutoScan: () => {
        console.log('[ShieldBox DEBUG] 📱 Manually hiding auto-scan card');
        const autoScanCard = autoScanResult?.closest('.card');
        if (autoScanCard) {
          autoScanCard.style.display = 'none';
        }
      },
      showAutoScan: () => {
        console.log('[ShieldBox DEBUG] 📱 Manually showing auto-scan card');
        const autoScanCard = autoScanResult?.closest('.card');
        if (autoScanCard) {
          autoScanCard.style.display = 'block';
        }
      },
      showPanel: () => {
        console.log('[ShieldBox DEBUG] 📱 Manually showing entire floating panel');
        container.style.display = 'block';
        container.style.opacity = '1';
        container.style.visibility = 'visible';
        container.style.transform = 'none';
      },
      checkStatus: () => {
        const autoScanCard = autoScanResult?.closest('.card');
        console.log('[ShieldBox DEBUG] 📱 Panel status:', {
          panelExists: !!container,
          panelDisplay: container.style.display,
          panelOpacity: container.style.opacity,
          panelVisibility: container.style.visibility,
          autoScanCardExists: !!autoScanCard,
          autoScanCardDisplay: autoScanCard?.style.display,
          autoScanToggle: autoScanToggle?.checked
        });
        return {
          panelExists: !!container,
          panelDisplay: container.style.display,
          panelOpacity: container.style.opacity,
          panelVisibility: container.style.visibility,
          autoScanCardExists: !!autoScanCard,
          autoScanCardDisplay: autoScanCard?.style.display,
          autoScanToggle: autoScanToggle?.checked
        };
      }
    };

    console.log('[ShieldBox] 🔧 Floating panel debug functions loaded: window.debugFloatingPanel');

    // Listen for direct messages from content script (for email scan results)
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      if (event.data && event.data.type === 'scan_email_result') {
        console.log("[ShieldBox] Received direct scan_email_result:", event.data);

        if (manualEmailResult) {
          // Handle no-email case
          if (event.data.status === 'no-email') {
            // Use the provided HTML content if available, or fall back to a standard message
            manualEmailResult.innerHTML = event.data.htmlContent ||
              "<b>📧 No Email Detected</b><br>Please open an email first to scan.";
            manualEmailResult.className = "result-box no-email";

            // Add a tooltip explanation if provided
            if (event.data.explanation) {
              manualEmailResult.title = event.data.explanation;
            }

            // Add a subtle animation to draw attention
            manualEmailResult.style.animation = "none";
            setTimeout(() => {
              manualEmailResult.style.animation = "no-email-pulse 2s infinite";
            }, 10);
          } else {
            // Handle successful scan results
            if (event.data.htmlContent) {
              manualEmailResult.innerHTML = event.data.htmlContent;
            } else {
              manualEmailResult.textContent = event.data.result;
            }

            // Apply appropriate styling based on status
            if (event.data.status === 'phishing') {
              manualEmailResult.className = "result-box phishing";
            } else if (event.data.status === 'safe' || event.data.status === 'legitimate') {
              manualEmailResult.className = "result-box safe";
            } else if (event.data.status === 'spam') {
              manualEmailResult.className = "result-box spam";
            } else if (event.data.status === 'fraud') {
              manualEmailResult.className = "result-box fraud";
            } else if (event.data.status === 'malware') {
              manualEmailResult.className = "result-box malware";
            } else if (event.data.status === 'scanning') {
              manualEmailResult.className = "result-box scanning";
            } else {
              manualEmailResult.className = "result-box";
            }

            // Stop any existing animations for successful results
            manualEmailResult.style.animation = "none";
          }
        }
      }

      // Handle reset scan status messages
      if (event.data && event.data.type === 'shield_box_update') {
        console.log("[ShieldBox] Received shield_box_update:", event.data);

        if (event.data.action === 'resetScanStatus') {
          console.log("[ShieldBox] Resetting scan status in UI");

          // Reset manual email scan result display
          if (manualEmailResult) {
            manualEmailResult.innerHTML = "<b>📧 No Email Open</b><br>Please open an email to scan.";
            manualEmailResult.className = "result-box no-email";
          }

          // Reset auto scan result display
          if (autoScanResult) {
            autoScanResult.innerHTML = "<b>📡 Monitoring</b><br>No email activity detected";
            autoScanResult.className = "result-box inactive";
          }
        }

        // Handle other UI status updates
        if (event.data.action === 'updateUIStatus') {
          if (event.data.status === 'no-email' && manualEmailResult) {
            manualEmailResult.innerHTML = "<b>📧 No Email Detected</b><br>" + (event.data.message || "Please open an email first to scan.");
            manualEmailResult.className = "result-box no-email";
            // Trigger animation
            manualEmailResult.style.animation = "none";
            setTimeout(() => {
              manualEmailResult.style.animation = "no-email-pulse 2s infinite";
            }, 10);
          }
        }

        // Handle auto scan result updates
        if (event.data.action === 'displayAutoScanResult') {
          if (autoScanResult) {
            autoScanResult.innerHTML = event.data.htmlContent || event.data.result || "Monitoring...";
            autoScanResult.className = `result-box ${event.data.status || ""}`;

            // Add animation for specific statuses
            if (event.data.status === 'no-email') {
              autoScanResult.style.animation = "none";
              setTimeout(() => {
                autoScanResult.style.animation = "no-email-pulse 2s infinite";
              }, 10);
            }
          }
        }
      }
    });

    // 🖱️ Draggable
    let isDragging = false, offsetX = 0, offsetY = 0;

    container.onmousedown = (e) => {
      isDragging = true;
      offsetX = e.clientX - container.offsetLeft;
      offsetY = e.clientY - container.offsetTop;
    };

    document.onmousemove = (e) => {
      if (isDragging) {
        container.style.left = `${e.clientX - offsetX}px`;
        container.style.top = `${e.clientY - offsetY}px`;
      }
    };

    document.onmouseup = () => {
      isDragging = false;
    };
  });
