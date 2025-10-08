import { MESSAGE_TYPES } from '@/utils/constants';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('SecureFox content script loaded');

    // Track current focused element
    let currentFocusedElement: HTMLInputElement | null = null;
    let fillFloater: HTMLDivElement | null = null;

    // Detect password fields
    const detectPasswordFields = (): NodeListOf<HTMLInputElement> => {
      return document.querySelectorAll<HTMLInputElement>(
        'input[type="password"]:not([data-securefox-processed])'
      );
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

    // Create fill floater UI
    const createFillFloater = (element: HTMLInputElement) => {
      // Remove existing floater
      removeFillFloater();

      // Create floater element
      const floater = document.createElement('div');
      floater.id = 'securefox-fill-floater';
      floater.style.cssText = `
        position: absolute;
        z-index: 999999;
        background: white;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        padding: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #333;
        transition: all 0.2s ease;
      `;

      // Add icon and text
      floater.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 10V7M8 4H8.01M14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5C11.5899 1.5 14.5 4.41015 14.5 8Z" 
                stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>使用 SecureFox 填充</span>
      `;

      // Position floater
      const rect = element.getBoundingClientRect();
      floater.style.left = `${rect.left + window.scrollX}px`;
      floater.style.top = `${rect.top + window.scrollY - 36}px`;

      // Add hover effect
      floater.addEventListener('mouseenter', () => {
        floater!.style.background = '#f5f5f5';
      });

      floater.addEventListener('mouseleave', () => {
        floater!.style.background = 'white';
      });

      // Handle click
      floater.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Request credentials from background
        const response = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.REQUEST_CREDENTIALS,
          domain: window.location.hostname,
        });

        if (response.entries && response.entries.length > 0) {
          fillCredentials(response.entries[0]);
        } else {
          // Show no credentials message
          showNotification('没有为此网站保存的凭据');
        }
      });

      document.body.appendChild(floater);
      fillFloater = floater;
    };

    // Remove fill floater
    const removeFillFloater = () => {
      if (fillFloater) {
        fillFloater.remove();
        fillFloater = null;
      }
    };

    // Fill credentials
    const fillCredentials = (entry: any) => {
      if (!currentFocusedElement) return;

      const passwordField = currentFocusedElement.type === 'password' 
        ? currentFocusedElement 
        : document.querySelector<HTMLInputElement>('input[type="password"]:not([disabled])');
      
      if (!passwordField) return;

      // Fill password
      if (entry.login?.password) {
        passwordField.value = entry.login.password;
        passwordField.dispatchEvent(new Event('input', { bubbles: true }));
        passwordField.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Fill username
      if (entry.login?.username) {
        const usernameField = detectUsernameField(passwordField);
        if (usernameField) {
          usernameField.value = entry.login.username;
          usernameField.dispatchEvent(new Event('input', { bubbles: true }));
          usernameField.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      removeFillFloater();
      showNotification('凭据填充成功');

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

    // Show notification
    const showNotification = (message: string) => {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: #333;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        animation: slideIn 0.3s ease;
      `;
      notification.textContent = message;

      // Add animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);

      document.body.appendChild(notification);

      setTimeout(() => {
        notification.remove();
      }, 3000);
    };

    // Handle focus events
    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLInputElement;
      
      if (target.type === 'password' || target.type === 'email' || target.type === 'text') {
        currentFocusedElement = target;
        
        // Show floater for password fields
        if (target.type === 'password' && !target.value) {
          createFillFloater(target);
        }
      }
    };

    const handleBlur = (event: FocusEvent) => {
      // Delay removal to allow click on floater
      setTimeout(() => {
        if (!fillFloater?.matches(':hover')) {
          removeFillFloater();
        }
      }, 200);
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

    // Initialize
    const initialize = () => {
      // Mark existing password fields
      const passwordFields = detectPasswordFields();
      passwordFields.forEach(field => {
        field.setAttribute('data-securefox-processed', 'true');
      });

      // Add event listeners
      document.addEventListener('focusin', handleFocus, true);
      document.addEventListener('focusout', handleBlur, true);
      
      // Initial badge update
      updateBadge();
    };

    // Watch for new password fields (SPA support)
    const observer = new MutationObserver(() => {
      const newPasswordFields = detectPasswordFields();
      newPasswordFields.forEach(field => {
        field.setAttribute('data-securefox-processed', 'true');
      });
      
      // Update badge when new password fields appear
      if (newPasswordFields.length > 0) {
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
