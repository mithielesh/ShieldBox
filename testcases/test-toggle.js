// Debug functions for testing auto-scan toggle functionality
// Run these in the browser console on a Gmail page

// Test toggle ON
function testToggleON() {
    console.log('[ShieldBox TEST] 🟢 Testing toggle ON...');

    // Send toggle ON message
    chrome.runtime.sendMessage({
        action: 'updateAutoScanSettings',
        settings: { enabled: true }
    }, (response) => {
        console.log('[ShieldBox TEST] Toggle ON response:', response);
    });

    // Also update storage directly
    chrome.storage.local.set({ autoScan: true }, () => {
        console.log('[ShieldBox TEST] Storage updated to autoScan: true');
    });

    // Send show panel command
    window.postMessage({
        type: 'shield_box_control',
        action: 'show_panel'
    }, '*');

    console.log('[ShieldBox TEST] Toggle ON commands sent');
}

// Test toggle OFF
function testToggleOFF() {
    console.log('[ShieldBox TEST] 🔴 Testing toggle OFF...');

    // Send toggle OFF message
    chrome.runtime.sendMessage({
        action: 'updateAutoScanSettings',
        settings: { enabled: false }
    }, (response) => {
        console.log('[ShieldBox TEST] Toggle OFF response:', response);
    });

    // Also update storage directly
    chrome.storage.local.set({ autoScan: false }, () => {
        console.log('[ShieldBox TEST] Storage updated to autoScan: false');
    });

    // Send hide panel command
    window.postMessage({
        type: 'shield_box_control',
        action: 'hide_panel'
    }, '*');

    console.log('[ShieldBox TEST] Toggle OFF commands sent');
}

// Check current toggle status
function checkToggleStatus() {
    console.log('[ShieldBox TEST] 🔍 Checking current toggle status...');

    // Check storage
    chrome.storage.local.get(['autoScan'], (data) => {
        console.log('[ShieldBox TEST] Storage autoScan:', data.autoScan);
    });

    // Check content script state
    chrome.runtime.sendMessage({
        action: 'getAutoScanStatus'
    }, (response) => {
        console.log('[ShieldBox TEST] Content script auto-scan status:', response);
    });

    // Check if panel exists and is visible
    const panel = document.getElementById('shieldbox-floating-panel');
    if (panel) {
        console.log('[ShieldBox TEST] Panel found. Display:', panel.style.display, 'Opacity:', panel.style.opacity, 'Visibility:', panel.style.visibility);
    } else {
        console.log('[ShieldBox TEST] Panel NOT found');
    }
}

// Check all elements status
function fullDiagnostic() {
    console.log('[ShieldBox TEST] 🔧 Running full diagnostic...');

    console.log('=== STORAGE CHECK ===');
    chrome.storage.local.get(null, (data) => {
        console.log('[ShieldBox TEST] All storage data:', data);
    });

    console.log('=== PANEL CHECK ===');
    const panel = document.getElementById('shieldbox-floating-panel');
    if (panel) {
        console.log('[ShieldBox TEST] Panel styles:', {
            display: panel.style.display,
            opacity: panel.style.opacity,
            visibility: panel.style.visibility,
            transform: panel.style.transform,
            position: panel.style.position,
            zIndex: panel.style.zIndex
        });
    } else {
        console.log('[ShieldBox TEST] Panel element not found');
    }

    console.log('=== CONTENT SCRIPT CHECK ===');
    chrome.runtime.sendMessage({
        action: 'getAutoScanStatus'
    }, (response) => {
        console.log('[ShieldBox TEST] Content script status:', response);
    });

    console.log('=== URL CHECK ===');
    console.log('[ShieldBox TEST] Current URL:', window.location.href);
    console.log('[ShieldBox TEST] Is Gmail:', window.location.hostname.includes('mail.google.com'));
}

// Auto-run diagnostic on load
console.log('[ShieldBox TEST] 🚀 Test functions loaded. Available commands:');
console.log('- testToggleON() - Test turning auto-scan ON');
console.log('- testToggleOFF() - Test turning auto-scan OFF');
console.log('- checkToggleStatus() - Check current toggle state');
console.log('- fullDiagnostic() - Run complete diagnostic');

// Make functions globally available
window.testToggleON = testToggleON;
window.testToggleOFF = testToggleOFF;
window.checkToggleStatus = checkToggleStatus;
window.fullDiagnostic = fullDiagnostic;
