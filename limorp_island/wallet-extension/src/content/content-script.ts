console.log("[Limorp] Content script loaded");

// Inject inpage.js into the web page
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inpage.js");
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Handle messages from inpage.js
window.addEventListener("message", (event) => {
  if (
    event.source !== window ||
    !event.data ||
    event.data.source !== "limorp-inpage"
  ) {
    return;
  }

  console.log("[Limorp] Message from inpage:", event.data);

  // Forward to background script
  chrome.runtime.sendMessage(event.data.payload, (response: any) => {
    // Return response to inpage
    window.postMessage(
      {
        source: "limorp-content",
        requestId: event.data.requestId,
        payload: response,
      },
      "*",
    );
  });
});
// Forward messages from background script to inpage script
chrome.runtime.onMessage.addListener((message: any) => {
  if (message.type === "ACCOUNTS_CHANGED") {
    window.postMessage(
      {
        source: "limorp-content",
        event: "accountsChanged",
        data: message.payload,
      },
      "*",
    );
  }
});
