import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '@/utils/constants';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Check if chrome.storage is available
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
        // Get token from storage
        const storage = await chrome.storage.session.get(STORAGE_KEYS.SESSION);
        const session = storage[STORAGE_KEYS.SESSION];
        
        if (session?.token) {
          config.headers.Authorization = `Bearer ${session.token}`;
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
          type: 'VAULT_LOCKED',
        }).catch(() => {
          // Ignore errors if no listener
        });
      }
    }
    
    // Format error message
    const message = error.response?.data?.message || 
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
    const response = await apiClient[method](url, data, config);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}
