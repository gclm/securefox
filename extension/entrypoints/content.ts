import { MESSAGE_TYPES } from '@/utils/constants';
import { InlineAutofillIcon } from './content/InlineAutofillIcon';
import { CredentialMenu } from './content/CredentialMenu';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('SecureFox content script loaded - Inline Autofill System');

    // Track current focused element and menu state
    let currentFocusedElement: HTMLInputElement | null = null;
    let currentMenu: CredentialMenu | null = null;
    const fieldIconMap = new WeakMap<HTMLInputElement, InlineAutofillIcon>();

    // Detect login form fields (only username fields for icon display)
    const detectLoginFields = (): HTMLInputElement[] => {
      const fields: HTMLInputElement[] = [];
      
      // Find all password fields
      const passwordFields = document.querySelectorAll<HTMLInputElement>(
        'input[type="password"]:not([data-securefox-processed])'
      );
      
      passwordFields.forEach(passwordField => {
        // Mark password field as processed (no icon needed)
        passwordField.setAttribute('data-securefox-processed', 'true');
        
        // Find associated username field
        const usernameField = detectUsernameField(passwordField);
        
        // Only add username field to list (for icon display)
        if (usernameField && !usernameField.hasAttribute('data-securefox-processed')) {
          fields.push(usernameField);
        }
      });
      
      return fields;
    };

    // Detect username fields (near password fields)
    const detectUsernameField = (passwordField: HTMLInputElement): HTMLInputElement | null => {
      const form = passwordField.closest('form');
      const searchScope = form || document;
      
      // Common username field patterns
      const usernameSelectors = [
        'input[type="email"]',
        'input[type="text"][name*="user" i]',
        'input[type="text"][name*="email" i]',
        'input[type="text"][name*="login" i]',
        'input[type="text"][autocomplete="username"]',
        'input[type="text"][id*="user" i]',
        'input[type="text"][id*="email" i]',
      ];

      for (const selector of usernameSelectors) {
        const field = searchScope.querySelector<HTMLInputElement>(selector);
        if (field && !field.disabled && field !== passwordField) {
          // Check if field appears before password field
          const passwordRect = passwordField.getBoundingClientRect();
          const fieldRect = field.getBoundingClientRect();
          
          if (fieldRect.top <= passwordRect.top) {
            return field;
          }
        }
      }

      // Fallback: find the closest text input before the password field
      const allInputs = Array.from(searchScope.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="email"]'));
      const passwordIndex = Array.from(searchScope.querySelectorAll('input')).indexOf(passwordField);
      
      for (let i = passwordIndex - 1; i >= 0; i--) {
        const input = searchScope.querySelectorAll('input')[i] as HTMLInputElement;
        if ((input.type === 'text' || input.type === 'email') && !input.disabled) {
          return input;
        }
      }

      return null;
    };

    // Create inline autofill icon for a field
    const createInlineIcon = (element: HTMLInputElement) => {
      // Check if icon already exists
      if (fieldIconMap.has(element)) {
        return;
      }
      
      // Create icon with click handler
      const icon = new InlineAutofillIcon(element, async () => {
        await showCredentialMenu(element);
      });
      
      // Store reference
      fieldIconMap.set(element, icon);
      
      // Show icon
      icon.show();
    };
    
    // Show credential selection menu
    const showCredentialMenu = async (element: HTMLInputElement) => {
      try {
        // Close existing menu
        if (currentMenu) {
          currentMenu.destroy();
          currentMenu = null;
        }
        
        // Request credentials from background
        const response = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.REQUEST_CREDENTIALS,
          domain: window.location.hostname,
        });
        
        if (!response || !response.entries) {
          showNotification('无法获取凭据');
          return;
        }
        
        // Create and show menu
        currentMenu = new CredentialMenu(
          response.entries,
          element,
          (credential) => {
            fillCredentials(credential);
          }
        );
        
        currentMenu.show();
      } catch (error) {
        console.error('Failed to show credential menu:', error);
        showNotification('获取凭据失败');
      }
    };

    // Fill credentials with enhanced animation
    const fillCredentials = (entry: any) => {
      const passwordField = document.querySelector<HTMLInputElement>('input[type="password"]:not([disabled])');
      
      if (!passwordField) {
        showNotification('未找到密码输入框', 'warning');
        return;
      }

      // Find username field
      const usernameField = detectUsernameField(passwordField);
      
      // Animate and fill fields
      const fillField = (field: HTMLInputElement, value: string) => {
        // Add flash animation
        field.style.transition = 'background-color 0.3s ease';
        field.style.backgroundColor = '#dbeafe';
        
        // Fill value
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Remove flash after animation
        setTimeout(() => {
          field.style.backgroundColor = '';
          setTimeout(() => {
            field.style.transition = '';
          }, 300);
        }, 300);
      };

      // Fill username
      if (entry.login?.username && usernameField) {
        fillField(usernameField, entry.login.username);
      }

      // Fill password
      if (entry.login?.password) {
        setTimeout(() => {
          fillField(passwordField, entry.login.password);
        }, 100);
      }

      // Show success notification
      showNotification(`已填充 ${entry.name}`, 'success');

      // Check for TOTP and copy to clipboard if present
      if (entry.login?.totp) {
        requestTOTP(entry.id);
      }
    };

    // Request and handle TOTP
    const requestTOTP = async (entryId: string) => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_TOTP',
          entryId,
        });

        if (response.code) {
          // Try to find and fill TOTP field
          const totpSelectors = [
            'input[name*="totp" i]',
            'input[name*="2fa" i]',
            'input[name*="code" i]',
            'input[name*="verification" i]',
            'input[inputmode="numeric"]',
            'input[maxlength="6"]',
          ];

          let filled = false;
          for (const selector of totpSelectors) {
            const field = document.querySelector<HTMLInputElement>(selector);
            if (field && !field.disabled && field.value === '') {
              field.value = response.code;
              field.dispatchEvent(new Event('input', { bubbles: true }));
              field.dispatchEvent(new Event('change', { bubbles: true }));
              filled = true;
              break;
            }
          }

          if (!filled) {
            // Copy to clipboard if no field found
            navigator.clipboard.writeText(response.code);
            showNotification(`双因素验证码已复制: ${response.code}`);
          }
        }
      } catch (error) {
        console.error('Failed to get TOTP:', error);
      }
    };

    // Show enhanced notification
    const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
      const notification = document.createElement('div');
      
      // Color schemes for different types
      const colors = {
        success: { bg: '#10b981', icon: '✓' },
        error: { bg: '#ef4444', icon: '✕' },
        warning: { bg: '#f59e0b', icon: '⚠' },
        info: { bg: '#3b82f6', icon: 'ℹ' }
      };
      
      const color = colors[type];
      
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: ${color.bg};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideIn 0.3s ease;
        max-width: 320px;
      `;
      
      notification.innerHTML = `
        <span style="font-size: 16px; font-weight: 700;">${color.icon}</span>
        <span>${message}</span>
      `;

      // Add animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);

      document.body.appendChild(notification);

      // Auto remove
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, 3000);
    };

    // Handle focus events
    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLInputElement;
      
      // Track focused element
      if (target.type === 'password' || target.type === 'email' || target.type === 'text') {
        currentFocusedElement = target;
      }
    };

    const handleBlur = (event: FocusEvent) => {
      // Clear focused element
      currentFocusedElement = null;
    };

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case MESSAGE_TYPES.FILL_CREDENTIALS:
          fillCredentials({ login: message.data });
          sendResponse({ success: true });
          break;

        case 'INSERT_GENERATED_PASSWORD':
          if (currentFocusedElement) {
            currentFocusedElement.value = message.data.password;
            currentFocusedElement.dispatchEvent(new Event('input', { bubbles: true }));
            currentFocusedElement.dispatchEvent(new Event('change', { bubbles: true }));
            showNotification('密码已生成并插入');
          }
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
      return true;
    });

    // Check for login forms and update badge
    const updateBadge = async () => {
      const passwordFields = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
      
      if (passwordFields.length > 0) {
        // Page has login forms, request badge update
        chrome.runtime.sendMessage({
          type: 'UPDATE_BADGE',
          domain: window.location.hostname,
        }).catch(() => {
          // Ignore if background is not ready
        });
      }
    };

    // Keyboard shortcut handler (Ctrl+Shift+L)
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      // Ctrl+Shift+L or Cmd+Shift+L (Mac)
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        
        // If an input field is focused, show menu for it
        if (currentFocusedElement) {
          showCredentialMenu(currentFocusedElement);
          return;
        }
        
        // Otherwise, find the first login field and show menu
        const loginFields = detectLoginFields();
        if (loginFields.length > 0) {
          const firstField = loginFields.find(f => f.type === 'password') || loginFields[0];
          firstField.focus();
          showCredentialMenu(firstField);
        } else {
          showNotification('未在此页面找到登录表单');
        }
      }
    };

    // Initialize inline autofill system
    const initialize = () => {
      // Detect and process login fields
      const loginFields = detectLoginFields();
      
      loginFields.forEach(field => {
        // Mark as processed
        field.setAttribute('data-securefox-processed', 'true');
        
        // Create inline icon
        createInlineIcon(field);
      });

      // Add event listeners
      document.addEventListener('focusin', handleFocus, true);
      document.addEventListener('focusout', handleBlur, true);
      document.addEventListener('keydown', handleKeyboardShortcut, true);
      
      // Initial badge update
      updateBadge();
    };

    // Watch for new login fields (SPA support)
    const observer = new MutationObserver(() => {
      const newFields = detectLoginFields();
      
      newFields.forEach(field => {
        field.setAttribute('data-securefox-processed', 'true');
        createInlineIcon(field);
      });
      
      // Update badge when new fields appear
      if (newFields.length > 0) {
        updateBadge();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      initialize();
    }
  },
});
