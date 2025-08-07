// ShieldBox Testing Commands
// Copy and paste these into the browser console when testing

// 1. Basic functionality test
console.log("=== SHIELDBOX TEST COMMANDS ===");
console.log("1. Check email detection:");
console.log("debugShieldBox.checkEmailDetection()");
console.log("");

console.log("2. Extract email data:");
console.log("debugShieldBox.extractEmail()");
console.log("");

console.log("3. Trigger auto-scan:");
console.log("debugShieldBox.triggerAutoScan()");
console.log("");

console.log("4. Show cache:");
console.log("debugShieldBox.showCache()");
console.log("");

console.log("5. Clear cache (for fresh testing):");
console.log("debugShieldBox.clearCache()");
console.log("");

console.log("6. Force phishing result (for UI testing):");
console.log("debugShieldBox.forcePhishingResult()");
console.log("");

console.log("7. Test auto-scan toggle (ON):");
console.log("chrome.runtime.sendMessage({action: 'updateAutoScanSettings', data: {enabled: true}})");
console.log("");

console.log("8. Test auto-scan toggle (OFF):");
console.log("chrome.runtime.sendMessage({action: 'updateAutoScanSettings', data: {enabled: false}})");
console.log("");

console.log("9. Check auto-scan status:");
console.log("chrome.runtime.sendMessage({action: 'getAutoScanPreference'}, (r) => console.log('Auto-scan status:', r))");
console.log("");

// Quick test sequence
function runQuickTest() {
    console.log("🧪 Running ShieldBox Quick Test...");

    // Check detection
    const detected = debugShieldBox.checkEmailDetection();
    console.log("✅ Email detected:", detected);

    // Extract data
    const emailData = debugShieldBox.extractEmail();
    console.log("✅ Email data:", emailData ? "Success" : "Failed");

    // Show cache status
    const cache = debugShieldBox.showCache();
    console.log("✅ Cache size:", cache.size);

    // Trigger scan
    console.log("✅ Triggering auto-scan...");
    debugShieldBox.triggerAutoScan();

    console.log("🎉 Quick test complete! Check the ShieldBox panel for results.");
}

// Test toggle functions
function testToggleON() {
    console.log("🟢 Testing AUTO-SCAN ON...");
    chrome.runtime.sendMessage({ action: 'updateAutoScanSettings', data: { enabled: true } }, (response) => {
        console.log("✅ Toggle ON response:", response);
    });
}

function testToggleOFF() {
    console.log("🔴 Testing AUTO-SCAN OFF...");
    chrome.runtime.sendMessage({ action: 'updateAutoScanSettings', data: { enabled: false } }, (response) => {
        console.log("✅ Toggle OFF response:", response);
    });
}

function checkToggleStatus() {
    console.log("� Checking auto-scan status...");
    chrome.runtime.sendMessage({ action: 'getAutoScanPreference' }, (response) => {
        console.log("📊 Auto-scan status:", response);
    });
}

console.log("�💡 TIP: Run runQuickTest() for a complete test sequence");
console.log("🎛️ TOGGLE TESTS: testToggleON(), testToggleOFF(), checkToggleStatus()");
