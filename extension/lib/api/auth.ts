import { apiCall } from './client';
import { UnlockRequest, UnlockResponse, Session } from '@/types';
import { API_ENDPOINTS, STORAGE_KEYS, API_BASE_URL } from '@/utils/constants';

/**
 * Unlock the vault with master password
 */
export async function unlock(password: string): Promise<UnlockResponse> {
  
  const response = await apiCall<any>(
    'post',
    API_ENDPOINTS.UNLOCK,
    { password } as UnlockRequest
  );
  
  // Check if we got a token (API doesn't return success field)
  if (response.token) {
    // Store session
    const session: Session = {
      token: response.token,
      locked: false,
      expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
    };
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      await chrome.storage.session.set({
        [STORAGE_KEYS.SESSION]: session,
      });
    }
  }
  
  // Return with success flag
  return {
    success: !!response.token,
    token: response.token,
    message: response.message,
    vault_summary: response.vault_summary
  };
}

/**
 * Lock the vault
 */
export async function lock(): Promise<void> {
  try {
    await apiCall('post', API_ENDPOINTS.LOCK);
  } finally {
    // Clear session regardless of API response
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      await chrome.storage.session.remove(STORAGE_KEYS.SESSION);
    }
  }
}

/**
 * Get vault status
 */
export async function getStatus(): Promise<{
  locked: boolean;
  configured: boolean;
  version: string;
}> {
  return apiCall('get', API_ENDPOINTS.STATUS);
}

/**
 * Check if vault is unlocked
 */
export async function isUnlocked(): Promise<boolean> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.session) {
      return false;
    }
    
    const storage = await chrome.storage.session.get(STORAGE_KEYS.SESSION);
    const session = storage[STORAGE_KEYS.SESSION] as Session | undefined;
    
    if (!session || !session.token) {
      return false;
    }
    
    // Check if token expired
    if (session.expiresAt < Date.now()) {
      if (chrome.storage && chrome.storage.session) {
        await chrome.storage.session.remove(STORAGE_KEYS.SESSION);
      }
      return false;
    }
    
    // Verify with API
    const status = await getStatus();
    return !status.locked;
  } catch {
    return false;
  }
}

/**
 * Get current session
 */
export async function getSession(): Promise<Session | null> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.session) {
    return null;
  }
  
  const storage = await chrome.storage.session.get(STORAGE_KEYS.SESSION);
  const session = storage[STORAGE_KEYS.SESSION] as Session | undefined;
  
  if (!session || session.expiresAt < Date.now()) {
    return null;
  }
  
  return session;
}

/**
 * Refresh session token
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session) return false;
    
    // Call status endpoint to verify token
    const status = await getStatus();
    
    if (!status.locked) {
      // Update expiration
      session.expiresAt = Date.now() + (15 * 60 * 1000);
      if (chrome.storage && chrome.storage.session) {
        await chrome.storage.session.set({
          [STORAGE_KEYS.SESSION]: session,
        });
      }
      return true;
    }
    
    return false;
  } catch {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      await chrome.storage.session.remove(STORAGE_KEYS.SESSION);
    }
    return false;
  }
}