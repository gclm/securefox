import {MESSAGE_TYPES} from '@/utils/constants';
import {InlineAutofillIcon} from './content/InlineAutofillIcon';
import {CredentialMenu} from './content/CredentialMenu';
import {CardMenu} from './content/CardMenu';
import {IdentityMenu} from './content/IdentityMenu';
import {ItemType} from '@/types';

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_idle',
    main() {
        console.log('SecureFox content script loaded - Inline Autofill System');

        // Track current focused element and menu state
        let currentFocusedElement: HTMLInputElement | null = null;
        let currentMenu: CredentialMenu | null = null;
        let currentCardMenu: CardMenu | null = null;
        let currentIdentityMenu: IdentityMenu | null = null;
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

        // Detect credit card fields
        const detectCardFields = (): Array<{field: HTMLInputElement; type: 'number' | 'cvv' | 'exp'}> => {
            const fields: Array<{field: HTMLInputElement; type: 'number' | 'cvv' | 'exp'}> = [];

            // Credit card number field patterns
            const cardNumberSelectors = [
                'input[type="text"][name*="card" i][name*="number" i]',
                'input[type="text"][name*="cc" i][name*="number" i]',
                'input[type="text"][name*="credit" i][name*="number" i]',
                'input[type="text"][autocomplete="cc-number"]',
                'input[type="text"][placeholder*="card" i][placeholder*="number" i]',
            ];

            // CVV/CVC field patterns (include password type)
            const cvvSelectors = [
                'input[type="text"][name*="cvv" i]',
                'input[type="text"][name*="cvc" i]',
                'input[type="text"][name*="security" i][name*="code" i]',
                'input[type="password"][name*="cvv" i]',
                'input[type="password"][name*="cvc" i]',
                'input[type="text"][autocomplete="cc-csc"]',
                'input[type="password"][autocomplete="cc-csc"]',
            ];

            // Expiration field patterns
            const expSelectors = [
                'input[type="text"][name*="exp" i]',
                'input[type="text"][name*="expiry" i]',
                'input[type="month"][name*="exp" i]',
                'input[type="text"][placeholder*="exp" i]',
                'input[type="text"][autocomplete="cc-exp"]',
            ];

            // Detect CVV fields first and mark them to prevent login field detection
            // This is important because CVV fields are often type="password"
            cvvSelectors.forEach(selector => {
                const element = document.querySelector<HTMLInputElement>(selector);
                if (element && !element.disabled && !element.hasAttribute('data-securefox-processed')) {
                    // Mark CVV fields as processed to prevent login detection
                    element.setAttribute('data-securefox-processed', 'true');
                    fields.push({field: element, type: 'cvv'});
                }
            });

            // Detect card number fields
            cardNumberSelectors.forEach(selector => {
                const field = document.querySelector<HTMLInputElement>(selector);
                if (field && !field.disabled && !field.hasAttribute('data-securefox-processed')) {
                    fields.push({field, type: 'number'});
                    field.setAttribute('data-securefox-processed', 'true');
                }
            });

            // Detect expiration fields
            expSelectors.forEach(selector => {
                const field = document.querySelector<HTMLInputElement>(selector);
                if (field && !field.disabled && !field.hasAttribute('data-securefox-processed')) {
                    fields.push({field, type: 'exp'});
                    field.setAttribute('data-securefox-processed', 'true');
                }
            });

            return fields;
        };

        // Detect identity fields
        const detectIdentityFields = (): Array<{field: HTMLInputElement; fieldType: string}> => {
            const fields: Array<{field: HTMLInputElement; fieldType: string}> = [];

            // Name field patterns
            const nameSelectors = [
                'input[type="text"][name*="first" i][name*="name" i]',
                'input[type="text"][name*="last" i][name*="name" i]',
                'input[type="text"][name*="full" i][name*="name" i]',
                'input[type="text"][autocomplete="given-name"]',
                'input[type="text"][autocomplete="family-name"]',
                'input[type="text"][autocomplete="name"]',
            ];

            // Email field patterns (that are not for login)
            const emailSelectors = [
                'input[type="email"][autocomplete="email"]',
                'input[type="text"][name*="email" i]',
            ];

            // Phone field patterns
            const phoneSelectors = [
                'input[type="tel"][autocomplete="tel"]',
                'input[type="tel"][name*="phone" i]',
                'input[type="tel"][name*="mobile" i]',
            ];

            // Address field patterns
            const addressSelectors = [
                'input[type="text"][autocomplete="street-address"]',
                'input[type="text"][autocomplete="address-line1"]',
                'input[type="text"][name*="address" i]',
                'input[type="text"][name*="street" i]',
            ];

            // City field patterns
            const citySelectors = [
                'input[type="text"][autocomplete="city"]',
                'input[type="text"][autocomplete="address-level2"]',
                'input[type="text"][name*="city" i]',
            ];

            // State/Province field patterns
            const stateSelectors = [
                'input[type="text"][autocomplete="state"]',
                'input[type="text"][autocomplete="address-level1"]',
                'input[type="text"][name*="state" i]',
                'input[type="text"][name*="province" i]',
            ];

            // Postal code field patterns
            const postalSelectors = [
                'input[type="text"][autocomplete="postal-code"]',
                'input[type="text"][name*="zip" i]',
                'input[type="text"][name*="postal" i]',
            ];

            // Country field patterns
            const countrySelectors = [
                'input[type="text"][autocomplete="country"]',
                'input[type="text"][autocomplete="country-name"]',
                'input[type="text"][name*="country" i]',
            ];

            // Company field patterns
            const companySelectors = [
                'input[type="text"][autocomplete="organization"]',
                'input[type="text"][autocomplete="organization-title"]',
                'input[type="text"][name*="company" i]',
            ];

            // Detect all identity field types
            const fieldTypes: Array<{selectors: string[], type: string}> = [
                {selectors: nameSelectors, type: 'name'},
                {selectors: emailSelectors, type: 'email'},
                {selectors: phoneSelectors, type: 'phone'},
                {selectors: addressSelectors, type: 'address'},
                {selectors: citySelectors, type: 'city'},
                {selectors: stateSelectors, type: 'state'},
                {selectors: postalSelectors, type: 'postalCode'},
                {selectors: countrySelectors, type: 'country'},
                {selectors: companySelectors, type: 'company'},
            ];

            // Check each field type
            fieldTypes.forEach(({selectors, type}) => {
                selectors.forEach(selector => {
                    const element = document.querySelector<HTMLInputElement>(selector);
                    if (element && !element.disabled && !element.hasAttribute('data-securefox-processed')) {
                        // Skip if this is a login field (password or username field in a login form)
                        const isLoginField = element.type === 'password' ||
                                          element.hasAttribute('autocomplete') &&
                                          (element.getAttribute('autocomplete') === 'username' ||
                                           element.getAttribute('autocomplete') === 'current-password');

                        if (!isLoginField) {
                            fields.push({field: element, fieldType: type});
                            element.setAttribute('data-securefox-processed', 'true');
                        }
                    }
                });
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

        // Create inline autofill icon for a field (always show icon)
        const createInlineIcon = async (element: HTMLInputElement) => {
            // Check if icon already exists
            if (fieldIconMap.has(element)) {
                return;
            }

            // Create icon with click handler (always show, regardless of matches)
            const icon = new InlineAutofillIcon(element, async () => {
                await showSmartMenu(element);
            });

            // Store reference
            fieldIconMap.set(element, icon);

            // Show icon immediately
            icon.show();
        };

        // Helper function to fill field with animation
        const fillField = (field: HTMLInputElement, value: string) => {
            field.style.transition = 'background-color 0.3s ease';
            field.style.backgroundColor = '#dbeafe';

            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));

            setTimeout(() => {
                field.style.backgroundColor = '';
                setTimeout(() => {
                    field.style.transition = '';
                }, 300);
            }, 300);
        };

        // Create inline autofill icon for credit card fields (purple variant)
        const createCardIcon = async (element: HTMLInputElement, fieldType: 'number' | 'cvv' | 'exp') => {
            // Check if icon already exists
            if (fieldIconMap.has(element)) {
                return;
            }

            // Create icon with purple color for cards
            const icon = new InlineAutofillIcon(element, async () => {
                await showCardMenu(element, fieldType);
            }, '#8b5cf6'); // Purple color for cards

            // Store reference
            fieldIconMap.set(element, icon);

            // Show icon immediately
            icon.show();
        };

        // Show card menu with matching credit cards
        const showCardMenu = async (element: HTMLInputElement, fieldType: 'number' | 'cvv' | 'exp') => {
            try {
                // Close existing card menu
                if (currentCardMenu) {
                    currentCardMenu.destroy();
                    currentCardMenu = null;
                }

                // Check if vault is unlocked
                const statusResponse = await chrome.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_STATUS,
                });

                if (!statusResponse.isUnlocked) {
                    showNotification('请先解锁密码库以使用信用卡填充', 'warning');
                    return;
                }

                // Get all entries and filter for cards
                const allEntriesResponse = await chrome.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_ALL_ENTRIES,
                });

                if (!allEntriesResponse || !allEntriesResponse.entries) {
                    showNotification('无法获取信用卡信息', 'error');
                    return;
                }

                // Filter for card entries
                const cards = allEntriesResponse.entries.filter(entry => entry.type === ItemType.Card && entry.card);

                if (cards.length === 0) {
                    showNotification('密码库中没有保存的信用卡', 'info');
                    return;
                }

                // Show card menu
                currentCardMenu = new CardMenu(
                    cards,
                    element,
                    fieldType,
                    (card, field) => {
                        fillCardField(card, field, element);
                    }
                );

                currentCardMenu.show();
            } catch (error) {
                console.error('Failed to show card menu:', error);
                showNotification('获取信用卡失败', 'error');
            }
        };

        // Fill card field with selected card data
        const fillCardField = async (card: any, fieldType: 'number' | 'cvv' | 'exp', targetElement: HTMLInputElement) => {
            // Check HTTP warning before filling
            const shouldContinue = await showHttpWarningDialog();
            if (!shouldContinue) {
                showNotification('已取消填充', 'info');
                return;
            }
            try {
                const cardData = card.card;

                switch (fieldType) {
                    case 'number':
                        if (cardData.number) {
                            fillField(targetElement, cardData.number);
                            showNotification(`已填充 ${card.name} 的卡号`, 'success');
                        }
                        break;

                    case 'cvv':
                        if (cardData.code) {
                            fillField(targetElement, cardData.code);
                            showNotification(`已填充 ${card.name} 的安全码`, 'success');
                        }
                        break;

                    case 'exp':
                        // Format expiration as MM/YY
                        if (cardData.expMonth && cardData.expYear) {
                            const expMonth = cardData.expMonth.padStart(2, '0');
                            const expYear = cardData.expYear.slice(-2); // Last 2 digits
                            const expValue = `${expMonth}/${expYear}`;
                            fillField(targetElement, expValue);
                            showNotification(`已填充 ${card.name} 的有效期`, 'success');
                        }
                        break;
                }
            } catch (error) {
                console.error('Failed to fill card field:', error);
                showNotification('填充失败', 'error');
            }
        };

        // Create inline autofill icon for identity fields (green variant)
        const createIdentityIcon = async (element: HTMLInputElement, fieldType: string) => {
            // Check if icon already exists
            if (fieldIconMap.has(element)) {
                return;
            }

            // Create icon with green color for identity
            const icon = new InlineAutofillIcon(element, async () => {
                await showIdentityMenu(element, fieldType);
            }, '#10b981'); // Green color for identity

            // Store reference
            fieldIconMap.set(element, icon);

            // Show icon immediately
            icon.show();
        };

        // Show identity menu with matching identity information
        const showIdentityMenu = async (element: HTMLInputElement, fieldType: string) => {
            try {
                // Close existing identity menu
                if (currentIdentityMenu) {
                    currentIdentityMenu.destroy();
                    currentIdentityMenu = null;
                }

                // Check if vault is unlocked
                const statusResponse = await chrome.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_STATUS,
                });

                if (!statusResponse.isUnlocked) {
                    showNotification('请先解锁密码库以使用身份信息填充', 'warning');
                    return;
                }

                // Get all entries and filter for identities
                const allEntriesResponse = await chrome.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_ALL_ENTRIES,
                });

                if (!allEntriesResponse || !allEntriesResponse.entries) {
                    showNotification('无法获取身份信息', 'error');
                    return;
                }

                // Filter for identity entries
                const identities = allEntriesResponse.entries.filter(entry => entry.type === ItemType.Identity && entry.identity);

                if (identities.length === 0) {
                    showNotification('密码库中没有保存的身份信息', 'info');
                    return;
                }

                // Show identity menu
                currentIdentityMenu = new IdentityMenu(
                    identities,
                    element,
                    fieldType,
                    (identity, ft) => {
                        fillIdentityField(identity, ft, element);
                    }
                );

                currentIdentityMenu.show();
            } catch (error) {
                console.error('Failed to show identity menu:', error);
                showNotification('获取身份信息失败', 'error');
            }
        };

        // Fill identity field with selected identity data
        const fillIdentityField = async (identity: any, fieldType: string, targetElement: HTMLInputElement) => {
            // Check HTTP warning before filling
            const shouldContinue = await showHttpWarningDialog();
            if (!shouldContinue) {
                showNotification('已取消填充', 'info');
                return;
            }
            try {
                const identityData = identity.identity;

                switch (fieldType) {
                    case 'name':
                        // Try to fill with full name
                        const fullName = [identityData.firstName, identityData.middleName, identityData.lastName]
                            .filter(Boolean)
                            .join(' ');
                        if (fullName) {
                            fillField(targetElement, fullName);
                            showNotification(`已填充 ${identity.name} 的姓名`, 'success');
                        }
                        break;

                    case 'email':
                        if (identityData.email) {
                            fillField(targetElement, identityData.email);
                            showNotification(`已填充 ${identity.name} 的邮箱`, 'success');
                        }
                        break;

                    case 'phone':
                        if (identityData.phone) {
                            fillField(targetElement, identityData.phone);
                            showNotification(`已填充 ${identity.name} 的电话`, 'success');
                        }
                        break;

                    case 'address':
                        // Fill with address line 1
                        if (identityData.address1) {
                            fillField(targetElement, identityData.address1);
                            showNotification(`已填充 ${identity.name} 的地址`, 'success');
                        }
                        break;

                    case 'city':
                        if (identityData.city) {
                            fillField(targetElement, identityData.city);
                            showNotification(`已填充 ${identity.name} 的城市`, 'success');
                        }
                        break;

                    case 'state':
                        if (identityData.state) {
                            fillField(targetElement, identityData.state);
                            showNotification(`已填充 ${identity.name} 的省/州`, 'success');
                        }
                        break;

                    case 'postalCode':
                        if (identityData.postalCode) {
                            fillField(targetElement, identityData.postalCode);
                            showNotification(`已填充 ${identity.name} 的邮编`, 'success');
                        }
                        break;

                    case 'country':
                        if (identityData.country) {
                            fillField(targetElement, identityData.country);
                            showNotification(`已填充 ${identity.name} 的国家`, 'success');
                        }
                        break;

                    case 'company':
                        if (identityData.company) {
                            fillField(targetElement, identityData.company);
                            showNotification(`已填充 ${identity.name} 的公司`, 'success');
                        }
                        break;
                }
            } catch (error) {
                console.error('Failed to fill identity field:', error);
                showNotification('填充失败', 'error');
            }
        };

        // Show security warning confirmation dialog (HTTP or iframe)
        const showHttpWarningDialog = async (): Promise<boolean> => {
            return new Promise((resolve) => {
                // Check if using HTTP or in iframe
                const isHttpConnection = window.location.protocol === 'http:';
                const isIframe = window.self !== window.top;

                // If neither HTTP nor iframe, allow immediately
                if (!isHttpConnection && !isIframe) {
                    resolve(true);
                    return;
                }

                // Determine warning message
                let warningMessage = '';
                if (isHttpConnection && isIframe) {
                    warningMessage = `当前使用 <strong>HTTP 连接（不加密）</strong> 且在 <strong>iframe 中</strong>，您的凭据可能被窃听。`;
                } else if (isHttpConnection) {
                    warningMessage = `当前使用 <strong>HTTP 连接（不加密）</strong>，您的凭据可能被窃听。`;
                } else {
                    warningMessage = `当前页面在 <strong>iframe 中</strong>，可能存在安全风险。`;
                }

                // Create warning dialog
                const dialog = document.createElement('div');
                dialog.className = 'securefox-http-warning-dialog';
                dialog.setAttribute('data-securefox-menu', 'true');
                dialog.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border: 2px solid #f59e0b;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    min-width: 400px;
                    max-width: 480px;
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.95);
                    transition: all 0.2s ease;
                `;

                dialog.innerHTML = `
                    <div style="padding: 24px;">
                        <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px;">
                            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 9V13M12 17H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 700; color: #1e293b; font-size: 18px; margin-bottom: 8px;">⚠️ 安全警告</div>
                                <div style="color: #64748b; font-size: 14px; line-height: 1.6;">
                                    ${warningMessage}
                                    <br><br>
                                    是否继续填充？
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px;">
                            <button id="sf-cancel-btn" style="
                                flex: 1;
                                padding: 12px;
                                border: 2px solid #e2e8f0;
                                background: white;
                                color: #64748b;
                                font-size: 14px;
                                font-weight: 600;
                                border-radius: 10px;
                                cursor: pointer;
                                transition: all 0.2s;
                            ">
                                取消
                            </button>
                            <button id="sf-continue-btn" style="
                                flex: 1;
                                padding: 12px;
                                border: none;
                                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                                color: white;
                                font-size: 14px;
                                font-weight: 600;
                                border-radius: 10px;
                                cursor: pointer;
                                transition: all 0.2s;
                                box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
                            ">
                                继续填充
                            </button>
                        </div>
                    </div>
                `;

                document.body.appendChild(dialog);

                // Show animation
                requestAnimationFrame(() => {
                    dialog.style.opacity = '1';
                    dialog.style.transform = 'translate(-50%, -50%) scale(1)';
                });

                // Button hover effects
                const continueBtn = dialog.querySelector('#sf-continue-btn') as HTMLButtonElement;
                const cancelBtn = dialog.querySelector('#sf-cancel-btn') as HTMLButtonElement;

                continueBtn.addEventListener('mouseenter', () => {
                    continueBtn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
                    continueBtn.style.transform = 'translateY(-1px)';
                });
                continueBtn.addEventListener('mouseleave', () => {
                    continueBtn.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.3)';
                    continueBtn.style.transform = 'translateY(0)';
                });

                cancelBtn.addEventListener('mouseenter', () => {
                    cancelBtn.style.background = '#f8fafc';
                });
                cancelBtn.addEventListener('mouseleave', () => {
                    cancelBtn.style.background = 'white';
                });

                // Handle continue
                continueBtn.addEventListener('click', () => {
                    dialog.style.opacity = '0';
                    dialog.style.transform = 'translate(-50%, -50%) scale(0.95)';
                    setTimeout(() => {
                        if (dialog.parentNode) {
                            dialog.parentNode.removeChild(dialog);
                        }
                    }, 200);
                    resolve(true);
                });

                // Handle cancel
                cancelBtn.addEventListener('click', () => {
                    dialog.style.opacity = '0';
                    dialog.style.transform = 'translate(-50%, -50%) scale(0.95)';
                    setTimeout(() => {
                        if (dialog.parentNode) {
                            dialog.parentNode.removeChild(dialog);
                        }
                    }, 200);
                    resolve(false);
                });

                // Close on outside click
                const closeOnClickOutside = (e: MouseEvent) => {
                    if (!dialog.contains(e.target as HTMLElement)) {
                        cancelBtn.click();
                        document.removeEventListener('click', closeOnClickOutside);
                    }
                };
                setTimeout(() => {
                    document.addEventListener('click', closeOnClickOutside);
                }, 100);
            });
        };

        // Show smart menu based on vault state and available credentials
        const showSmartMenu = async (element: HTMLInputElement) => {
            try {
                // Close existing menu
                if (currentMenu) {
                    currentMenu.destroy();
                    currentMenu = null;
                }

                // Check if vault is unlocked
                const statusResponse = await chrome.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_STATUS,
                });

                if (!statusResponse.isUnlocked) {
                    // Vault is locked, show unlock prompt menu
                    showUnlockPromptMenu(element);
                    return;
                }

                // Vault is unlocked, get matching credentials
                const response = await chrome.runtime.sendMessage({
                    type: MESSAGE_TYPES.REQUEST_CREDENTIALS,
                    domain: window.location.hostname,
                });

                if (!response || !response.entries) {
                    showNotification('无法获取凭据', 'error');
                    return;
                }

                if (response.entries.length === 0) {
                    // No matching credentials, show create new prompt
                    showCreateNewPromptMenu(element);
                    return;
                }

                // Has matching credentials, show credential selection menu
                currentMenu = new CredentialMenu(
                    response.entries,
                    element,
                    (credential) => {
                        fillCredentials(credential);
                    }
                );

                currentMenu.show();
            } catch (error) {
                console.error('Failed to show smart menu:', error);
                showNotification('获取凭据失败', 'error');
            }
        };

        // Show unlock prompt menu
        const showUnlockPromptMenu = (element: HTMLInputElement) => {
            const menu = document.createElement('div');
            menu.className = 'securefox-unlock-menu';
            menu.setAttribute('data-securefox-menu', 'true');
            menu.style.cssText = `
                position: fixed;
                background: white;
                border: 1px solid #e5e5e5;
                border-radius: 12px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                min-width: 280px;
                max-width: 320px;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                opacity: 0;
                transform: translateY(-8px);
                transition: opacity 0.2s ease, transform 0.2s ease;
            `;

            menu.innerHTML = `
                <div style="padding: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2C9.243 2 7 4.243 7 7V10H6C4.895 10 4 10.895 4 12V20C4 21.105 4.895 22 6 22H18C19.105 22 20 21.105 20 20V12C20 10.895 19.105 10 18 10H17V7C17 4.243 14.757 2 12 2Z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: #1e293b; font-size: 15px;">密码库已锁定</div>
                            <div style="color: #64748b; font-size: 12px;">点击解锁以使用自动填充</div>
                        </div>
                    </div>
                    <button id="sf-unlock-btn" style="
                        width: 100%;
                        padding: 10px;
                        border: none;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        font-size: 14px;
                        font-weight: 600;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
                    ">
                        解锁密码库
                    </button>
                </div>
            `;

            document.body.appendChild(menu);

            // Position menu
            const rect = element.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            let top = rect.bottom + 4;
            if (top + 200 > viewportHeight - 16) {
                top = rect.top - 200;
            }
            menu.style.top = `${top}px`;
            menu.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 320 - 16))}px`;

            // Show animation
            requestAnimationFrame(() => {
                menu.style.opacity = '1';
                menu.style.transform = 'translateY(0)';
            });

            // Add hover effect for button
            const unlockBtn = menu.querySelector('#sf-unlock-btn') as HTMLButtonElement;
            if (unlockBtn) {
                unlockBtn.addEventListener('mouseenter', () => {
                    unlockBtn.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                    unlockBtn.style.transform = 'translateY(-1px)';
                });
                unlockBtn.addEventListener('mouseleave', () => {
                    unlockBtn.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                    unlockBtn.style.transform = 'translateY(0)';
                });
            }

            // Handle unlock button
            unlockBtn?.addEventListener('click', () => {
                // Open extension popup
                chrome.runtime.sendMessage({type: 'OPEN_POPUP'});
                menu.style.opacity = '0';
                menu.style.transform = 'translateY(-8px)';
                setTimeout(() => menu.remove(), 200);
            });

            // Close on outside click
            const closeHandler = (e: MouseEvent) => {
                if (!menu.contains(e.target as Node) && !element.contains(e.target as Node)) {
                    menu.style.opacity = '0';
                    menu.style.transform = 'translateY(-8px)';
                    setTimeout(() => {
                        menu.remove();
                        document.removeEventListener('click', closeHandler);
                    }, 200);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 0);

            // Store reference
            (menu as any)._closeHandler = closeHandler;
            currentMenu = { destroy: () => {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }} as any;
        };

        // Show create new credential prompt menu
        const showCreateNewPromptMenu = (element: HTMLInputElement) => {
            const menu = document.createElement('div');
            menu.className = 'securefox-create-menu';
            menu.setAttribute('data-securefox-menu', 'true');
            menu.style.cssText = `
                position: fixed;
                background: white;
                border: 1px solid #e5e5e5;
                border-radius: 12px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                min-width: 280px;
                max-width: 320px;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                opacity: 0;
                transform: translateY(-8px);
                transition: opacity 0.2s ease, transform 0.2s ease;
            `;

            const hostname = window.location.hostname;

            menu.innerHTML = `
                <div style="padding: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M12 5v14M5 12h14" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                            </svg>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: #1e293b; font-size: 15px;">无保存的凭据</div>
                            <div style="color: #64748b; font-size: 12px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${hostname}</div>
                        </div>
                    </div>
                    <button id="sf-create-btn" style="
                        width: 100%;
                        padding: 10px;
                        border: none;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        font-size: 14px;
                        font-weight: 600;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
                    ">
                        + 创建新登录
                    </button>
                </div>
            `;

            document.body.appendChild(menu);

            // Position menu
            const rect = element.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            let top = rect.bottom + 4;
            if (top + 200 > viewportHeight - 16) {
                top = rect.top - 200;
            }
            menu.style.top = `${top}px`;
            menu.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 320 - 16))}px`;

            // Show animation
            requestAnimationFrame(() => {
                menu.style.opacity = '1';
                menu.style.transform = 'translateY(0)';
            });

            // Add hover effect for button
            const createBtn = menu.querySelector('#sf-create-btn') as HTMLButtonElement;
            if (createBtn) {
                createBtn.addEventListener('mouseenter', () => {
                    createBtn.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                    createBtn.style.transform = 'translateY(-1px)';
                });
                createBtn.addEventListener('mouseleave', () => {
                    createBtn.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                    createBtn.style.transform = 'translateY(0)';
                });
            }

            // Handle create button
            createBtn?.addEventListener('click', () => {
                // Store the hostname and URL for pre-filling the add item form
                chrome.storage.local.set({
                    'pendingAction': 'openAddModal',
                    'pendingAddItem': {
                        name: hostname,
                        uri: window.location.href
                    }
                });
                // Try to open popup
                chrome.runtime.sendMessage({type: 'OPEN_POPUP', action: 'add'});
                menu.style.opacity = '0';
                menu.style.transform = 'translateY(-8px)';
                setTimeout(() => menu.remove(), 200);
            });

            // Close on outside click
            const closeHandler = (e: MouseEvent) => {
                if (!menu.contains(e.target as Node) && !element.contains(e.target as Node)) {
                    menu.style.opacity = '0';
                    menu.style.transform = 'translateY(-8px)';
                    setTimeout(() => {
                        menu.remove();
                        document.removeEventListener('click', closeHandler);
                    }, 200);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 0);

            // Store reference
            (menu as any)._closeHandler = closeHandler;
            currentMenu = { destroy: () => {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }} as any;
        };

        // Show credential selection menu (legacy, kept for compatibility)
        const showCredentialMenu = async (element: HTMLInputElement) => {
            await showSmartMenu(element);
        };

        // Fill credentials with enhanced animation
        const fillCredentials = async (entry: any) => {
            // Check HTTP warning before filling
            const shouldContinue = await showHttpWarningDialog();
            if (!shouldContinue) {
                showNotification('已取消填充', 'info');
                return;
            }

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
                field.dispatchEvent(new Event('input', {bubbles: true}));
                field.dispatchEvent(new Event('change', {bubbles: true}));

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
                            field.dispatchEvent(new Event('input', {bubbles: true}));
                            field.dispatchEvent(new Event('change', {bubbles: true}));
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
        const showNotification = (
            message: string,
            type: 'success' | 'error' | 'warning' | 'info' = 'info',
            duration: number = 3000
        ) => {
            const notification = document.createElement('div');

            // Color schemes for different types
            const colors = {
                success: {bg: '#10b981', icon: '✓'},
                error: {bg: '#ef4444', icon: '✕'},
                warning: {bg: '#f59e0b', icon: '⚠'},
                info: {bg: '#3b82f6', icon: 'ℹ'}
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

            // Auto remove after custom duration
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, duration);
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
            (async () => {
                try {
                    switch (message.type) {
                        case MESSAGE_TYPES.REQUEST_AUTOFILL_CONFIRMATION:
                            // Show HTTP warning dialog for page load auto-fill
                            const shouldContinue = await showHttpWarningDialog();
                            if (shouldContinue) {
                                // User confirmed, fill credentials
                                await fillCredentials({login: message.entry});
                                sendResponse({success: true, confirmed: true});
                            } else {
                                // User cancelled
                                showNotification('已取消自动填充', 'info');
                                sendResponse({success: true, confirmed: false});
                            }
                            break;

                        case MESSAGE_TYPES.FILL_CREDENTIALS:
                            await fillCredentials({login: message.data});
                            sendResponse({success: true});
                            break;

                        case 'INSERT_GENERATED_PASSWORD':
                            if (currentFocusedElement) {
                                currentFocusedElement.value = message.data.password;
                                currentFocusedElement.dispatchEvent(new Event('input', {bubbles: true}));
                                currentFocusedElement.dispatchEvent(new Event('change', {bubbles: true}));
                                showNotification('密码已生成并插入');
                            }
                            sendResponse({success: true});
                            break;

                        default:
                            sendResponse({error: 'Unknown message type'});
                    }
                } catch (error) {
                    sendResponse({error: error instanceof Error ? error.message : 'An error occurred'});
                }
            })();

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

        // Keyboard shortcut handler (Ctrl+Shift+L) - with cyclic selection
        let currentFillIndex = -1; // Track current credential index for cycling

        const handleKeyboardShortcut = async (event: KeyboardEvent) => {
            // Ctrl+Shift+L or Cmd+Shift+L (Mac)
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'L') {
                event.preventDefault();

                try {
                    // Get matching credentials for current domain
                    const response = await chrome.runtime.sendMessage({
                        type: MESSAGE_TYPES.REQUEST_CREDENTIALS,
                        domain: window.location.hostname,
                    });

                    if (!response || !response.entries || response.entries.length === 0) {
                        showNotification('未找到匹配的凭据');
                        return;
                    }

                    const matchingEntries = response.entries;

                    // If only one match, fill it directly
                    if (matchingEntries.length === 1) {
                        fillCredentials({login: matchingEntries[0]});
                        showNotification(`已填充：${matchingEntries[0].name}`, 'success');
                        currentFillIndex = 0;
                        return;
                    }

                    // Multiple matches - implement cycling
                    // Check if Shift is held for reverse cycling
                    const isReverse = event.shiftKey;

                    if (isReverse) {
                        // Cycle backward (with Shift key)
                        currentFillIndex = currentFillIndex <= 0
                            ? matchingEntries.length - 1
                            : currentFillIndex - 1;
                    } else {
                        // Cycle forward (without Shift key, or with Ctrl+Shift)
                        currentFillIndex = (currentFillIndex + 1) % matchingEntries.length;
                    }

                    // Fill the selected credential
                    const selectedEntry = matchingEntries[currentFillIndex];
                    fillCredentials({login: selectedEntry});

                    // Show notification with entry name and position
                    showNotification(
                        `已填充 (${currentFillIndex + 1}/${matchingEntries.length})：${selectedEntry.name}`,
                        'success'
                    );

                    // Focus the first input field if available
                    if (currentFocusedElement) {
                        currentFocusedElement.focus();
                    } else {
                        const loginFields = detectLoginFields();
                        if (loginFields.length > 0) {
                            const firstField = loginFields.find(f => f.type === 'password') || loginFields[0];
                            firstField.focus();
                        }
                    }
                } catch (error) {
                    console.error('Failed to handle keyboard shortcut:', error);
                    showNotification('获取凭据失败', 'error');
                }
            }
        };

        // Storage key for pending credentials
        const PENDING_CREDS_KEY = 'securefox_pending_credentials';

        // Check for pending credentials on page load
        const checkPendingCredentials = async () => {
            try {
                const result = await chrome.storage.local.get(PENDING_CREDS_KEY);
                const pending = result[PENDING_CREDS_KEY];

                if (pending && pending.url) {
                    const currentUrl = window.location.href;
                    // Check if we're on a different page (likely after successful login)
                    if (currentUrl !== pending.url && currentUrl.includes(new URL(pending.url).hostname)) {
                        console.log('SecureFox: Found pending credentials after page navigation');
                        // Show save prompt
                        await promptSavePassword(pending);
                        // Clear pending credentials
                        await chrome.storage.local.remove(PENDING_CREDS_KEY);
                    }
                }
            } catch (error) {
                console.error('SecureFox: Failed to check pending credentials:', error);
            }
        };

        // Capture credentials from form fields
        const captureCredentials = async () => {
            // Find password field
            const passwordFields = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
            if (passwordFields.length === 0) return null;

            // Get the first visible password field
            const passwordField = Array.from(passwordFields).find(field => {
                const rect = field.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && !field.disabled;
            });

            if (!passwordField || !passwordField.value) return null;

            // Find username field
            const usernameField = detectUsernameField(passwordField);
            const username = usernameField?.value || '';
            const password = passwordField.value;

            if (!username || !password) return null;

            return {
                username,
                password,
                url: window.location.href,
                timestamp: Date.now()
            };
        };

        // Monitor form submissions to prompt password save
        const handleFormSubmit = async (event: Event) => {
            console.log('SecureFox: Form submit detected');

            const credentials = await captureCredentials();
            if (!credentials) {
                console.log('SecureFox: No valid credentials found');
                return;
            }

            console.log('SecureFox: Captured credentials, storing for later...');

            // Store credentials immediately in case page redirects
            await chrome.storage.local.set({[PENDING_CREDS_KEY]: credentials});

            // Also try to show prompt immediately (will be cancelled if page redirects)
            setTimeout(async () => {
                await promptSavePassword(credentials);
                await chrome.storage.local.remove(PENDING_CREDS_KEY);
            }, 100);
        };

        // Monitor button clicks that might submit forms
        const handleButtonClick = async (event: MouseEvent) => {
            const button = event.target as HTMLElement;

            // Check if it's a submit button
            if (button.tagName === 'BUTTON' || (button.tagName === 'INPUT' && (button as HTMLInputElement).type === 'submit')) {
                const credentials = await captureCredentials();
                if (credentials) {
                    console.log('SecureFox: Submit button clicked, storing credentials...');
                    await chrome.storage.local.set({[PENDING_CREDS_KEY]: credentials});
                }
            }
        };

    // Prompt user to save password
    const promptSavePassword = async (credentials: { username: string; password: string; url: string }) => {
      // Check if vault is unlocked before showing prompt
      try {
        const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATUS });

        if (!response.isUnlocked) {
          // Vault is locked, show notification to unlock first
          showNotification('请先解锁密码库以保存密码', 'info');
          return;
        }

        // Check if entry already exists for this domain and username
        const existingResponse = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.REQUEST_CREDENTIALS,
          domain: window.location.hostname,
        });

        let isUpdate = false;
        if (existingResponse && existingResponse.entries && existingResponse.entries.length > 0) {
          // Check if any entry matches the username
          const matchingEntry = existingResponse.entries.find((entry: any) =>
            entry.login?.username === credentials.username
          );

          if (matchingEntry) {
            // Check if password is different
            if (matchingEntry.login?.password !== credentials.password) {
              isUpdate = true;
              console.log('SecureFox: Found existing entry with different password, will show update prompt');
            } else {
              // Same password, no need to save
              console.log('SecureFox: Entry already exists with same password, skipping prompt');
              return;
            }
          }
        }

        // Show save or update prompt
        showSavePrompt(credentials, isUpdate);
      } catch (error) {
        console.error('Failed to check lock status:', error);
        // If unable to check status, still show the prompt
        showSavePrompt(credentials, false);
      }
    };

    // Initialize drag and drop support for credential autofill
    const initializeDragAndDrop = () => {
        // Allow drop on all input fields
        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
        };

        // Handle drop event
        const handleDrop = async (e: DragEvent) => {
            e.preventDefault();

            try {
                const data = e.dataTransfer!.getData('application/json');
                if (!data) return;

                const credential = JSON.parse(data);

                // Check if this is a SecureFox credential
                if (credential.type !== 'securefox/credential') return;

                // Get the target element
                const target = e.target as HTMLElement;
                const input = target.closest('input') as HTMLInputElement;

                if (!input) {
                    showNotification('请将凭据拖拽到输入框中', 'warning');
                    return;
                }

                // Determine if this is a username or password field
                const isPasswordField = input.type === 'password';
                const isUsernameField = input.type === 'text' || input.type === 'email';

                if (isPasswordField && credential.password) {
                    // Fill password
                    fillField(input, credential.password);
                    showNotification(`已填充 ${credential.name} 的密码`, 'success');

                    // Try to find and fill username field
                    const usernameField = detectUsernameField(input);
                    if (usernameField && credential.username) {
                        fillField(usernameField, credential.username);
                    }
                } else if (isUsernameField && credential.username) {
                    // Fill username
                    fillField(input, credential.username);
                    showNotification(`已填充 ${credential.name} 的用户名`, 'success');

                    // Try to find and fill password field
                    const passwordFields = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
                    if (passwordFields.length > 0 && credential.password) {
                        fillField(passwordFields[0], credential.password);
                    }
                } else {
                    showNotification('无法识别的输入框类型', 'warning');
                }
            } catch (error) {
                console.error('Failed to handle drop:', error);
                showNotification('拖放填充失败', 'error');
            }
        };

        // Add event listeners to document
        document.addEventListener('dragover', handleDragOver);
        document.addEventListener('drop', handleDrop);

        console.log('SecureFox: Drag and drop support initialized');
    };

        // Show save/update password prompt
        const showSavePrompt = (credentials: {
            username: string;
            password: string;
            url: string
        }, isUpdate: boolean) => {
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
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
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
          <div style="flex-shrink: 0; width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 14C7 14 7 14 7 14C7 14.5304 7.21071 15.0391 7.58579 15.4142C7.96086 15.7893 8.46957 16 9 16H15C15.5304 16 16.0391 15.7893 16.4142 15.4142C16.7893 15.0391 17 14.5304 17 14V7C17 6.46957 16.7893 5.96086 16.4142 5.58579C16.0391 5.21071 15.5304 5 15 5H9C8.46957 5 7.96086 5.21071 7.58579 5.58579C7.21071 5.96086 7 6.46957 7 7V14Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
          <button id="sf-save-btn" style="flex: 1; padding: 10px; border: none; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(59, 130, 246, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(59, 130, 246, 0.2)'">
            ${isUpdate ? '更新' : '保存'}
          </button>
          <button id="sf-never-btn" style="flex: 1; padding: 10px; border: 1px solid #e5e5e5; background: white; color: #64748b; font-size: 14px; font-weight: 500; border-radius: 8px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            从不
          </button>
        </div>
      `;

            document.body.appendChild(prompt);

            // Handle save button
            prompt.querySelector('#sf-save-btn')?.addEventListener('click', async () => {
                try {
                    // Generate entry name: "domain - username" or just "domain" if too long
                    const domain = hostname.replace(/^www\./, ''); // Remove www. prefix
                    let entryName = `${domain} - ${credentials.username}`;

                    // If name is too long (>50 chars), just use domain
                    if (entryName.length > 50) {
                        entryName = domain;
                    }

                    // Import match type helper
                    const {getRecommendedMatchType} = await import('@/utils/helpers');
                    const recommendedMatch = getRecommendedMatchType(credentials.url);

                    const result = await chrome.runtime.sendMessage({
                        type: MESSAGE_TYPES.SAVE_CREDENTIALS,
                        data: {
                            name: entryName,
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
                        // Clear stored credentials
                        await chrome.storage.local.remove(PENDING_CREDS_KEY);
                    } else {
                        showNotification('保存失败', 'error');
                    }
                } catch (error) {
                    console.error('Failed to save credential:', error);
                    showNotification('保存失败', 'error');
                }
            });

            // Handle never button
            prompt.querySelector('#sf-never-btn')?.addEventListener('click', async () => {
                // TODO: Add to never save list
                prompt.remove();
                await chrome.storage.local.remove(PENDING_CREDS_KEY);
            });

            // Handle close button
            prompt.querySelector('#sf-close-prompt')?.addEventListener('click', async () => {
                prompt.remove();
                await chrome.storage.local.remove(PENDING_CREDS_KEY);
            });

            // Auto dismiss after 30 seconds
            setTimeout(async () => {
                if (prompt.parentNode) {
                    prompt.remove();
                    await chrome.storage.local.remove(PENDING_CREDS_KEY);
                }
            }, 30000);
        };

        // Initialize inline autofill system
        const initialize = async () => {
            // Detect and process credit card fields FIRST (before login fields)
            // This is important because CVV fields are type="password" and could be misidentified as login password fields
            const cardFields = detectCardFields();
            for (const {field, type} of cardFields) {
                await createCardIcon(field, type);
            }

            // Detect and process login fields
            const loginFields = detectLoginFields();

            // Process fields asynchronously to check for matching credentials
            for (const field of loginFields) {
                // Create inline icon (only if credentials match)
                await createInlineIcon(field);
            }

            // Detect and process identity fields
            const identityFields = detectIdentityFields();
            for (const {field, fieldType} of identityFields) {
                await createIdentityIcon(field, fieldType);
            }

            // Add event listeners
            document.addEventListener('focusin', handleFocus, true);
            document.addEventListener('focusout', handleBlur, true);
            document.addEventListener('keydown', handleKeyboardShortcut, true);
            document.addEventListener('submit', handleFormSubmit, true);
            document.addEventListener('click', handleButtonClick, true);

            // Add drag and drop support
            initializeDragAndDrop();

            // Check for pending credentials from previous page
            await checkPendingCredentials();

            // Initial badge update
            updateBadge();
        };

        // Security warnings system
        // 已移除页面加载时的通知警告，只保留用户主动填充时的确认对话框

        // Watch for new fields (SPA support)
        const observer = new MutationObserver(async () => {
            // Detect and process new credit card fields FIRST
            // This prevents CVV (password type) from being misidentified as login fields
            const newCardFields = detectCardFields();
            for (const {field, type} of newCardFields) {
                await createCardIcon(field, type);
            }

            // Detect and process new login fields
            const newLoginFields = detectLoginFields();
            for (const field of newLoginFields) {
                field.setAttribute('data-securefox-processed', 'true');
                await createInlineIcon(field);
            }

            // Detect and process new identity fields
            const newIdentityFields = detectIdentityFields();
            for (const {field, fieldType} of newIdentityFields) {
                await createIdentityIcon(field, fieldType);
            }

            // Update badge when new fields appear
            if (newLoginFields.length > 0) {
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
