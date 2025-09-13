chrome.runtime.onInstalled.addListener(() => {
  // Set default state on installation
  chrome.storage.local.set({
    magnifierActive: false,
    currentFilter: 'protanopia'
  });
  console.log("ChromaLens installed and default state set.");
});