import { create } from 'zustand';
import { Session } from '@/types';
import * as authApi from '@/lib/api/auth';
import { STORAGE_KEYS } from '@/utils/constants';

interface AuthState {
  // State
  session: Session | null;
  isUnlocked: boolean;
  isLoading: boolean;
  error: string | null;
  loginAttempts: number;
  
  // Actions
  unlock: (password: string) => Promise<boolean>;
  lock: () => Promise<void>;
  checkSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  session: null,
  isUnlocked: false,
  isLoading: false,
  error: null,
  loginAttempts: 0,
  
  // Unlock vault
  unlock: async (password: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await authApi.unlock(password);
      
      if (response.success) {
        const storage = await chrome.storage.session.get(STORAGE_KEYS.SESSION);
        const session = storage[STORAGE_KEYS.SESSION] as Session;
        
      set({
        session,
        isUnlocked: true,
        isLoading: false,
        loginAttempts: 0,
        error: null,
      });
        
        // Notify other parts of extension
        chrome.runtime.sendMessage({
          type: 'VAULT_UNLOCKED',
        }).catch(() => {});
        
        return true;
      } else {
        set(state => ({
          error: response.message || 'Invalid password',
          isLoading: false,
          loginAttempts: state.loginAttempts + 1,
        }));
        return false;
      }
    } catch (error: any) {
      set(state => ({
        error: error.message || 'Failed to unlock vault',
        isLoading: false,
        loginAttempts: state.loginAttempts + 1,
      }));
      return false;
    }
  },
  
  // Lock vault
  lock: async () => {
    set({ isLoading: true });
    
    try {
      await authApi.lock();
      
      set({
        session: null,
        isUnlocked: false,
        isLoading: false,
      });
      
      // Notify other parts
      chrome.runtime.sendMessage({
        type: 'VAULT_LOCKED',
      }).catch(() => {});
    } catch (error: any) {
      set({
        error: error.message || 'Failed to lock vault',
        isLoading: false,
      });
    }
  },
  
  // Check current session
  checkSession: async () => {
    try {
      const session = await authApi.getSession();
      const isUnlocked = session !== null;
      
      set({
        session,
        isUnlocked,
      });
    } catch {
      set({
        session: null,
        isUnlocked: false,
      });
    }
  },
  
  // Refresh session token
  refreshSession: async () => {
    try {
      const success = await authApi.refreshSession();
      
      if (success) {
        const session = await authApi.getSession();
        set({ session });
      } else {
        set({
          session: null,
          isUnlocked: false,
        });
      }
    } catch {
      set({
        session: null,
        isUnlocked: false,
      });
    }
  },
  
  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));

// Auto-refresh session
setInterval(async () => {
  const state = useAuthStore.getState();
  if (state.isUnlocked && state.session) {
    const timeUntilExpiry = state.session.expiresAt - Date.now();
    
    // Refresh if less than 5 minutes remaining
    if (timeUntilExpiry < 5 * 60 * 1000) {
      await state.refreshSession();
    }
  }
}, 60 * 1000); // Check every minute

export default useAuthStore;