/**
 * 凭据选择菜单组件
 * 显示匹配凭据列表，支持搜索、键盘导航
 */

interface Credential {
  id: string;
  name: string;
  login?: {
    username?: string;
    password?: string;
  };
}

export class CredentialMenu {
  private menuElement: HTMLDivElement;
  private credentials: Credential[];
  private onSelect: (credential: Credential) => void;
  private anchorElement: HTMLElement;
  private selectedIndex: number = -1;
  private isVisible: boolean = false;

  constructor(
    credentials: Credential[],
    anchorElement: HTMLElement,
    onSelect: (credential: Credential) => void
  ) {
    this.credentials = credentials;
    this.anchorElement = anchorElement;
    this.onSelect = onSelect;
    this.menuElement = this.createMenuElement();
    this.attachKeyboardListeners();
  }

  /**
   * 创建菜单元素
   */
  private createMenuElement(): HTMLDivElement {
    const menu = document.createElement('div');
    menu.className = 'securefox-credential-menu';
    menu.setAttribute('data-securefox-menu', 'true');

    // 基础样式
    menu.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
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

    // 头部
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f9fafb;
    `;
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C9.243 2 7 4.243 7 7V10H6C4.895 10 4 10.895 4 12V20C4 21.105 4.895 22 6 22H18C19.105 22 20 21.105 20 20V12C20 10.895 19.105 10 18 10H17V7C17 4.243 14.757 2 12 2ZM9 7C9 5.346 10.346 4 12 4C13.654 4 15 5.346 15 7V10H9V7Z" 
                fill="#3b82f6"/>
        </svg>
        <span style="font-weight: 600; color: #374151; font-size: 14px;">SecureFox</span>
      </div>
      <span style="color: #9ca3af; font-size: 12px;">${this.credentials.length} 项</span>
    `;
    menu.appendChild(header);

    // 凭据列表容器
    const listContainer = document.createElement('div');
    listContainer.style.cssText = `
      overflow-y: auto;
      max-height: 240px;
    `;

    if (this.credentials.length === 0) {
      // 空状态
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        padding: 32px 16px;
        text-align: center;
        color: #9ca3af;
        font-size: 14px;
      `;
      emptyState.textContent = '没有找到匹配的凭据';
      listContainer.appendChild(emptyState);
    } else {
      // 渲染凭据项
      this.credentials.forEach((credential, index) => {
        const item = this.createCredentialItem(credential, index);
        listContainer.appendChild(item);
      });
    }

    menu.appendChild(listContainer);

    // 底部操作栏
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 8px;
      border-top: 1px solid #e5e5e5;
      background: #f9fafb;
    `;
    footer.innerHTML = `
      <button class="securefox-menu-action" data-action="open-vault" style="
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: transparent;
        color: #3b82f6;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background 0.2s;
      " onmouseover="this.style.background='rgba(59, 130, 246, 0.1)'" onmouseout="this.style.background='transparent'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11M15 3H21M21 3V9M21 3L10 14" 
                stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        在插件中打开
      </button>
    `;
    menu.appendChild(footer);

    // 底部操作事件
    const openVaultBtn = footer.querySelector('[data-action="open-vault"]');
    openVaultBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openVault();
    });
  }

  /**
   * 创建单个凭据项
   */
  private createCredentialItem(credential: Credential, index: number): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'securefox-credential-item';
    item.setAttribute('data-index', index.toString());
    item.style.cssText = `
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
      transition: background 0.15s;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    // 图标
    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 16px;
    `;
    icon.textContent = credential.name.charAt(0).toUpperCase();
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
    textContent.innerHTML = `
      <div style="font-weight: 500; color: #111827; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${this.escapeHtml(credential.name)}
      </div>
      <div style="color: #6b7280; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${this.escapeHtml(credential.login?.username || '无用户名')}
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
      this.selectCredential(credential);
    });

    return item;
  }

  /**
   * 选择某一项（高亮）
   */
  private selectItem(index: number): void {
    // 移除之前的高亮
    const items = this.menuElement.querySelectorAll('.securefox-credential-item');
    items.forEach((item) => {
      (item as HTMLElement).style.background = 'transparent';
    });

    // 高亮当前项
    if (index >= 0 && index < items.length) {
      (items[index] as HTMLElement).style.background = '#eff6ff';
      this.selectedIndex = index;
    }
  }

  /**
   * 选择凭据
   */
  private selectCredential(credential: Credential): void {
    this.hide();
    this.onSelect(credential);
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
          if (this.selectedIndex >= 0 && this.selectedIndex < this.credentials.length) {
            this.selectCredential(this.credentials[this.selectedIndex]);
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
    
    if (newIndex >= 0 && newIndex < this.credentials.length) {
      this.selectItem(newIndex);
      
      // 滚动到可见区域
      const items = this.menuElement.querySelectorAll('.securefox-credential-item');
      (items[newIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
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
    if (this.credentials.length > 0) {
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
    let top = anchorRect.bottom + 4;
    let left = anchorRect.left;

    // 检查是否超出底部
    if (top + menuRect.height > viewportHeight - 16) {
      // 放在输入框上方
      top = anchorRect.top - menuRect.height - 4;
    }

    // 检查是否超出右侧
    if (left + menuRect.width > viewportWidth - 16) {
      left = viewportWidth - menuRect.width - 16;
    }

    // 确保不超出左侧
    if (left < 16) {
      left = 16;
    }

    this.menuElement.style.top = `${top}px`;
    this.menuElement.style.left = `${left}px`;
  }

  /**
   * 打开插件
   */
  private openVault(): void {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    this.hide();
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
