import React, { useState } from 'react';
import { 
  ArrowLeft,
  Lock,
  Moon,
  Sun,
  Globe,
  Bell,
  Shield,
  HelpCircle,
  ChevronRight,
  Info
} from 'lucide-react';
import { useUIStore, useAuthStore } from '@/store';
import { SESSION_CONFIG } from '@/utils/constants';

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { theme, setTheme } = useUIStore();
  const { lock } = useAuthStore();
  const [autoLockMinutes, setAutoLockMinutes] = useState(SESSION_CONFIG.AUTO_LOCK_MINUTES);

  const settingGroups = [
    {
      title: '安全',
      items: [
        {
          icon: Lock,
          label: '立即锁定',
          description: '锁定密码库',
          action: async () => {
            await lock();
          }
        },
        {
          icon: Shield,
          label: '自动锁定',
          description: `${autoLockMinutes} 分钟后自动锁定`,
          value: autoLockMinutes,
          type: 'select'
        }
      ]
    },
    {
      title: '外观',
      items: [
        {
          icon: theme === 'dark' ? Moon : Sun,
          label: '主题',
          description: theme === 'dark' ? '深色模式' : '浅色模式',
          action: () => {
            setTheme(theme === 'dark' ? 'light' : 'dark');
          }
        },
        {
          icon: Globe,
          label: '语言',
          description: '简体中文',
          disabled: true
        }
      ]
    },
    {
      title: '通知',
      items: [
        {
          icon: Bell,
          label: '桌面通知',
          description: '接收重要提醒',
          type: 'toggle',
          value: true
        }
      ]
    },
    {
      title: '关于',
      items: [
        {
          icon: Info,
          label: '版本',
          description: 'v1.0.0',
          disabled: true
        },
        {
          icon: HelpCircle,
          label: '帮助与反馈',
          description: '获取帮助或提供反馈',
          action: () => {
            window.open('https://github.com/securefox/securefox', '_blank');
          }
        }
      ]
    }
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">设置</h1>
      </header>

      {/* Settings List */}
      <div className="flex-1 overflow-y-auto">
        {settingGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-6">
            <h2 className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {group.title}
            </h2>
            <div className="bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
              {group.items.map((item, itemIndex) => (
                <button
                  key={itemIndex}
                  onClick={item.action}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                    item.disabled 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  } ${itemIndex < group.items.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {item.description}
                    </div>
                  </div>

                  {item.type === 'toggle' ? (
                    <div className={`w-11 h-6 rounded-full transition-colors ${
                      item.value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                        item.value ? 'translate-x-5' : 'translate-x-0.5'
                      } mt-0.5`} />
                    </div>
                  ) : item.type === 'select' ? (
                    <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                      <span>{item.value}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  ) : !item.disabled ? (
                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="px-4 py-8 text-center">
          <img 
            src="/icon/128.png" 
            alt="SecureFox" 
            className="w-16 h-16 mx-auto mb-3 rounded-xl"
          />
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">SecureFox</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            本地优先的密码管理器
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            © 2024 SecureFox. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};