import { STORAGE_KEYS, SESSION_CONFIG, type AutoLockOption } from '@/utils/constants';

/**
 * Settings stored in chrome.storage.local
 */
export interface UserSettings {
  autoLockMinutes: AutoLockOption;
  defaultUriMatchType?: number; // UriMatchType enum value
  theme?: 'light' | 'dark';
  notificationsEnabled?: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  autoLockMinutes: SESSION_CONFIG.AUTO_LOCK_MINUTES as AutoLockOption,
  defaultUriMatchType: 0, // Domain by default
  theme: 'light',
  notificationsEnabled: true,
};

/**
 * Get user settings from storage
 */
export async function getUserSettings(): Promise<UserSettings> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = result[STORAGE_KEYS.SETTINGS] as Partial<UserSettings> | undefined;
    
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
    };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save user settings to storage
 */
export async function saveUserSettings(settings: Partial<UserSettings>): Promise<void> {
  try {
    const current = await getUserSettings();
    const updated = { ...current, ...settings };
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: updated,
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

/**
 * Get auto-lock minutes from storage
 */
export async function getAutoLockMinutes(): Promise<number> {
  const settings = await getUserSettings();
  return settings.autoLockMinutes;
}

/**
 * Save auto-lock minutes to storage
 */
export async function saveAutoLockMinutes(minutes: AutoLockOption): Promise<void> {
  await saveUserSettings({ autoLockMinutes: minutes });
}

/**
 * Get default URI match type from storage
 */
export async function getDefaultUriMatchType(): Promise<number> {
  const settings = await getUserSettings();
  return settings.defaultUriMatchType || 0;
}

/**
 * Save default URI match type to storage
 */
export async function saveDefaultUriMatchType(matchType: number): Promise<void> {
  await saveUserSettings({ defaultUriMatchType: matchType });
}
