// chrome-extension/background.js


chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "detect-cyberbully",
    title: "Detect Cyberbullying",
    contexts: ["selection"]
  });
  console.log("[Background] Context menu created");
});


// When the context-menu item is clicked, send selected text to backend
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "detect-cyberbully") return;

  const text = info.selectionText;
  const commentId = "chrome_manual_" + Date.now();

  try {
    // POST /detect
    const res = await fetch("http://localhost:8000/detect", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ comment_id: commentId, text })
    });

    const { label, confidence } = await res.json();
    console.log(`[Background] Detection result: ${label}, ${confidence}`);

    // Notify the user
    chrome.notifications.create({
      type:    "basic",
      iconUrl: "icon48.png",
      title:   label.toUpperCase(),
      message: `Confidence: ${(confidence * 100).toFixed(1)}%`
    });

  } catch (err) {
    console.error("[Background] Manual detect failed:", err);
    chrome.notifications.create({
      type:    "basic",
      iconUrl: "icon48.png",
      title:   "Error",
      message: "Could not connect to backend."
    });
  }
});
