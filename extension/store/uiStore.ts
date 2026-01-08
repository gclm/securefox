import {create} from 'zustand';
import {Notification} from '@/types';
import {type AutoLockOption, SESSION_CONFIG} from '@/utils/constants';
import {getUserSettings, saveAutoLockMinutes} from '@/lib/storage';

interface UIState {
    // State
    notifications: Notification[];
    isGeneratorOpen: boolean;
    isSettingsOpen: boolean;
    activeView: 'list' | 'favorites' | 'recent' | 'generator' | 'cards' | 'notes';
    autoLockMinutes: AutoLockOption;

    // User preferences
    clickToFill: boolean;
    showQuickCopy: boolean;

    // Modal states
    isAddItemModalOpen: boolean;
    selectedItemId: string | null;
    detailViewType: 'login' | 'note' | 'card' | null;

    // Actions
    showNotification: (notification: Omit<Notification, 'id'>) => void;
    dismissNotification: (id: string) => void;
    clearNotifications: () => void;
    setGeneratorOpen: (open: boolean) => void;
    setSettingsOpen: (open: boolean) => void;
    setActiveView: (view: UIState['activeView']) => void;
    setAutoLockMinutes: (minutes: AutoLockOption) => Promise<void>;
    setAddItemModalOpen: (open: boolean) => void;
    showDetailView: (itemId: string, type: 'login' | 'note' | 'card') => void;
    closeDetailView: () => void;
    setClickToFill: (enabled: boolean) => Promise<void>;
    setShowQuickCopy: (enabled: boolean) => Promise<void>;
}

const useUIStore = create<UIState>((set) => ({
    // Initial state
    notifications: [],
    isGeneratorOpen: false,
    isSettingsOpen: false,
    activeView: 'list',
    autoLockMinutes: SESSION_CONFIG.AUTO_LOCK_MINUTES as AutoLockOption,

    // User preferences (defaults)
    clickToFill: false, // Default to false (show detail view on click)
    showQuickCopy: true, // Default to true (show quick copy buttons)

    // Modal states
    isAddItemModalOpen: false,
    selectedItemId: null,
    detailViewType: null,

    // Show notification
    showNotification: (notification) => {
        const id = Math.random().toString(36).substring(7);
        const newNotification: Notification = {
            id,
            duration: 3000,
            ...notification,
        };

        set(state => ({
            notifications: [...state.notifications, newNotification],
        }));

        // Auto-dismiss after duration
        if (newNotification.duration && newNotification.duration > 0) {
            setTimeout(() => {
                useUIStore.getState().dismissNotification(id);
            }, newNotification.duration);
        }
    },

    // Dismiss notification
    dismissNotification: (id) => {
        set(state => ({
            notifications: state.notifications.filter(n => n.id !== id),
        }));
    },

    // Clear all notifications
    clearNotifications: () => {
        set({notifications: []});
    },

    // Set generator open state
    setGeneratorOpen: (open) => {
        set({isGeneratorOpen: open});
    },

    // Set settings open state
    setSettingsOpen: (open) => {
        set({isSettingsOpen: open});
    },

    // Set active view
    setActiveView: (view) => {
        set({activeView: view});
    },

    // Set auto-lock minutes
    setAutoLockMinutes: async (minutes) => {
        try {
            set({autoLockMinutes: minutes});
            await saveAutoLockMinutes(minutes);

            // Notify background script to update timer
            chrome.runtime.sendMessage({
                type: 'UPDATE_AUTO_LOCK',
                minutes,
            }).catch(() => {
                // Ignore if no listener
            });
        } catch (error) {
            console.error('Failed to update auto-lock minutes:', error);
            // Revert to previous value on error
            const settings = await getUserSettings();
            set({autoLockMinutes: settings.autoLockMinutes});
        }
    },

    // Set add item modal state
    setAddItemModalOpen: (open) => {
        set({isAddItemModalOpen: open});
    },

    // Show detail view
    showDetailView: (itemId, type) => {
        set({selectedItemId: itemId, detailViewType: type});
    },

    // Close detail view
    closeDetailView: () => {
        set({selectedItemId: null, detailViewType: null});
    },

    // Set click to fill preference
    setClickToFill: async (enabled) => {
        try {
            set({clickToFill: enabled});
            // Save to chrome.storage.local
            await chrome.storage.local.set({clickToFill: enabled});
        } catch (error) {
            console.error('Failed to save click to fill setting:', error);
        }
    },

    // Set show quick copy preference
    setShowQuickCopy: async (enabled) => {
        try {
            set({showQuickCopy: enabled});
            // Save to chrome.storage.local
            await chrome.storage.local.set({showQuickCopy: enabled});
        } catch (error) {
            console.error('Failed to save show quick copy setting:', error);
        }
    },
}));

// Load auto-lock preference on startup
getUserSettings().then((settings) => {
    useUIStore.setState({autoLockMinutes: settings.autoLockMinutes});
});

// Load user preferences on startup
chrome.storage.local.get(['clickToFill', 'showQuickCopy']).then((result) => {
    if (result.clickToFill !== undefined) {
        useUIStore.setState({clickToFill: result.clickToFill});
    }
    if (result.showQuickCopy !== undefined) {
        useUIStore.setState({showQuickCopy: result.showQuickCopy});
    }
});

export default useUIStore;