// chrome-extension/popup.js

document.addEventListener("DOMContentLoaded", async () => {
  const els = {
    threshold:   document.getElementById("threshold"),
    threshVal:   document.getElementById("threshVal"),
    blockList:   document.getElementById("blockList"),
    privacyMode: document.getElementById("privacyMode"),
    autoScan:    document.getElementById("autoScan"),
    saveBtn:     document.getElementById("saveBtn"),
    status:      document.getElementById("status")
  };


  // Load stored settings (with defaults)

  const {
    thresholdPercent = 80,
    blockList        = [],
    privacyMode      = false,
    autoScan         = false
  } = await chrome.storage.sync.get(
    ["thresholdPercent","blockList","privacyMode","autoScan"]
  );

  // Initialize form fields
  els.threshold.value      = thresholdPercent;
  els.threshVal.textContent = thresholdPercent + "%";
  els.blockList.value      = blockList.join(", ");
  els.privacyMode.checked  = privacyMode;
  els.autoScan.checked     = autoScan;

  // Show live slider value
  els.threshold.oninput = () => {
    els.threshVal.textContent = els.threshold.value + "%";
  };


  // Save settings and reload the active tab

  els.saveBtn.onclick = async () => {
    const tp = parseInt(els.threshold.value, 10);
    const bl = els.blockList.value
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    await chrome.storage.sync.set({
      thresholdPercent: tp,
      blockList:        bl,
      privacyMode:      els.privacyMode.checked,
      autoScan:         els.autoScan.checked
    });

    els.status.textContent = "Settings saved! Reloading…";
    // Reload to apply new settings immediately
    chrome.tabs.query({active:true, currentWindow:true}, tabs => {
      if (tabs[0]?.id) chrome.tabs.reload(tabs[0].id);
    });

    setTimeout(() => { els.status.textContent = ""; }, 1500);
  };
});
