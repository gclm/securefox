// API Configuration
export const API_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'http://localhost:8787'
    : 'http://localhost:8787';

export const API_ENDPOINTS = {
    UNLOCK: '/api/unlock',
    LOCK: '/api/lock',
    STATUS: '/api/status',
    VERSION: '/api/version',
    ENTRIES: '/api/items',
    FOLDERS: '/api/folders',
    GENERATE: '/api/generate/password',
    TOTP: '/api/totp',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
    SESSION: 'securefox_session',
    SETTINGS: 'securefox_settings',
    RECENT_ITEMS: 'securefox_recent',
} as const;

// Session Configuration
export const SESSION_CONFIG = {
    AUTO_LOCK_MINUTES: 15,
    TOKEN_REFRESH_MINUTES: 10,
    MAX_LOGIN_ATTEMPTS: 5,
} as const;

// Auto-lock options (in minutes)
// -1 = lock on browser close, 15 = 15 minutes, 60 = 1 hour, 360 = 6 hours
export const AUTO_LOCK_OPTIONS = [15, 60, 360, -1] as const;
export type AutoLockOption = typeof AUTO_LOCK_OPTIONS[number];

// UI Configuration
export const UI_CONFIG = {
    NOTIFICATION_DURATION: 3000,
    DEBOUNCE_DELAY: 300,
    CLIPBOARD_CLEAR_SECONDS: 30,
    MAX_RECENT_ITEMS: 10,
} as const;

// Password Generator Defaults
export const PASSWORD_DEFAULTS = {
    LENGTH: 16,
    USE_UPPERCASE: true,
    USE_LOWERCASE: true,
    USE_NUMBERS: true,
    USE_SYMBOLS: true,
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
} as const;

// Message Types for Extension Communication
export const MESSAGE_TYPES = {
    // From content script to background
    REQUEST_CREDENTIALS: 'REQUEST_CREDENTIALS',
    CHECK_MATCHING_COUNT: 'CHECK_MATCHING_COUNT', // Check if matching entries exist (works even when locked)
    FILL_CREDENTIALS: 'FILL_CREDENTIALS',
    SAVE_CREDENTIALS: 'SAVE_CREDENTIALS',

    // From popup to background
    UNLOCK_VAULT: 'UNLOCK_VAULT',
    LOCK_VAULT: 'LOCK_VAULT',
    GET_STATUS: 'GET_STATUS',
    HEARTBEAT: 'HEARTBEAT', // Keep-alive signal to reset auto-lock timer

    // From background to content/popup
    VAULT_LOCKED: 'VAULT_LOCKED',
    VAULT_UNLOCKED: 'VAULT_UNLOCKED',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
} as const;

// Regex Patterns
export const PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
    TOTP_SECRET: /^[A-Z2-7]+=*$/i,
} as const;