// Email warning notification component
function createEmailWarningNotification(emailType, details) {
    // Remove any existing notifications
    const existingNotification = document.getElementById('shieldbox-email-warning');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification container
    const notification = document.createElement('div');
    notification.id = 'shieldbox-email-warning';
    notification.style.position = 'fixed';
    notification.style.top = '10px';
    notification.style.right = '10px';
    notification.style.zIndex = '9999999';
    notification.style.width = '300px';
    notification.style.padding = '15px';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.style.fontSize = '14px';
    notification.style.transition = 'all 0.3s ease';

    // Set styles based on email type
    switch (emailType.toLowerCase()) {
        case 'phishing':
            notification.style.backgroundColor = 'rgba(220, 53, 69, 0.95)';
            notification.style.borderLeft = '4px solid #b71c1c';
            break;
        case 'fraud':
            notification.style.backgroundColor = 'rgba(255, 87, 34, 0.95)';
            notification.style.borderLeft = '4px solid #b71c1c';
            break;
        case 'malware':
            notification.style.backgroundColor = 'rgba(103, 58, 183, 0.95)';
            notification.style.borderLeft = '4px solid #4a148c';
            break;
        case 'spam':
            notification.style.backgroundColor = 'rgba(255, 152, 0, 0.95)';
            notification.style.borderLeft = '4px solid #e65100';
            break;
        default:
            notification.style.backgroundColor = 'rgba(33, 150, 243, 0.95)';
            notification.style.borderLeft = '4px solid #0d47a1';
    }

    // Create header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '10px';

    // Add warning icon and title
    const title = document.createElement('h3');
    title.textContent = details.title || 'Email Alert';
    title.style.margin = '0';
    title.style.color = '#fff';
    title.style.fontSize = '16px';
    title.style.fontWeight = 'bold';

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#fff';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.onclick = function () {
        notification.remove();
    };

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create content
    const content = document.createElement('div');
    content.style.color = '#fff';

    // Add description
    const description = document.createElement('p');
    description.textContent = details.description;
    description.style.margin = '5px 0';

    // Add recommendation
    const recommendation = document.createElement('p');
    recommendation.textContent = details.recommendation;
    recommendation.style.margin = '5px 0';
    recommendation.style.fontWeight = 'bold';

    // Add badge
    const badge = document.createElement('div');
    badge.textContent = emailType.toUpperCase();
    badge.style.display = 'inline-block';
    badge.style.padding = '3px 8px';
    badge.style.borderRadius = '4px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = 'bold';
    badge.style.marginTop = '8px';
    badge.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
    badge.style.color = '#fff';

    content.appendChild(description);
    content.appendChild(recommendation);
    content.appendChild(badge);

    notification.appendChild(header);
    notification.appendChild(content);

    document.body.appendChild(notification);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        if (notification && document.body.contains(notification)) {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }
    }, 10000);
}

// Listen for email warning messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showEmailWarning" && message.emailType && message.details) {
        createEmailWarningNotification(message.emailType, message.details);
    }
});
