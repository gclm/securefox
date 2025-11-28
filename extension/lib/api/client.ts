import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { API_BASE_URL, STORAGE_KEYS, MESSAGE_TYPES, API_ENDPOINTS } from '@/utils/constants';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Endpoints that don't require authentication
const PUBLIC_ENDPOINTS: string[] = [
  API_ENDPOINTS.UNLOCK,
  API_ENDPOINTS.STATUS,
  API_ENDPOINTS.VERSION,
];

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Check if chrome.runtime is available to send heartbeat
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          // Send heartbeat to background to reset auto-lock timer
          // We don't await this because we don't want to slow down the request
          chrome.runtime.sendMessage({
              type: MESSAGE_TYPES.HEARTBEAT
          }).catch(() => {
              // Ignore errors (e.g. if background script is not ready)
          });
      }

      // Check if chrome.storage is available
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
        // Get token from storage
        const storage = await chrome.storage.session.get(STORAGE_KEYS.SESSION);
        const session = storage[STORAGE_KEYS.SESSION];
        
        if (session?.token) {
          config.headers.Authorization = `Bearer ${session.token}`;
          console.log('[API] Added auth token to request:', config.url);
        } else {
          // Only warn if the endpoint is not public
          // Note: config.url might be partial path or full URL depending on usage
          const isPublic = PUBLIC_ENDPOINTS.some(endpoint => 
            config.url && (config.url === endpoint || config.url.endsWith(endpoint))
          );
          
          if (!isPublic) {
            console.warn('[API] No session token found for request:', config.url);
          }
        }
      }
    } catch (error) {
      console.error('Error accessing chrome.storage:', error);
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear session on unauthorized
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
        await chrome.storage.session.remove(STORAGE_KEYS.SESSION);
        
        // Send message to notify vault is locked
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.VAULT_LOCKED,
        }).catch(() => {
          // Ignore errors if no listener
        });
      }
    }
    
    // Format error message
    const errorData = error.response?.data as { message?: string } | undefined;
    const message = errorData?.message || 
                   error.message || 
                   'An unexpected error occurred';
    
    return Promise.reject({
      message,
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);

export default apiClient;

// Type-safe API call wrapper
export async function apiCall<T>(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: any,
  config?: any
): Promise<T> {
  try {
    let response;
    if (method === 'get' || method === 'delete') {
      // GET and DELETE don't have a data parameter
      response = await apiClient[method](url, config);
    } else {
      // POST and PUT have data parameter
      response = await apiClient[method](url, data, config);
    }
    return response.data;
  } catch (error: any) {
    throw error;
  }
}
