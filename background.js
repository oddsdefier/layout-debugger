// Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Layout Debugger extension installed');
});

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    console.log('Layout Debugger side panel opened for tab:', tab.id);
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
});

