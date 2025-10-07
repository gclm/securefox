import { apiCall } from './client';
import { 
  Item, 
  CreateEntryRequest, 
  UpdateEntryRequest,
  SearchEntriesRequest,
  TOTPResponse,
  Folder
} from '@/types';
import { API_ENDPOINTS } from '@/utils/constants';

/**
 * Get all entries
 */
export async function getEntries(): Promise<Item[]> {
  return apiCall<Item[]>('get', API_ENDPOINTS.ENTRIES);
}

/**
 * Search entries
 */
export async function searchEntries(params: SearchEntriesRequest): Promise<Item[]> {
  const queryParams = new URLSearchParams();
  
  if (params.query) queryParams.append('q', params.query);
  if (params.domain) queryParams.append('domain', params.domain);
  if (params.folder_id) queryParams.append('folder_id', params.folder_id);
  
  const url = `${API_ENDPOINTS.ENTRIES}${queryParams.toString() ? `?${queryParams}` : ''}`;
  return apiCall<Item[]>('get', url);
}

/**
 * Get entry by ID
 */
export async function getEntry(id: string): Promise<Item> {
  return apiCall<Item>('get', `${API_ENDPOINTS.ENTRIES}/${id}`);
}

/**
 * Create new entry
 */
export async function createEntry(entry: CreateEntryRequest): Promise<Item> {
  return apiCall<Item>('post', API_ENDPOINTS.ENTRIES, entry);
}

/**
 * Update entry
 */
export async function updateEntry(entry: UpdateEntryRequest): Promise<Item> {
  const { id, ...data } = entry;
  return apiCall<Item>('put', `${API_ENDPOINTS.ENTRIES}/${id}`, data);
}

/**
 * Delete entry
 */
export async function deleteEntry(id: string): Promise<void> {
  return apiCall<void>('delete', `${API_ENDPOINTS.ENTRIES}/${id}`);
}

/**
 * Get TOTP code for entry
 */
export async function getTOTP(entryId: string): Promise<TOTPResponse> {
  return apiCall<TOTPResponse>('get', `${API_ENDPOINTS.ENTRIES}/${entryId}/totp`);
}

// Note: Folder APIs are not implemented in the backend yet
// /**
//  * Get all folders
//  */
// export async function getFolders(): Promise<Folder[]> {
//   return apiCall<Folder[]>('get', API_ENDPOINTS.FOLDERS);
// }

// /**
//  * Create folder
//  */
// export async function createFolder(name: string): Promise<Folder> {
//   return apiCall<Folder>('post', API_ENDPOINTS.FOLDERS, { name });
// }

// /**
//  * Update folder
//  */
// export async function updateFolder(id: string, name: string): Promise<Folder> {
//   return apiCall<Folder>('put', `${API_ENDPOINTS.FOLDERS}/${id}`, { name });
// }

// /**
//  * Delete folder
//  */
// export async function deleteFolder(id: string): Promise<void> {
//   return apiCall<void>('delete', `${API_ENDPOINTS.FOLDERS}/${id}`);
// }

/**
 * Generate password
 */
export async function generatePassword(options?: {
  length?: number;
  include_uppercase?: boolean;
  include_lowercase?: boolean;
  include_numbers?: boolean;
  include_symbols?: boolean;
}): Promise<{ password: string }> {
  return apiCall<{ password: string }>('post', API_ENDPOINTS.GENERATE, options || {});
}

/**
 * Get entries for current tab domain
 */
export async function getEntriesForCurrentTab(): Promise<Item[]> {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return [];
    
    // Extract domain
    const url = new URL(tab.url);
    const domain = url.hostname;
    
    // Search entries for domain
    return searchEntries({ domain });
  } catch {
    return [];
  }
}

/**
 * Quick fill credentials for current tab
 */
export async function quickFillCredentials(entryId: string): Promise<void> {
  const entry = await getEntry(entryId);
  
  if (!entry.login) {
    throw new Error('Entry does not contain login credentials');
  }
  
  // Send message to content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL_CREDENTIALS',
      data: {
        username: entry.login.username || '',
        password: entry.login.password || '',
      },
    });
  }
}