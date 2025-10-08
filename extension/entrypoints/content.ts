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

    // Track submitted credentials for save prompt
    let pendingSaveCredentials: { username: string; password: string; url: string } | null = null;

    // Monitor form submissions to prompt password save
    const handleFormSubmit = async (event: Event) => {
      const target = event.target as HTMLElement;
      
      // Try to find the form
      let form: HTMLFormElement | null = null;
      if (target instanceof HTMLFormElement) {
        form = target;
      } else {
        form = target.closest('form');
      }
      
      if (!form) {
        console.log('SecureFox: No form found on submit');
        return;
      }

      console.log('SecureFox: Form submitted, checking for credentials...');

      // Find password field in the form
      const passwordField = form.querySelector<HTMLInputElement>('input[type="password"]');
      if (!passwordField) {
        console.log('SecureFox: No password field found in form');
        return;
      }
      
      if (!passwordField.value) {
        console.log('SecureFox: Password field is empty');
        return;
      }

      // Find username field
      const usernameField = detectUsernameField(passwordField);
      const username = usernameField?.value || '';
      const password = passwordField.value;

      console.log('SecureFox: Found credentials', { username, hasPassword: !!password });

      if (!username) {
        console.log('SecureFox: Username field is empty');
        return;
      }
      
      if (!password) {
        console.log('SecureFox: Password is empty');
        return;
      }

      // Store credentials for potential save
      pendingSaveCredentials = {
        username,
        password,
        url: window.location.href
      };

      console.log('SecureFox: Waiting to prompt save...');

      // Wait a moment to see if login succeeds (form doesn't reload/redirect means likely success)
      setTimeout(async () => {
        if (pendingSaveCredentials) {
          console.log('SecureFox: Prompting to save password');
          await promptSavePassword(pendingSaveCredentials);
        }
      }, 500);
    };

    // Prompt user to save password
    const promptSavePassword = async (credentials: { username: string; password: string; url: string }) => {
      // Backend will handle duplicate detection, just show the prompt
      showSavePrompt(credentials, false);
    };

    // Show save/update password prompt
    const showSavePrompt = (credentials: { username: string; password: string; url: string }, isUpdate: boolean) => {
      // Remove any existing prompt
      const existingPrompt = document.querySelector('[data-securefox-save-prompt]');
      if (existingPrompt) {
        existingPrompt.remove();
      }

      // Create save prompt
      const prompt = document.createElement('div');
      prompt.setAttribute('data-securefox-save-prompt', 'true');
      prompt.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 999999;
        background: white;
        border: 1px solid #e5e5e5;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        min-width: 320px;
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideInRight 0.3s ease;
      `;

      const hostname = new URL(credentials.url).hostname;

      prompt.innerHTML = `
        <style>
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        </style>
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
          <div style="flex-shrink: 0; width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9.243 2 7 4.243 7 7V10H6C4.895 10 4 10.895 4 12V20C4 21.105 4.895 22 6 22H18C19.105 22 20 21.105 20 20V12C20 10.895 19.105 10 18 10H17V7C17 4.243 14.757 2 12 2ZM9 7C9 5.346 10.346 4 12 4C13.654 4 15 5.346 15 7V10H9V7Z" fill="white"/>
            </svg>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #1e293b; font-size: 15px; margin-bottom: 4px;">
              ${isUpdate ? '更新密码？' : '保存密码？'}
            </div>
            <div style="color: #64748b; font-size: 13px; word-break: break-all;">
              ${hostname}
            </div>
            <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">
              ${credentials.username}
            </div>
          </div>
          <button id="sf-close-prompt" style="flex-shrink: 0; width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #94a3b8; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="sf-save-btn" style="flex: 1; padding: 10px 16px; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
            ${isUpdate ? '更新' : '保存'}
          </button>
          <button id="sf-never-btn" style="flex: 1; padding: 10px 16px; border: 1px solid #e5e5e5; background: white; color: #64748b; font-size: 14px; font-weight: 500; border-radius: 8px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            从不
          </button>
        </div>
      `;

      document.body.appendChild(prompt);

      // Handle save button
      prompt.querySelector('#sf-save-btn')?.addEventListener('click', async () => {
        try {
          const siteName = hostname.split('.').slice(-2, -1)[0] || hostname;
          
          // Import match type helper
          const { getRecommendedMatchType } = await import('@/utils/helpers');
          const recommendedMatch = getRecommendedMatchType(credentials.url);
          
          const result = await chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.SAVE_CREDENTIALS,
            data: {
              name: siteName.charAt(0).toUpperCase() + siteName.slice(1),
              type: 1, // Login type
              login: {
                username: credentials.username,
                password: credentials.password,
                uris: [{ 
                  uri: credentials.url,
                  match: recommendedMatch  // Set recommended match type
                }]
              }
            }
          });

          if (result.success) {
            showNotification(isUpdate ? '密码已更新' : '密码已保存', 'success');
            prompt.remove();
            pendingSaveCredentials = null;
          } else {
            showNotification('保存失败', 'error');
          }
        } catch (error) {
          console.error('Failed to save credential:', error);
          showNotification('保存失败', 'error');
        }
      });

      // Handle never button
      prompt.querySelector('#sf-never-btn')?.addEventListener('click', () => {
        // TODO: Add to never save list
        prompt.remove();
        pendingSaveCredentials = null;
      });

      // Handle close button
      prompt.querySelector('#sf-close-prompt')?.addEventListener('click', () => {
        prompt.remove();
        pendingSaveCredentials = null;
      });

      // Auto dismiss after 30 seconds
      setTimeout(() => {
        if (prompt.parentNode) {
          prompt.remove();
          pendingSaveCredentials = null;
        }
      }, 30000);
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
      document.addEventListener('submit', handleFormSubmit, true);
      
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
