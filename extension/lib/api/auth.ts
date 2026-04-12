import {apiCall} from './client';
import {Session, UnlockRequest, UnlockResponse, StatusResponse} from '@/types';
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
        // Store session (使用 chrome.storage.local 以跨浏览器重启持久化)
        const session: Session = {
            token: response.token,
            locked: false,
        };

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({
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
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.remove(STORAGE_KEYS.SESSION);
        }
    }
}

/**
 * Clear the local session (without calling backend lock)
 */
export async function clearSession(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(STORAGE_KEYS.SESSION);
    }
}

/**
 * Get vault status
 */
export async function getStatus(): Promise<StatusResponse> {
    return apiCall<StatusResponse>('get', API_ENDPOINTS.STATUS);
}

/**
 * Ping the backend (authenticated, triggers session refresh)
 */
export async function ping(): Promise<boolean> {
    try {
        const response = await apiCall<{ ok: boolean }>('get', API_ENDPOINTS.PING);
        return response.ok === true;
    } catch {
        return false;
    }
}

/**
 * Check if vault is unlocked
 */
export async function isUnlocked(): Promise<boolean> {
    try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
            return false;
        }

        const storage = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
        const session = storage[STORAGE_KEYS.SESSION] as Session | undefined;

        if (!session || !session.token) {
            return false;
        }

        try {
            const status = await getStatus();
            return !status.locked;
        } catch (error: any) {
            // 如果后端返回 401，说明 session 已过期
            if (error.status === 401) {
                await chrome.storage.local.remove(STORAGE_KEYS.SESSION);
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
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return null;
    }

    const storage = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
    const session = storage[STORAGE_KEYS.SESSION] as Session | undefined;

    if (!session) {
        return null;
    }

    return session;
}

/**
 * Refresh session token — 调用认证接口刷新后端 session
 * 注意：网络错误不清除 session（API 服务可能只是暂时不可用）
 */
export async function refreshSession(): Promise<boolean> {
    try {
        const session = await getSession();
        if (!session) return false;

        // 调用认证接口（ping），后端会自动刷新 session
        const ok = await ping();
        if (!ok) {
            // ping 返回 false 说明后端不可达，不清除 session
            return false;
        }

        // 检查 vault 是否仍然解锁
        const status = await getStatus();
        return !status.locked;
    } catch {
        // 网络错误不清除 session
        return false;
    }
}