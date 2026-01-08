/**
 * 内联自动填充图标组件
 * 在输入框右侧内嵌一个小图标，点击显示凭据选择菜单
 */

export class InlineAutofillIcon {
  private iconButton: HTMLButtonElement;
  private inputElement: HTMLInputElement;
  private onClick: () => void;
  private isVisible: boolean = false;
  private color: string;

  constructor(inputElement: HTMLInputElement, onClick: () => void, color: string = '#3b82f6') {
    this.inputElement = inputElement;
    this.onClick = onClick;
    this.color = color;
    this.iconButton = this.createIconButton();
  }

  /**
   * 创建图标按钮
   */
  private createIconButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'securefox-autofill-icon';
    button.setAttribute('data-securefox-icon', 'true');
    button.setAttribute('aria-label', 'SecureFox 自动填充');
    button.setAttribute('title', 'SecureFox 自动填充');

    // 样式
    button.style.cssText = `
      position: absolute;
      top: 50%;
      right: 8px;
      transform: translateY(-50%);
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      padding: 0;
      z-index: 999998;
      transition: all 0.2s ease;
      opacity: 0;
      pointer-events: none;
    `;

    // 生成渐变色的 lighter 和 darker 变体
    const lighterColor = this.adjustColor(this.color, 40);
    const darkerColor = this.adjustColor(this.color, -20);
    const gradientId = `sf-gradient-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // SecureFox logo SVG（简化版）
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${gradientId}" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" style="stop-color:${lighterColor};stop-opacity:1"/>
            <stop offset="100%" style="stop-color:${this.color};stop-opacity:1"/>
          </linearGradient>
        </defs>
        <g transform="translate(256, 320) scale(1.2)">
          <path fill="url(#${gradientId})" d="M -140 -160 L -100 -220 L -60 -180 Q -80 -140, -100 -130 C -110 -125, -130 -135, -140 -160 Z"/>
          <path fill="url(#${gradientId})" d="M 140 -160 L 100 -220 L 60 -180 Q 80 -140, 100 -130 C 110 -125, 130 -135, 140 -160 Z"/>
          <ellipse cx="0" cy="-60" fill="url(#${gradientId})" rx="150" ry="130"/>
          <path fill="${darkerColor}" d="M -100 0 Q -50 60, 0 80 Q 50 60, 100 0 L 100 -40 L -100 -40 Z"/>
          <path fill="#1E293B" d="M -150 -60 Q -100 -80, -50 -70 Q 0 -60, 50 -70 Q 100 -80, 150 -60 L 150 -40 Q 100 -30, 50 -35 Q 0 -40, -50 -35 Q -100 -30, -150 -40 Z"/>
          <circle cx="-50" cy="-60" r="15" fill="#FFF"/>
          <circle cx="-50" cy="-60" r="8" fill="#1E293B"/>
          <circle cx="50" cy="-60" r="15" fill="#FFF"/>
          <circle cx="50" cy="-60" r="8" fill="#1E293B"/>
          <path fill="#1E293B" d="M -8 20 Q 0 12, 8 20 Q 0 28, -8 20 Z"/>
        </g>
      </svg>
    `;

    // 鼠标悬停效果（使用自定义颜色的透明版本）
    button.addEventListener('mouseenter', () => {
      button.style.background = this.hexToRgba(this.color, 0.1);
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'transparent';
    });

    // 点击事件
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onClick();
    });

    // 防止触发输入框的 focus
    button.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    return button;
  }

  /**
   * 调整颜色亮度
   * @param hex - 十六进制颜色（如 #3b82f6）
   * @param amount - 调整量（正数变亮，负数变暗）
   * @returns 调整后的十六进制颜色
   */
  private adjustColor(hex: string, amount: number): string {
    const color = hex.replace('#', '');
    const num = parseInt(color, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  /**
   * 将十六进制颜色转换为 RGBA
   * @param hex - 十六进制颜色（如 #3b82f6）
   * @param alpha - 透明度（0-1）
   * @returns RGBA 颜色字符串
   */
  private hexToRgba(hex: string, alpha: number): string {
    const color = hex.replace('#', '');
    const num = parseInt(color, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 0x00FF;
    const b = num & 0x0000FF;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * 显示图标
   */
  show(): void {
    if (this.isVisible) return;

    // 获取输入框的父容器
    const parent = this.inputElement.parentElement;
    if (!parent) return;

    // 检查父容器的定位方式
    const parentStyle = window.getComputedStyle(parent);
    const inputStyle = window.getComputedStyle(this.inputElement);
    
    // 确定插入位置
    let targetContainer: HTMLElement;
    
    if (parentStyle.position !== 'static') {
      // 父容器有定位，图标相对父容器定位
      targetContainer = parent;
    } else if (inputStyle.position !== 'static') {
      // 输入框自身有定位，图标相对输入框定位
      this.inputElement.style.position = 'relative';
      targetContainer = this.inputElement.parentElement!;
    } else {
      // 都是 static，给输入框包裹一个相对定位的容器
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.width = '100%';
      
      // 替换输入框位置
      parent.insertBefore(wrapper, this.inputElement);
      wrapper.appendChild(this.inputElement);
      
      targetContainer = wrapper;
    }

    // 计算图标位置（相对于输入框）
    const inputRect = this.inputElement.getBoundingClientRect();
    const containerRect = targetContainer.getBoundingClientRect();
    
    // 设置图标位置为相对于输入框右侧
    this.iconButton.style.position = 'absolute';
    this.iconButton.style.right = '8px';
    this.iconButton.style.top = '50%';
    this.iconButton.style.transform = 'translateY(-50%)';
    
    // 插入图标到容器
    targetContainer.appendChild(this.iconButton);

    // 显示动画
    requestAnimationFrame(() => {
      this.iconButton.style.opacity = '1';
      this.iconButton.style.pointerEvents = 'auto';
    });

    this.isVisible = true;
  }

  /**
   * 隐藏图标
   */
  hide(): void {
    if (!this.isVisible) return;

    this.iconButton.style.opacity = '0';
    this.iconButton.style.pointerEvents = 'none';

    setTimeout(() => {
      if (this.iconButton.parentNode) {
        this.iconButton.parentNode.removeChild(this.iconButton);
      }
      this.isVisible = false;
    }, 200);
  }

  /**
   * 移除图标
   */
  destroy(): void {
    if (this.iconButton.parentNode) {
      this.iconButton.parentNode.removeChild(this.iconButton);
    }
    this.isVisible = false;
  }

  /**
   * 检查是否可见
   */
  isShown(): boolean {
    return this.isVisible;
  }

  /**
   * 获取图标元素
   */
  getElement(): HTMLButtonElement {
    return this.iconButton;
  }

  /**
   * 更新图标位置
   */
  updatePosition(): void {
    if (!this.isVisible) return;

    const rect = this.inputElement.getBoundingClientRect();
    const parentRect = this.inputElement.offsetParent?.getBoundingClientRect();

    if (parentRect) {
      this.iconButton.style.top = `${rect.top - parentRect.top + rect.height / 2}px`;
      this.iconButton.style.right = `${parentRect.right - rect.right + 8}px`;
    }
  }
}
