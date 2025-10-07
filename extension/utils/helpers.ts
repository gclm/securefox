import { Item, ItemType, UriMatchType } from '@/types';

/**
 * Get domain from URL
 */
export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * Match URL against item URIs
 */
export function matchUri(itemUri: string, currentUri: string, matchType: UriMatchType = UriMatchType.Domain): boolean {
  switch (matchType) {
    case UriMatchType.Domain:
      return getDomainFromUrl(itemUri) === getDomainFromUrl(currentUri);
    case UriMatchType.Host:
      return new URL(itemUri).host === new URL(currentUri).host;
    case UriMatchType.StartsWith:
      return currentUri.startsWith(itemUri);
    case UriMatchType.Exact:
      return itemUri === currentUri;
    case UriMatchType.RegularExpression:
      try {
        return new RegExp(itemUri).test(currentUri);
      } catch {
        return false;
      }
    case UriMatchType.Never:
      return false;
    default:
      return false;
  }
}

/**
 * Find matching items for current URL
 */
export function findMatchingItems(items: Item[], url: string): Item[] {
  return items.filter(item => {
    if (item.type !== ItemType.Login || !item.login?.uris) {
      return false;
    }
    
    return item.login.uris.some(uri => 
      matchUri(uri.uri, url, uri.match ?? UriMatchType.Domain)
    );
  });
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Clear clipboard after delay
 */
export function clearClipboardAfterDelay(delay: number = 30000): void {
  setTimeout(async () => {
    try {
      await navigator.clipboard.writeText('');
    } catch {
      // Ignore errors
    }
  }, delay);
}

/**
 * Generate random password
 */
export function generatePassword(options: {
  length: number;
  useUppercase: boolean;
  useLowercase: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
}): string {
  let charset = '';
  
  if (options.useLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (options.useUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (options.useNumbers) charset += '0123456789';
  if (options.useSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  if (!charset) charset = 'abcdefghijklmnopqrstuvwxyz';
  
  let password = '';
  const array = new Uint32Array(options.length);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < options.length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  return password;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('default', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Get item icon based on type
 */
export function getItemIcon(item: Item): string {
  switch (item.type) {
    case ItemType.Login:
      return 'key';
    case ItemType.Card:
      return 'credit-card';
    case ItemType.Identity:
      return 'user';
    case ItemType.SecureNote:
      return 'file-text';
    default:
      return 'file';
  }
}

/**
 * Get masked card number
 */
export function getMaskedCardNumber(cardNumber: string): string {
  if (!cardNumber || cardNumber.length < 4) return '****';
  return `**** **** **** ${cardNumber.slice(-4)}`;
}

/**
 * Validate master password strength
 */
export function validatePasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  if (password.length < 8) {
    feedback.push('Password should be at least 8 characters');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }
  
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Add lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Add uppercase letters');
  
  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Add numbers');
  
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push('Add special characters');
  
  return { score: Math.min(score, 5), feedback };
}