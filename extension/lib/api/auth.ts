import {apiCall} from './client';
import {Session, UnlockRequest, UnlockResponse} from '@/types';
import {API_ENDPOINTS, STORAGE_KEYS} from '@/utils/constants';

/**
 * Unlock the vault with master password
 */
export async function unlock(password: string): Promise<UnlockResponse> {

    const response = await apiCall<any>(
        'post',
        API_ENDPOINTS.UNLOCK,
        {password} as UnlockRequest
    );

    // Check if we got a token (API doesn't return success field)
    if (response.token) {
        // Store session (不再存储 expiresAt，锁定由前端定时器控制)
        const session: Session = {
            token: response.token,
            locked: false,
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

        // 不再检查前端 expiresAt，只验证后端 session
        // 锁定完全由前端定时器控制
        try {
            const status = await getStatus();
            return !status.locked;
        } catch (error: any) {
            // 如果后端返回 401，说明 session 已过期
            if (error.status === 401) {
                await chrome.storage.session.remove(STORAGE_KEYS.SESSION);
                return false;
            }
            // 其他错误（如网络问题）不应导致锁定
            throw error;
        }
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

    // 移除前端过期检查
    if (!session) {
        return null;
    }

    return session;
}

/**
 * Refresh session token
 * 注意：session 不再有 expiresAt，不需要更新过期时间
 */
export async function refreshSession(): Promise<boolean> {
    try {
        const session = await getSession();
        if (!session) return false;

        // Call status endpoint to verify token is still valid
        const status = await getStatus();

        // Session 仍然有效即可
        return !status.locked;
    } catch {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
            await chrome.storage.session.remove(STORAGE_KEYS.SESSION);
        }
        return false;
    }
}