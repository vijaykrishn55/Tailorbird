import { defineBackground } from 'wxt/utils/define-background';

// The service worker does almost nothing: it opens the side panel when the toolbar icon is clicked.
// Page capture is injected only on the user's click (activeTab), from the side panel.
export default defineBackground(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    return;
  }
  const ff = (globalThis as { browser?: { sidebarAction?: { open(): void } } }).browser;
  if (ff?.sidebarAction) chrome.action?.onClicked.addListener(() => ff.sidebarAction!.open());
});
