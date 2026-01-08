import {MESSAGE_TYPES, STORAGE_KEYS} from '@/utils/constants';
import * as authApi from '@/lib/api/auth';
import * as entriesApi from '@/lib/api/entries';
import {getAutoLockMinutes} from '@/lib/storage';
import {findMatchingItems} from '@/utils/helpers';

export default defineBackground(() => {
    console.log('SecureFox background service started', {id: browser.runtime.id});

    const AUTO_LOCK_ALARM = 'securefox-auto-lock';

    // Session keep-alive timer (for "lock on browser close" mode)
    let keepAliveTimer: NodeJS.Timeout | null = null;

    // Start session keep-alive mechanism (for "lock on browser close" mode)
    const startKeepAlive = async () => {
        // Clear existing keep-alive timer
        if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
            keepAliveTimer = null;
        }

        console.log('Starting session keep-alive (heartbeat every 10 minutes)');
        
        // Send heartbeat every 10 minutes to keep session alive
        keepAliveTimer = setInterval(async () => {
            try {
                const isUnlocked = await authApi.isUnlocked();
                if (isUnlocked) {
                    // Make a lightweight API call to refresh session
                    await authApi.getStatus();
                    console.log('Session keep-alive: heartbeat sent');
                } else {
                    // If locked, stop keep-alive
                    if (keepAliveTimer) {
                        clearInterval(keepAliveTimer);
                        keepAliveTimer = null;
                    }
                }
            } catch (error) {
                console.error('Session keep-alive failed:', error);
            }
        }, 10 * 60 * 1000); // Every 10 minutes
    };

    // Stop session keep-alive
    const stopKeepAlive = () => {
        if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
            keepAliveTimer = null;
            console.log('Session keep-alive stopped');
        }
    };

    // Reset auto-lock alarm
    const resetAutoLockAlarm = async () => {
        // Always clear existing alarm first
        await chrome.alarms.clear(AUTO_LOCK_ALARM);

        // Get auto-lock minutes from storage
        const minutes = await getAutoLockMinutes();

        // -1 means lock on browser close, use keep-alive instead
        if (minutes === -1) {
            console.log('Auto-lock: Following browser close mode (using keep-alive)');
            stopKeepAlive();
            startKeepAlive();
            return;
        }

        // Stop keep-alive when using timed auto-lock
        stopKeepAlive();

        // Set new alarm
        console.log(`Auto-lock alarm set for ${minutes} minutes`);
        await chrome.alarms.create(AUTO_LOCK_ALARM, {
            delayInMinutes: minutes
        });
    };

    // Handle alarms
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === AUTO_LOCK_ALARM) {
            console.log('Auto-lock alarm fired, locking vault...');
            try {
                // Auto-lock the vault
                await authApi.lock();

                // Update extension icon
                await updateExtensionIcon(false);

                // Notify all tabs
                await chrome.runtime.sendMessage({
                    type: MESSAGE_TYPES.VAULT_LOCKED,
                }).catch(() => {
                    // Ignore errors if no receivers
                });
            } catch (error) {
                console.error('Failed to process auto-lock alarm:', error);
            }
        }
    });

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
            await chrome.action.setIcon({path: iconPath});
        } catch (error) {
            // Fallback for browsers that don't support dynamic icons
            console.log('Failed to update icon:', error);
        }
    };

    // Update badge based on matching entries for URL
    const updateBadge = async (url: string, tabId?: number) => {
        try {
            // First check if vault is unlocked
            const isUnlocked = await authApi.isUnlocked();

            // If locked, clear badge and return early (don't call API)
            if (!isUnlocked) {
                await chrome.action.setBadgeText({text: '', tabId});
                return;
            }

            // Only fetch entries when unlocked
            const allEntries = await entriesApi.getEntries();
            const matchingEntries = findMatchingItems(allEntries, url);
            const count = matchingEntries.length;

            // Update badge - show count
            if (count > 0) {
                await chrome.action.setBadgeText({
                    text: count.toString(),
                    tabId
                });
                // Use blue color for unlocked state
                await chrome.action.setBadgeBackgroundColor({
                    color: '#3b82f6', // Blue
                    tabId
                });
            } else {
                await chrome.action.setBadgeText({text: '', tabId});
            }
        } catch (error) {
            console.error('Failed to update badge:', error);
            // Clear badge on error
            await chrome.action.setBadgeText({text: '', tabId}).catch(() => {
            });
        }
    };

    // Handle messages from popup and content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Handle async responses
        (async () => {
            try {
                // Check if we should reset auto-lock on this message
                if (message.type !== MESSAGE_TYPES.LOCK_VAULT && 
                    message.type !== MESSAGE_TYPES.VAULT_LOCKED) {
                    const isUnlocked = await authApi.isUnlocked();
                    if (isUnlocked) {
                        await resetAutoLockAlarm();
                    }
                }

                switch (message.type) {
                    case MESSAGE_TYPES.HEARTBEAT:
                        // Just resetting the timer is enough (handled above)
                        sendResponse({success: true});
                        break;

                    case MESSAGE_TYPES.UNLOCK_VAULT:
                        const unlockResult = await authApi.unlock(message.password);
                        if (unlockResult.success) {
                            await resetAutoLockAlarm();
                            await updateExtensionIcon(true);
                        }
                        sendResponse(unlockResult);
                        break;

                    case MESSAGE_TYPES.LOCK_VAULT:
                        await authApi.lock();
                        await chrome.alarms.clear(AUTO_LOCK_ALARM);
                        stopKeepAlive();
                        await updateExtensionIcon(false);
                        sendResponse({success: true});
                        break;

                    case MESSAGE_TYPES.GET_STATUS:
                        const isUnlocked = await authApi.isUnlocked();
                        sendResponse({isUnlocked});
                        break;

                    case MESSAGE_TYPES.GET_ALL_ENTRIES:
                        // Get all entries without domain filtering (for cards/identity)
                        try {
                            const allEntries = await entriesApi.getEntries();

                            // Return with full entry info including type
                            const formattedEntries = allEntries.map(entry => ({
                                id: entry.id,
                                type: entry.type,
                                name: entry.name,
                                login: entry.login ? {
                                    username: entry.login.username || '',
                                    password: entry.login.password || '',
                                    totp: entry.login.totp,
                                    uris: entry.login.uris
                                } : undefined,
                                card: entry.card,
                                identity: entry.identity,
                                favorite: entry.favorite || false,
                                revisionDate: entry.revisionDate
                            }));

                            sendResponse({entries: formattedEntries});
                        } catch (error) {
                            console.error('Failed to get all entries:', error);
                            sendResponse({entries: [], error: 'Failed to fetch entries'});
                        }
                        break;

                    case MESSAGE_TYPES.CHECK_MATCHING_COUNT:
                        // Check if matching credentials exist (works even when locked)
                        try {
                            const allEntries = await entriesApi.getEntries();
                            const matchingEntries = findMatchingItems(allEntries, sender.tab?.url || '');
                            sendResponse({count: matchingEntries.length, hasMatches: matchingEntries.length > 0});
                        } catch (error) {
                            console.error('Failed to check matching count:', error);
                            sendResponse({count: 0, hasMatches: false, error: 'Failed to check matches'});
                        }
                        break;

                    case MESSAGE_TYPES.REQUEST_CREDENTIALS:
                        // Get credentials for the requesting domain
                        const domain = message.domain || (sender.tab?.url ? new URL(sender.tab.url).hostname : '');

                        try {
                            // Get all entries
                            const allEntries = await entriesApi.getEntries();

                            // Filter and sort by relevance using frontend matching logic
                            const matchingEntries = findMatchingItems(allEntries, sender.tab?.url || '');

                            // Return with full entry info including type
                            const formattedEntries = matchingEntries.map(entry => ({
                                id: entry.id,
                                type: entry.type,
                                name: entry.name,
                                login: entry.login ? {
                                    username: entry.login.username || '',
                                    password: entry.login.password || '',
                                    totp: entry.login.totp,
                                    uris: entry.login.uris
                                } : undefined,
                                card: entry.card,
                                identity: entry.identity,
                                favorite: entry.favorite || false,
                                revisionDate: entry.revisionDate
                            }));

                            sendResponse({entries: formattedEntries});
                        } catch (error) {
                            console.error('Failed to get credentials:', error);
                            sendResponse({entries: [], error: 'Failed to fetch credentials'});
                        }
                        break;

                    case 'AUTOFILL_CREDENTIALS':
                        // Get credentials by entryId and autofill to active tab
                        try {
                            const {entryId} = message;
                            const allEntries = await entriesApi.getEntries();
                            const entry = allEntries.find((e: any) => e.id === entryId);

                            if (!entry) {
                                sendResponse({success: false, error: 'Entry not found'});
                                break;
                            }

                            // Get the active tab
                            const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});

                            if (!activeTab || !activeTab.id) {
                                sendResponse({success: false, error: 'No active tab'});
                                break;
                            }

                            // Send fill credentials message to content script
                            await chrome.tabs.sendMessage(activeTab.id, {
                                type: MESSAGE_TYPES.FILL_CREDENTIALS,
                                data: {
                                    username: entry.login?.username || '',
                                    password: entry.login?.password || '',
                                },
                            });

                            sendResponse({success: true});
                        } catch (error: any) {
                            console.error('Failed to autofill credentials:', error);
                            sendResponse({success: false, error: error.message});
                        }
                        break;

                    case 'GET_TOTP':
                        // Get TOTP code for an entry
                        try {
                            const {entryId} = message;
                            const totpResponse = await entriesApi.getTOTP(entryId);
                            sendResponse({code: totpResponse.code});
                        } catch (error: any) {
                            console.error('Failed to get TOTP:', error);
                            sendResponse({error: error.message});
                        }
                        break;

                    case 'OPEN_POPUP':
                        // Handle request to open extension popup with optional action
                        try {
                            const {action} = message;

                            // Store the action in storage so popup can read it when opened
                            if (action === 'add') {
                                await chrome.storage.local.set({'pendingAction': 'openAddModal'});
                            }

                            // Try to open popup (works in some browsers/contexts)
                            // Note: chrome.action.openPopup() is only available in certain contexts
                            try {
                                if (chrome.action?.openPopup) {
                                    await chrome.action.openPopup();
                                }
                            } catch (e) {
                                // If openPopup is not available or fails, user will need to click the extension icon
                                console.log('Cannot open popup programmatically, waiting for user to click extension icon');
                            }

                            sendResponse({success: true});
                        } catch (error: any) {
                            console.error('Failed to handle OPEN_POPUP:', error);
                            sendResponse({success: false, error: error.message});
                        }
                        break;

                    case MESSAGE_TYPES.FILL_CREDENTIALS:
                        // Forward to content script in the active tab
                        if (sender.tab?.id) {
                            chrome.tabs.sendMessage(sender.tab.id, {
                                type: MESSAGE_TYPES.FILL_CREDENTIALS,
                                data: message.data,
                            });
                        }
                        sendResponse({success: true});
                        break;

                    case MESSAGE_TYPES.SAVE_CREDENTIALS:
                        // Save new credentials (backend handles deduplication)
                        try {
                            const newEntry = await entriesApi.createEntry(message.data);
                            sendResponse({success: true, entry: newEntry});
                        } catch (error: any) {
                            sendResponse({success: false, error: error.message});
                        }
                        break;

                    case MESSAGE_TYPES.VAULT_UNLOCKED:
                        await resetAutoLockAlarm();
                        await updateExtensionIcon(true);
                        break;

                    case MESSAGE_TYPES.VAULT_LOCKED:
                        await chrome.alarms.clear(AUTO_LOCK_ALARM);
                        stopKeepAlive();
                        await updateExtensionIcon(false);
                        break;

                    case 'UPDATE_AUTO_LOCK':
                        // Settings updated, restart timer if unlocked
                        const isCurrentlyUnlocked = await authApi.isUnlocked();
                        if (isCurrentlyUnlocked) {
                            await resetAutoLockAlarm();
                        }
                        sendResponse({success: true});
                        break;

                    case 'UPDATE_BADGE':
                        // Content script detected login form
                        if (message.domain && sender.tab?.id && sender.tab.url) {
                            await updateBadge(sender.tab.url, sender.tab.id);
                        }
                        sendResponse({success: true});
                        break;

                    case 'UPDATE_AUTOFILL_SETTING':
                        // Autofill on page load setting updated
                        // No action needed - the setting is stored and used when page loads
                        sendResponse({success: true});
                        break;

                    default:
                        sendResponse({error: 'Unknown message type'});
                }
            } catch (error: any) {
                sendResponse({error: error.message || 'An error occurred'});
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
        
        // Initialize context menus
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

    // Handle browser startup
    chrome.runtime.onStartup.addListener(async () => {
        // Check if vault should be locked on startup
        const session = await chrome.storage.session.get(STORAGE_KEYS.SESSION);
        if (!session[STORAGE_KEYS.SESSION]) {
            await updateExtensionIcon(false);
        }
    });

    // Monitor user activity to reset auto-lock timer
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        const isUnlocked = await authApi.isUnlocked();
        if (isUnlocked) {
            await resetAutoLockAlarm();
        }

        // Update badge for newly activated tab
        try {
            const tab = await chrome.tabs.get(activeInfo.tabId);
            if (tab.url) {
                await updateBadge(tab.url, activeInfo.tabId);
            }
        } catch (error) {
            console.error('Failed to update badge on tab activation:', error);
        }
    });

    // Monitor tab URL changes to update badge and handle autofill
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        // Only update when URL changes
        if (changeInfo.url && tab.url) {
            try {
                await updateBadge(tab.url, tabId);
            } catch (error) {
                console.error('Failed to update badge on tab update:', error);
            }
        }

        // Handle autofill on page load
        if (changeInfo.status === 'complete' && tab.url) {
            try {
                // Check if autofill on page load is enabled
                const result = await chrome.storage.local.get('autofillOnPageLoad');
                const autofillEnabled = result.autofillOnPageLoad === true;

                if (!autofillEnabled) {
                    return; // Autofill is disabled
                }

                // Check if vault is unlocked
                const isUnlocked = await authApi.isUnlocked();
                if (!isUnlocked) {
                    return; // Don't autofill when vault is locked
                }

                // Get matching entries
                const allEntries = await entriesApi.getEntries();
                const matchingEntries = findMatchingItems(allEntries, tab.url);

                // Only autofill if there's exactly one match
                if (matchingEntries.length === 1) {
                    const entry = matchingEntries[0];

                    // Check if this is an HTTP connection (not HTTPS)
                    const isHttpConnection = tab.url.startsWith('http:') && !tab.url.startsWith('https:');

                    // Send autofill message to content script
                    chrome.tabs.sendMessage(tabId, {
                        type: MESSAGE_TYPES.FILL_CREDENTIALS,
                        data: entry,
                        isHttpConnection: isHttpConnection, // Pass HTTP flag for warning
                    }).catch(() => {
                        // Content script might not be ready yet, that's okay
                        console.log('Content script not ready for autofill');
                    });

                    if (isHttpConnection) {
                        console.log(`SecureFox: Auto-filled credentials for ${entry.name} on HTTP site`);
                    } else {
                        console.log(`SecureFox: Auto-filled credentials for ${entry.name}`);
                    }
                }
            } catch (error) {
                console.error('Failed to handle autofill on page load:', error);
            }
        }
    });

    // Monitor window removal for "lock on browser close" feature
    chrome.windows.onRemoved.addListener(async (windowId) => {
        // Check if user has "lock on browser close" enabled
        const minutes = await getAutoLockMinutes();
        if (minutes !== -1) {
            console.log('Window closed but not using lock-on-close mode, ignoring');
            return; // Not using lock on browser close
        }

        console.log(`Window ${windowId} closed, checking if should lock...`);

        // Use a small delay to ensure window list is updated
        setTimeout(async () => {
            try {
                // Check if any windows remain
                const windows = await chrome.windows.getAll({windowTypes: ['normal']});
                
                console.log(`Remaining windows: ${windows.length}`);
                
                // Only lock if NO normal browser windows remain
                if (windows.length === 0) {
                    // Additional check: verify no tabs exist at all
                    // This prevents locking when tabs are moved/merged by extensions
                    const allTabs = await chrome.tabs.query({});
                    
                    console.log(`Remaining tabs: ${allTabs.length}`);
                    
                    // If there are still tabs (e.g., in extension popups or suspended by tab managers),
                    // don't lock - the browser is still running
                    if (allTabs.length > 0) {
                        console.log('Tabs still exist (possibly managed by extensions), not locking');
                        return;
                    }
                    
                    const isUnlocked = await authApi.isUnlocked();
                    if (isUnlocked) {
                        console.log('All browser windows closed, locking vault...');
                        await authApi.lock();
                        await updateExtensionIcon(false);
                    } else {
                        console.log('Vault already locked, no action needed');
                    }
                } else {
                    console.log('Browser windows still open, not locking');
                }
            } catch (error) {
                console.error('Error checking windows on close:', error);
            }
        }, 150); // Slightly longer delay to ensure accurate state
    });

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (!tab?.id) return;

        switch (info.menuItemId) {
            case 'securefox-fill':
                // Request credentials for current domain
                if (tab.url) {
                    const domain = new URL(tab.url).hostname;
                    const entries = await entriesApi.searchEntries({domain});

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
                const {password} = await entriesApi.generatePassword();
                chrome.tabs.sendMessage(tab.id, {
                    type: 'INSERT_GENERATED_PASSWORD',
                    data: {password},
                });
                break;
        }
    });

    // Initialize on startup
    (async () => {
        const isUnlocked = await authApi.isUnlocked();
        await updateExtensionIcon(isUnlocked);

        if (isUnlocked) {
            await resetAutoLockAlarm();
        }
    })();
});
