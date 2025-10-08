import { MESSAGE_TYPES, SESSION_CONFIG, STORAGE_KEYS } from '@/utils/constants';
import * as authApi from '@/lib/api/auth';
import * as entriesApi from '@/lib/api/entries';
import { getAutoLockMinutes } from '@/lib/storage';

export default defineBackground(() => {
  console.log('SecureFox background service started', { id: browser.runtime.id });

  // Auto-lock timer
  let autoLockTimer: NodeJS.Timeout | null = null;

  // Reset auto-lock timer
  const resetAutoLockTimer = async () => {
    if (autoLockTimer) {
      clearTimeout(autoLockTimer);
    }
    
    // Get auto-lock minutes from storage
    const minutes = await getAutoLockMinutes();
    
    autoLockTimer = setTimeout(async () => {
      // Auto-lock the vault
      await authApi.lock();
      
      // Update extension icon
      await updateExtensionIcon(false);
      
      // Notify all tabs
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.VAULT_LOCKED,
      }).catch(() => {});
    }, minutes * 60 * 1000);
  };

  // Update extension icon based on lock state
  const updateExtensionIcon = async (isUnlocked: boolean) => {
    // For now, use the same icons for both states
    // TODO: Add locked state icons
    const iconPath = {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png'
    };
    
    try {
      await chrome.action.setIcon({ path: iconPath });
    } catch (error) {
      // Fallback for browsers that don't support dynamic icons
      console.log('Failed to update icon:', error);
    }
  };

  // Handle messages from popup and content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle async responses
    (async () => {
      try {
        switch (message.type) {
          case MESSAGE_TYPES.UNLOCK_VAULT:
            const unlockResult = await authApi.unlock(message.password);
            if (unlockResult.success) {
              resetAutoLockTimer();
              await updateExtensionIcon(true);
            }
            sendResponse(unlockResult);
            break;

          case MESSAGE_TYPES.LOCK_VAULT:
            await authApi.lock();
            if (autoLockTimer) {
              clearTimeout(autoLockTimer);
            }
            await updateExtensionIcon(false);
            sendResponse({ success: true });
            break;

          case MESSAGE_TYPES.GET_STATUS:
            const isUnlocked = await authApi.isUnlocked();
            sendResponse({ isUnlocked });
            break;

          case MESSAGE_TYPES.REQUEST_CREDENTIALS:
            // Get credentials for the requesting domain
            const domain = message.domain || (sender.tab?.url ? new URL(sender.tab.url).hostname : '');
            const entries = await entriesApi.searchEntries({ domain });
            sendResponse({ entries });
            break;

          case MESSAGE_TYPES.FILL_CREDENTIALS:
            // Forward to content script in the active tab
            if (sender.tab?.id) {
              chrome.tabs.sendMessage(sender.tab.id, {
                type: MESSAGE_TYPES.FILL_CREDENTIALS,
                data: message.data,
              });
            }
            sendResponse({ success: true });
            break;

          case MESSAGE_TYPES.SAVE_CREDENTIALS:
            // Save new credentials
            const newEntry = await entriesApi.createEntry(message.data);
            sendResponse({ success: true, entry: newEntry });
            break;

          case MESSAGE_TYPES.VAULT_UNLOCKED:
            resetAutoLockTimer();
            await updateExtensionIcon(true);
            break;

          case MESSAGE_TYPES.VAULT_LOCKED:
            if (autoLockTimer) {
              clearTimeout(autoLockTimer);
            }
            await updateExtensionIcon(false);
            break;

          case 'UPDATE_AUTO_LOCK':
            // Settings updated, restart timer if unlocked
            const isCurrentlyUnlocked = await authApi.isUnlocked();
            if (isCurrentlyUnlocked) {
              await resetAutoLockTimer();
            }
            sendResponse({ success: true });
            break;

          default:
            sendResponse({ error: 'Unknown message type' });
        }
      } catch (error: any) {
        sendResponse({ error: error.message || 'An error occurred' });
      }
    })();

    // Return true to indicate async response
    return true;
  });

  // Handle extension install/update
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('SecureFox installed');
      // Open welcome page
      chrome.tabs.create({
        url: chrome.runtime.getURL('popup.html'),
      });
    } else if (details.reason === 'update') {
      console.log('SecureFox updated to version', chrome.runtime.getManifest().version);
    }
  });

  // Handle browser startup
  chrome.runtime.onStartup.addListener(async () => {
    // Check if vault should be locked on startup
    const session = await chrome.storage.session.get(STORAGE_KEYS.SESSION);
    if (!session[STORAGE_KEYS.SESSION]) {
      await updateExtensionIcon(false);
    }
  });

  // Monitor user activity to reset auto-lock timer
  chrome.tabs.onActivated.addListener(async () => {
    const isUnlocked = await authApi.isUnlocked();
    if (isUnlocked) {
      resetAutoLockTimer();
    }
  });

  // Create context menu items
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'securefox-fill',
      title: 'Fill credentials',
      contexts: ['editable'],
    });

    chrome.contextMenus.create({
      id: 'securefox-generate',
      title: 'Generate password',
      contexts: ['editable'],
    });
  });

  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    switch (info.menuItemId) {
      case 'securefox-fill':
        // Request credentials for current domain
        if (tab.url) {
          const domain = new URL(tab.url).hostname;
          const entries = await entriesApi.searchEntries({ domain });
          
          if (entries.length > 0) {
            // Send first matching entry to content script
            chrome.tabs.sendMessage(tab.id, {
              type: MESSAGE_TYPES.FILL_CREDENTIALS,
              data: {
                username: entries[0].login?.username || '',
                password: entries[0].login?.password || '',
              },
            });
          }
        }
        break;

      case 'securefox-generate':
        // Generate and insert password
        const { password } = await entriesApi.generatePassword();
        chrome.tabs.sendMessage(tab.id, {
          type: 'INSERT_GENERATED_PASSWORD',
          data: { password },
        });
        break;
    }
  });

  // Initialize on startup
  (async () => {
    const isUnlocked = await authApi.isUnlocked();
    await updateExtensionIcon(isUnlocked);
    
    if (isUnlocked) {
      resetAutoLockTimer();
    }
  })();
});
