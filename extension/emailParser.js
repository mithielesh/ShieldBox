function extractEmailDetails() {
  // CRITICAL FIX: Find a reliable email container to scope our search.
  // This prevents grabbing details from the inbox list or other UI elements.
  const containerSelectors = [
    '.nH.hx',         // Classic Gmail thread view
    '.nH.bAw',        // Another Gmail view
    '.Bs.nH.iY.bAt',  // Gmail thread container
    '.h7',            // Alternative container for single messages
    '.ha'             // Subject area container, good fallback
  ];

  let emailContainer = null;
  for (const selector of containerSelectors) {
    emailContainer = document.querySelector(selector);
    if (emailContainer) {
      console.log(`[emailParser.js] Found email container with selector: "${selector}"`);
      break;
    }
  }

  if (!emailContainer) {
    console.log('[emailParser.js] No open email thread container found from list of selectors. Aborting extraction.');
    return {
      subject: null, sender: null, body: null, hasAttachments: false, links: [], indicators: {}
    };
  }

  // CRITICAL FIX: Identify the most recent/active message block within the thread.
  // Gmail uses '.adn.ads' for individual messages. We'll target the last one.
  // If none are found, we fall back to the main container.
  const messageBlocks = emailContainer.querySelectorAll('.adn.ads');
  const activeMessageBlock = messageBlocks.length > 0 ? messageBlocks[messageBlocks.length - 1] : emailContainer;
  if (activeMessageBlock !== emailContainer) {
    console.log('[emailParser.js] Found active message block within thread. Scoping search.');
  }


  console.log('[emailParser.js] Starting email extraction within container...');
  console.log('[emailParser.js] Current URL:', window.location.href);
  console.log('[emailParser.js] Page title:', document.title);

  // Gmail extraction with enhanced selectors
  let subject = "";
  let sender = "";
  let senderEmail = "";
  let body = "";
  let hasAttachments = false;

  // Enhanced Gmail subject selectors
  const subjectSelectors = [
    'h2.hP',           // Classic Gmail subject
    '.ha h2',          // Gmail subject in thread view
    'h2[data-legacy-thread-id]', // Gmail with thread ID
    '.hP',             // Alternative Gmail subject
    '[aria-label*="Subject"]'    // Accessibility-based
  ];

  console.log('[emailParser.js] Testing subject selectors...');
  for (const selector of subjectSelectors) {
    const element = emailContainer.querySelector(selector);
    console.log(`[emailParser.js] Selector "${selector}":`, element ? `Found: "${element.innerText?.trim()}"` : 'Not found');
    if (element && element.innerText) {
      subject = element.innerText.trim();
      console.log('[emailParser.js] Found subject with selector:', selector, ':', subject);
      break;
    }
  }

  // Enhanced Gmail sender selectors
  const senderSelectors = [
    '.gD',             // Classic Gmail sender name
    '.gD[email]',      // More specific sender element with an email attribute
    '.go .gb .gD',     // Gmail sender with container
    '[email]',         // Email attribute
    '.sender-name',    // Generic sender
    '[aria-label*="From"]'       // Accessibility-based
  ];

  console.log('[emailParser.js] Testing sender selectors...');
  for (const selector of senderSelectors) {
    // CRITICAL FIX 3: Use querySelectorAll and get the LAST element.
    // This is now scoped to the active message block, making it much more accurate.
    const elements = activeMessageBlock.querySelectorAll(selector);
    console.log(`[emailParser.js] Selector "${selector}": Found ${elements.length} element(s)`);
    if (elements.length > 0) {
      const lastElement = elements[elements.length - 1];
      sender = lastElement.innerText?.trim() || lastElement.getAttribute('email') || "";
      if (sender) { // Check if we actually got a sender name/email
        console.log('[emailParser.js] Found sender with selector:', selector, ':', sender);
        break;
      }
    }
  }

  // Enhanced Gmail body selectors - THIS IS THE KEY FIX
  const bodySelectors = [
    '.ii.gt div',      // Gmail email body content (specific)
    '.ii.gt',          // Gmail email body (general)
    '.a3s.aiL',        // Gmail message body (modern)
    '.a3s',            // Gmail message body (fallback)
    '.adn.ads',        // Gmail message body (alternative)
    '[role="listitem"] .ii.gt', // Gmail in thread context
    '.message-body',   // Generic message body
    '[aria-label="Message body"]', // Accessibility-based
    '[role="main"] [dir="ltr"]'    // Gmail main content
  ];

  console.log('[emailParser.js] Testing body selectors...');
  for (const selector of bodySelectors) {
    // CRITICAL FIX 4: Use querySelectorAll and get the LAST element for the body as well.
    // This is also scoped to the active message block.
    const elements = activeMessageBlock.querySelectorAll(selector);
    console.log(`[emailParser.js] Selector "${selector}": Found ${elements.length} element(s)`);
    if (elements.length > 0) {
      const lastElement = elements[elements.length - 1];
      body = lastElement.innerText?.trim() || "";
      if (body.length > 10) { // Only accept non-trivial content
        console.log('[emailParser.js] Found body with selector:', selector, ', length:', body.length, '(scoped to active block)');
        break;
      }
    }
  }

  // Enhanced attachment detection
  const attachmentSelectors = [
    '.brc',                              // Gmail attachments
    '[data-tooltip="Download attachment"]', // Gmail download tooltip
    '.attachmentsInfo',                  // Outlook attachments
    '[aria-label*="attachment"]',        // Accessibility-based
    '.attachment',                       // Generic attachment
    '[role="button"][aria-label*="Download"]' // Download buttons
  ];

  hasAttachments = attachmentSelectors.some(selector => emailContainer.querySelector(selector) !== null);

  console.log('[emailParser.js] Initial extraction results:', {
    subject: subject ? `"${subject.substring(0, 50)}..."` : "EMPTY",
    sender: sender ? `"${sender}"` : "EMPTY",
    bodyLength: body.length,
    hasAttachments
  });

  // If we didn't get anything from Gmail selectors, try Outlook and other email providers
  if (!body || body.length < 20) {
    console.log('[emailParser.js] Gmail extraction insufficient, trying other email providers...');

    // Outlook webmail selectors
    const outlookSubject = emailContainer.querySelector('.allowTextSelection')?.getAttribute('aria-label') ||
      emailContainer.querySelector('._2LiMA')?.innerText || "";
    const outlookSender = emailContainer.querySelector('._1Bnf8')?.innerText ||
      emailContainer.querySelector('._2LhbP')?.innerText || "";
    const outlookBody = emailContainer.querySelector('.allowTextSelection')?.innerText || "";
    const outlookAttachments = !!emailContainer.querySelector('.attachmentsInfo');

    if (outlookBody && outlookBody.length > body.length) {
      subject = outlookSubject || subject;
      sender = outlookSender || sender;
      body = outlookBody;
      hasAttachments = hasAttachments || outlookAttachments;
      console.log('[emailParser.js] Using Outlook extraction');
    }

    // Generic email client fallback
    if (!body || body.length < 20) {
      console.log('[emailParser.js] Trying generic email extraction...');

      // Try to find email body content using common structural patterns
      const possibleBodyElements = emailContainer.querySelectorAll([
        '[role="main"]',
        '.email-body',
        '.message-body',
        '.email-content',
        '.mail-message-content',
        'main',
        '[class*="message"]',
        '[class*="email"]',
        '[class*="body"]'
      ].join(', '));

      let bestBodyElement = null;
      let bestBodyLength = 0;

      for (const element of possibleBodyElements) {
        if (element && element.innerText) {
          const text = element.innerText.trim();
          if (text.length > bestBodyLength && text.length > 100) {
            bestBodyLength = text.length;
            bestBodyElement = element;
          }
        }
      }

      if (bestBodyElement) {
        body = bestBodyElement.innerText.trim();
        console.log('[emailParser.js] Found body using generic selector, length:', body.length);
      }

      // If still no body found, look for the largest text block on the page
      if (!body || body.length < 50) {
        console.log('[emailParser.js] Trying largest text block approach...');
        let largestTextElement = null;
        let largestTextLength = 0;

        const allElements = emailContainer.querySelectorAll('div, article, section, main, [role="main"]');
        for (const element of allElements) {
          const text = element.innerText || "";
          // Skip navigation and header elements
          if (text.length > largestTextLength && text.length > 200 &&
            !element.matches('nav, header, .nav, .header, .menu, .sidebar')) {
            largestTextLength = text.length;
            largestTextElement = element;
          }
        }

        if (largestTextElement && largestTextLength > body.length) {
          body = largestTextElement.innerText.trim();
          console.log('[emailParser.js] Using largest text block, length:', body.length);
        }
      }

      // If still no subject found, try to get it from page title or other common elements
      if (!subject || subject.length < 3) {
        console.log('[emailParser.js] Trying to extract subject from page title...');
        subject = document.title || "";
        // Remove site name from title if present
        subject = subject.replace(/- (Gmail|Outlook|Yahoo Mail|ProtonMail)$/, '').trim();
        // Remove common email prefixes
        subject = subject.replace(/^(Re:|RE:|Fwd:|FWD:|Fw:)\s*/i, '').trim();
        console.log('[emailParser.js] Extracted subject from title:', subject);
      }
    }
  }

  // Final validation and cleanup
  if (body && body.length > 10000) {
    // If body is too long, it might include navigation and other page elements
    // Try to extract just the email content
    const lines = body.split('\n');
    const emailContentStart = lines.findIndex(line =>
      line.includes('@') ||
      line.toLowerCase().includes('from:') ||
      line.toLowerCase().includes('to:') ||
      line.toLowerCase().includes('subject:')
    );

    if (emailContentStart > 0 && emailContentStart < lines.length / 2) {
      body = lines.slice(emailContentStart).join('\n');
      console.log('[emailParser.js] Trimmed body to email content, new length:', body.length);
    }
  }

  console.log('[emailParser.js] Final extraction results:', {
    subject: subject ? `"${subject.substring(0, 50)}..."` : "EMPTY",
    sender: sender ? `"${sender}"` : "EMPTY",
    bodyLength: body.length,
    hasAttachments,
    hasValidContent: !!(subject || sender || (body && body.length > 20))
  });

  // Instead of returning null, return whatever we found and let caller decide
  // CRITICAL: Always return an object with the extracted data
  const result = {
    subject,
    sender: sender || senderEmail,
    senderEmail,
    body,
    hasAttachments,
    links: [], // Will be populated below
    indicators: {} // Will be populated below
  };

  // Only proceed with analysis if we have meaningful content
  if (!subject && !sender && (!body || body.length < 20)) {
    console.log('[emailParser.js] No meaningful content found, returning minimal data');
    return result;
  }

  // Extract links from the body
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const links = body.match(urlRegex) || [];
  result.links = links;

  // Look for common indicators based on the backend model categories
  const phishingTerms = ["verify", "account", "login", "password", "click", "confirm", "secure", "update"];
  const fraudTerms = ["money", "bank", "transfer", "urgently", "wire", "western union", "transaction",
    "inheritance", "lottery", "won", "millions", "funds", "cryptocurrency"];
  const spamTerms = ["offer", "free", "discount", "save", "limited time", "deal", "buy", "sale",
    "special", "exclusive", "best", "amazing", "incredible"];
  const malwareTerms = ["attachment", "download", "exe", "zip", "file", "invoice", "document", "open"];
  const urgentTerms = ["urgent", "immediate", "attention required", "alert", "important", "immediately"];

  // Analyze the email content using the same approach as the backend
  const lowerSubject = subject.toLowerCase();
  const lowerBody = body.toLowerCase();

  // Calculate scores for different categories
  const phishingScore = phishingTerms.filter(term =>
    lowerSubject.includes(term) || lowerBody.includes(term)).length;

  const fraudScore = fraudTerms.filter(term =>
    lowerSubject.includes(term) || lowerBody.includes(term)).length;

  const spamScore = spamTerms.filter(term =>
    lowerSubject.includes(term) || lowerBody.includes(term)).length;

  const malwareScore = malwareTerms.filter(term =>
    lowerSubject.includes(term) || lowerBody.includes(term)).length + (hasAttachments ? 1 : 0);

  const urgencyScore = urgentTerms.filter(term =>
    lowerSubject.includes(term) || lowerBody.includes(term)).length;

  // Check for suspicious patterns (same as backend)
  const containsSensitiveInfoRequests = /password|login credentials|username|account verification/i.test(lowerBody);
  const containsFinancialRequests = /bank account|send money|transfer funds|payment|inheritance/i.test(lowerBody);
  const containsPromotionalContent = /unsubscribe|opt[ -]?out|marketing|newsletter|buy now|special offer/i.test(lowerBody);
  const containsShortenedUrls = links.some(url => /(bit\.ly|goo\.gl|tinyurl\.com)/.test(url));
  const isUrgentSubject = urgentTerms.some(term => lowerSubject.includes(term));

  // Basic heuristic checks aligned with backend model
  let indicators = {
    phishingScore: phishingScore + (containsSensitiveInfoRequests ? 2 : 0) + (containsShortenedUrls ? 1 : 0),
    fraudScore: fraudScore + (containsFinancialRequests ? 2 : 0) + (isUrgentSubject ? 1 : 0),
    spamScore: spamScore + (containsPromotionalContent ? 1 : 0),
    malwareScore: malwareScore,
    urgencyScore: urgencyScore,
    sensitiveInfoRequested: containsSensitiveInfoRequests,
    financialInfoRequested: containsFinancialRequests,
    promotionalContent: containsPromotionalContent,
    shortenedUrls: containsShortenedUrls,
    hasUrgentSubject: isUrgentSubject,
    hasAttachments: hasAttachments,
    links: links.length
  };

  result.indicators = indicators;

  console.log('[emailParser.js] Returning complete result with', Object.keys(result).length, 'properties');
  return result;
}

// DEBUG FUNCTION - Call this from console to test extraction
window.testEmailExtraction = function () {
  console.log('=== MANUAL EMAIL EXTRACTION TEST ===');
  const result = extractEmailDetails();
  console.log('Extraction result:', result);
  return result;
};

// 1. Manual message trigger (already working)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "extract_email") {
    const emailData = extractEmailDetails();
    sendResponse(emailData);
  }
});

// 2. Auto scan when new email is opened in Gmail
let lastEmailId = null;

function getCurrentEmailId() {
  const match = window.location.href.match(/#inbox\/([^\/]+)/);
  return match ? match[1] : null;
}

function autoScanEmail() {
  const currentId = getCurrentEmailId();
  if (!currentId || currentId === lastEmailId) {
    return;
  }
  lastEmailId = currentId;

  const { subject, sender, body } = extractEmailDetails();
  const emailData = { subject, sender, body };
  console.log("autoScanEmail: Detected new email.", emailData);

  // Check if email has links to scan
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const links = (body || '').match(urlRegex) || [];

  // Add link info to log
  if (links.length > 0) {
    console.log(`autoScanEmail: Found ${links.length} links in email:`, links);
  } else {
    console.log("autoScanEmail: No links found in email body");
  }

  if (typeof chrome === "undefined" || !chrome.runtime) {
    console.warn("autoScanEmail: chrome.runtime not available, skipping sendMessage.");
    return;
  }

  if (chrome.runtime?.id) {
    try {
      chrome.runtime.sendMessage(
        { action: "scanAutoEmail", data: emailData },
        (response) => {
          console.log("autoScanEmail: Message sent to background, response:", response);

          // Check if we should notify the user about the scan result
          chrome.storage.sync.get(['autoScan'], (data) => {
            if (data.autoScan && response?.result === "phishing") {
              // Create or update notification in page
              const notificationId = "shield-box-notification";
              let notification = document.getElementById(notificationId);

              if (!notification) {
                notification = document.createElement('div');
                notification.id = notificationId;
                notification.style.position = 'fixed';
                notification.style.top = '20px';
                notification.style.right = '20px';
                notification.style.backgroundColor = '#ff4d4d';
                notification.style.color = 'white';
                notification.style.padding = '10px 20px';
                notification.style.borderRadius = '5px';
                notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                notification.style.zIndex = '9999999';
                document.body.appendChild(notification);
              }

              notification.textContent = "⚠️ Warning: This email may contain phishing links!";

              // Auto-hide after 10 seconds
              setTimeout(() => {
                if (notification && notification.parentNode) {
                  notification.parentNode.removeChild(notification);
                }
              }, 10000);
            }
          });
        }
      );
    } catch (e) {
      console.error("autoScanEmail: Failed to send message – extension context invalidated", e);
    }
  } else {
    console.warn("autoScanEmail: chrome.runtime not available, skipping sendMessage.");
  }
}

// Observe DOM changes to detect when user opens new email.
// Renamed to avoid conflict with content-script.js
const emailParserObserver = new MutationObserver(() => {
  autoScanEmail();
});

emailParserObserver.observe(document.body, { childList: true, subtree: true });

// Trigger once on initial load
autoScanEmail();