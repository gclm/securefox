/**
 * 身份信息菜单组件
 * 显示匹配的身份信息列表，支持搜索、键盘导航
 */

interface Identity {
  id: string;
  name: string;
  identity?: {
    title?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    address1?: string;
    address2?: string;
    address3?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    email?: string;
    phone?: string;
    ssn?: string;
    username?: string;
    company?: string;
  };
}

export class IdentityMenu {
  private menuElement: HTMLDivElement;
  private identities: Identity[];
  private onSelect: (identity: Identity, fieldType: string) => void;
  private anchorElement: HTMLElement;
  private targetFieldType: string;
  private selectedIndex: number = -1;
  private isVisible: boolean = false;

  constructor(
    identities: Identity[],
    anchorElement: HTMLElement,
    targetFieldType: string,
    onSelect: (identity: Identity, fieldType: string) => void
  ) {
    this.identities = identities;
    this.anchorElement = anchorElement;
    this.targetFieldType = targetFieldType;
    this.onSelect = onSelect;
    this.menuElement = this.createMenuElement();
    this.attachKeyboardListeners();
  }

  /**
   * 创建菜单元素
   */
  private createMenuElement(): HTMLDivElement {
    const menu = document.createElement('div');
    menu.className = 'securefox-identity-menu';
    menu.setAttribute('data-securefox-menu', 'true');

    // 基础样式
    menu.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      max-height: 320px;
      min-width: 280px;
      max-width: 380px;
      overflow: hidden;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      opacity: 0;
      transform: translateY(-8px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      display: flex;
      flex-direction: column;
    `;

    // 创建内容
    this.renderContent(menu);

    return menu;
  }

  /**
   * 渲染菜单内容
   */
  private renderContent(menu: HTMLDivElement): void {
    menu.innerHTML = '';

    if (this.identities.length === 0) {
      // 空状态
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        padding: 24px 16px;
        text-align: center;
        color: #9ca3af;
        font-size: 14px;
      `;
      emptyState.textContent = '没有找到匹配的身份信息';
      menu.appendChild(emptyState);
    } else {
      // 身份信息列表容器
      const listContainer = document.createElement('div');
      listContainer.style.cssText = `
        padding: 8px;
        max-height: 260px;
        overflow-y: auto;
      `;

      // 渲染身份信息项
      this.identities.forEach((identity, index) => {
        const item = this.createIdentityItem(identity, index);
        listContainer.appendChild(item);
      });

      menu.appendChild(listContainer);

      // 底部操作区
      const footer = document.createElement('div');
      footer.style.cssText = `
        padding: 12px 16px;
        background: #f8fafc;
        border-top: 1px solid #e5e7eb;
      `;

      const openVaultBtn = document.createElement('button');
      openVaultBtn.className = 'securefox-open-vault-btn';
      openVaultBtn.textContent = '打开插件';
      openVaultBtn.style.cssText = `
        width: 100%;
        padding: 10px;
        border: none;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        font-size: 14px;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
      `;

      // 悬停效果
      openVaultBtn.addEventListener('mouseenter', () => {
        openVaultBtn.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
        openVaultBtn.style.transform = 'translateY(-1px)';
      });
      openVaultBtn.addEventListener('mouseleave', () => {
        openVaultBtn.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
        openVaultBtn.style.transform = 'translateY(0)';
      });

      // 点击事件
      openVaultBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openVault();
      });

      footer.appendChild(openVaultBtn);
      menu.appendChild(footer);
    }
  }

  /**
   * 创建单个身份信息项
   */
  private createIdentityItem(identity: Identity, index: number): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'securefox-identity-item';
    item.setAttribute('data-index', index.toString());
    item.style.cssText = `
      padding: 12px;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    // 图标 - 身份信息图标
    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25);
    `;
    icon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="7" r="4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    item.appendChild(icon);

    // 文本内容
    const textContent = document.createElement('div');
    textContent.style.cssText = `
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;

    // 获取主要显示信息
    const primaryInfo = this.getPrimaryDisplayInfo(identity);

    textContent.innerHTML = `
      <div style="font-weight: 500; color: #1e293b; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${this.escapeHtml(identity.name)}
      </div>
      <div style="color: #64748b; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${this.escapeHtml(primaryInfo)}
      </div>
    `;
    item.appendChild(textContent);

    // 鼠标悬停效果
    item.addEventListener('mouseenter', () => {
      this.selectItem(index);
    });

    // 点击事件
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectIdentity(identity);
    });

    return item;
  }

  /**
   * 获取主要显示信息
   */
  private getPrimaryDisplayInfo(identity: Identity): string {
    const id = identity.identity;
    if (!id) return '无详细信息';

    // 优先显示邮箱
    if (id.email) return id.email;

    // 其次显示电话
    if (id.phone) return id.phone;

    // 再次显示姓名
    if (id.firstName || id.lastName) {
      const name = [id.firstName, id.middleName, id.lastName].filter(Boolean).join(' ');
      if (name) return name;
    }

    // 最后显示公司
    if (id.company) return id.company;

    return '无详细信息';
  }

  /**
   * 选择某一项（高亮）
   */
  private selectItem(index: number): void {
    // 移除之前的高亮
    const items = this.menuElement.querySelectorAll('.securefox-identity-item');
    items.forEach((item) => {
      (item as HTMLElement).style.background = 'transparent';
    });

    // 高亮当前项
    if (index >= 0 && index < items.length) {
      (items[index] as HTMLElement).style.background = 'rgba(16, 185, 129, 0.1)';
      this.selectedIndex = index;
    }
  }

  /**
   * 选择身份信息
   */
  private selectIdentity(identity: Identity): void {
    this.hide();
    this.onSelect(identity, this.targetFieldType);
  }

  /**
   * 打开插件
   */
  private openVault(): void {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    this.hide();
  }

  /**
   * 键盘导航
   */
  private attachKeyboardListeners(): void {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!this.isVisible) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.moveSelection(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.moveSelection(-1);
          break;
        case 'Enter':
          e.preventDefault();
          if (this.selectedIndex >= 0 && this.selectedIndex < this.identities.length) {
            this.selectIdentity(this.identities[this.selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          this.hide();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // 保存引用以便清理
    (this.menuElement as any)._keydownHandler = handleKeyDown;
  }

  /**
   * 移动选择
   */
  private moveSelection(direction: number): void {
    const newIndex = this.selectedIndex + direction;

    if (newIndex >= 0 && newIndex < this.identities.length) {
      this.selectItem(newIndex);

      // 滚动到可见区域
      const items = this.menuElement.querySelectorAll('.securefox-identity-item');
      (items[newIndex] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * 显示菜单
   */
  show(): void {
    if (this.isVisible) return;

    document.body.appendChild(this.menuElement);
    this.isVisible = true;

    // 定位
    this.updatePosition();

    // 显示动画
    requestAnimationFrame(() => {
      this.menuElement.style.opacity = '1';
      this.menuElement.style.transform = 'translateY(0)';
    });

    // 默认选中第一项
    if (this.identities.length > 0) {
      this.selectItem(0);
    }

    // 点击外部关闭
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 0);
  }

  /**
   * 隐藏菜单
   */
  hide(): void {
    if (!this.isVisible) return;

    this.menuElement.style.opacity = '0';
    this.menuElement.style.transform = 'translateY(-8px)';

    setTimeout(() => {
      if (this.menuElement.parentNode) {
        this.menuElement.parentNode.removeChild(this.menuElement);
      }
      this.isVisible = false;
    }, 200);

    document.removeEventListener('click', this.handleOutsideClick);
  }

  /**
   * 处理外部点击
   */
  private handleOutsideClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    if (!this.menuElement.contains(target) && !this.anchorElement.contains(target)) {
      this.hide();
    }
  };

  /**
   * 更新菜单位置
   */
  private updatePosition(): void {
    const anchorRect = this.anchorElement.getBoundingClientRect();
    const menuRect = this.menuElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // 默认位置：输入框下方
    let top = anchorRect.bottom + 6;
    let left = anchorRect.left;

    // 检查是否超出底部
    if (top + menuRect.height > viewportHeight - 20) {
      // 放在输入框上方
      top = anchorRect.top - menuRect.height - 6;
    }

    // 检查是否超出右侧
    if (left + menuRect.width > viewportWidth - 20) {
      left = viewportWidth - menuRect.width - 20;
    }

    // 确保不超出左侧
    if (left < 20) {
      left = 20;
    }

    this.menuElement.style.top = `${top}px`;
    this.menuElement.style.left = `${left}px`;
  }

  /**
   * 销毁菜单
   */
  destroy(): void {
    this.hide();

    // 清理键盘监听
    const handler = (this.menuElement as any)._keydownHandler;
    if (handler) {
      document.removeEventListener('keydown', handler);
    }

    document.removeEventListener('click', this.handleOutsideClick);
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
