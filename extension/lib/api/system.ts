import { apiCall } from './client';
import { API_ENDPOINTS } from '@/utils/constants';

/**
 * Version information from API
 */
export interface VersionResponse {
  version: string;
  build_time?: string;
  git_commit?: string;
}

/**
 * Get version information from API
 */
export async function getVersion(): Promise<VersionResponse> {
  return apiCall<VersionResponse>('get', API_ENDPOINTS.VERSION);
}
