// chrome-extension/content.js

;(async () => {
  console.log("[CB] content.js loaded");


  // Only run on reddit.com / subdomains

  if (!/\.reddit\.com$/.test(location.hostname)) {
    console.log("[CB] Not Reddit, skipping.");
    return;
  }


  // Load settings from chrome.storage

  let {
    thresholdPercent = 80,
    privacyMode      = false,
    autoScan         = false,
    blockList        = []
  } = await chrome.storage.sync.get(
    ["thresholdPercent","privacyMode","autoScan","blockList"]
  );

  // Convert to usable formats
  let threshold    = thresholdPercent / 100;
  let blockRegexes = blockList.map(w => new RegExp(`\\b${w.trim()}\\b`, "i"));

  // Listen for settings changes and re-scan
  chrome.storage.onChanged.addListener(changes => {
    if (changes.thresholdPercent) {
      threshold = changes.thresholdPercent.newValue / 100;
    }
    if (changes.privacyMode) {
      privacyMode = changes.privacyMode.newValue;
    }
    if (changes.autoScan) {
      autoScan = changes.autoScan.newValue;
    }
    if (changes.blockList) {
      blockRegexes = changes.blockList.newValue.map(
        w => new RegExp(`\\b${w.trim()}\\b`, "i")
      );
    }
    scanAll();
  });


  // Helper: enqueue flagged text to backend

  async function enqueue(text) {
    try {
      await fetch("http://localhost:8000/detect", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          comment_id: `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          text
        })
      });
    } catch (err) {
      console.error("[CB] enqueue error", err);
    }
  }


  // Flag an element: highlight, (optional) blur, and enqueue

  function flag(el, text) {
    if (el.dataset.cbFlagged) return;
    el.dataset.cbFlagged = "1";
    el.style.border          = "2px solid crimson";
    el.style.backgroundColor = "rgba(255,0,0,0.1)";
    if (privacyMode) {
      el.style.filter = "blur(5px)";
    }
    enqueue(text);
  }


  // Clear all previous flags/styles

  function clearFlags() {
    document.querySelectorAll("[data-cb-flagged]").forEach(el => {
      delete el.dataset.cbFlagged;
      el.removeAttribute("style");
    });
  }


  // Scan one element: block-list first, then remote classify if autoScan

  async function scanElement(el) {
    const txt = el.innerText.trim();
    if (!txt) return;

    // 1) Immediate block-list match
    if (blockRegexes.some(rx => rx.test(txt))) {
      flag(el, txt);
      return;
    }

    // 2) If autoScan enabled, send to backend for classification
    if (autoScan) {
      try {
        const res = await fetch("http://localhost:8000/detect", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            comment_id: `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            text: txt
          })
        });
        if (!res.ok) return;
        const { label, confidence } = await res.json();
        if (label === "cyberbully" && confidence >= threshold) {
          flag(el, txt);
        }
      } catch (err) {
        console.error("[CB] autoScan error", err);
      }
    }
  }


  // Scan all candidate elements on the page

  function scanAll() {
    clearFlags();
    document
      .querySelectorAll('[data-test-id="comment"], .Comment, .comment, p')
      .forEach(scanElement);
  }

  // Initial scan on page load
  scanAll();

  // Re-scan when new nodes are added (infinite scroll, etc.)
  new MutationObserver(muts => {
    for (const { addedNodes } of muts) {
      if (addedNodes.length) {
        setTimeout(scanAll, 100);
        break;
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

})();

