// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set first install flag
    chrome.storage.local.set({ firstInstall: true });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // This is fine because it's in direct response to user clicking the extension icon
    await chrome.sidePanel.open({ windowId: tab.windowId });
    console.log('Side panel opened');
    
    // Check and clear first install flag
    const result = await chrome.storage.local.get(['firstInstall']);
    if (result.firstInstall) {
      await chrome.storage.local.remove('firstInstall');
    }
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
}); 