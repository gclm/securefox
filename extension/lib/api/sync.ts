import {apiCall} from './client';
import {API_ENDPOINTS} from '@/utils/constants';
import type {SyncStatusResponse, SyncResponse, CloneResponse} from '@/types';

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<SyncStatusResponse> {
    return apiCall<SyncStatusResponse>('get', API_ENDPOINTS.SYNC_STATUS);
}

/**
 * Push local changes to remote (smart sync)
 */
export async function syncPush(): Promise<SyncResponse> {
    return apiCall<SyncResponse>('post', API_ENDPOINTS.SYNC_PUSH);
}

/**
 * Pull remote changes
 */
export async function syncPull(): Promise<SyncResponse> {
    return apiCall<SyncResponse>('post', API_ENDPOINTS.SYNC_PULL);
}

/**
 * Clone a remote vault (new computer setup)
 */
export async function syncClone(remoteUrl: string): Promise<CloneResponse> {
    return apiCall<CloneResponse>('post', API_ENDPOINTS.SYNC_CLONE, {remote_url: remoteUrl});
}
