import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft,
  Lock,
  Bell,
  Shield,
  HelpCircle,
  ChevronRight,
  Info,
  Link
} from 'lucide-react';
import { useUIStore, useAuthStore } from '@/store';
import { AUTO_LOCK_OPTIONS } from '@/utils/constants';
import { getVersion } from '@/lib/api';
import { UriMatchType } from '@/types';
import { getUserSettings, saveDefaultUriMatchType } from '@/lib/storage';

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { autoLockMinutes, setAutoLockMinutes } = useUIStore();
  const { lock } = useAuthStore();
  const [showAutoLockPicker, setShowAutoLockPicker] = useState(false);
  const [showUriMatchPicker, setShowUriMatchPicker] = useState(false);
  const [defaultUriMatchType, setDefaultUriMatchType] = useState<UriMatchType>(UriMatchType.Domain);

  // Load default URI match type on mount
  useEffect(() => {
    getUserSettings().then(settings => {
      setDefaultUriMatchType(settings.defaultUriMatchType || UriMatchType.Domain);
    });
  }, []);

  const handleUriMatchTypeChange = async (matchType: UriMatchType) => {
    setDefaultUriMatchType(matchType);
    await saveDefaultUriMatchType(matchType);
    setShowUriMatchPicker(false);
  };

  const getUriMatchTypeLabel = (matchType: UriMatchType): string => {
    switch (matchType) {
      case UriMatchType.Domain:
        return '域名匹配';
      case UriMatchType.Host:
        return '主机名匹配';
      case UriMatchType.StartsWith:
        return '前缀匹配';
      case UriMatchType.Exact:
        return '精确匹配';
      case UriMatchType.RegularExpression:
        return '正则表达式';
      case UriMatchType.Never:
        return '从不匹配';
      default:
        return '未知';
    }
  };
  
  // Fetch version from API
  const { data: versionData, isLoading: isVersionLoading } = useQuery({
    queryKey: ['version'],
    queryFn: getVersion,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

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
          action: () => setShowAutoLockPicker(true)
        },
        {
          icon: Link,
          label: 'URI 匹配逻辑',
          description: getUriMatchTypeLabel(defaultUriMatchType),
          action: () => setShowUriMatchPicker(true)
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
          description: isVersionLoading 
            ? '加载中...' 
            : versionData 
              ? `v${versionData.version}${versionData.git_commit ? ` (${versionData.git_commit})` : ''}` 
              : '未知',
          disabled: true
        },
        {
          icon: HelpCircle,
          label: '帮助与反馈',
          description: '获取帮助或提供反馈',
          action: () => {
            window.open('https://github.com/gclm/securefox', '_blank');
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
            src="/icon/securefox-icon.svg"
            alt="SecureFox" 
            className="w-16 h-16 mx-auto mb-3"
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

      {/* Auto-lock Time Picker Modal */}
      {showAutoLockPicker && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setShowAutoLockPicker(false)}
        >
          <div 
            className="w-full bg-white dark:bg-gray-800 rounded-t-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              自动锁定时间
            </h3>
            <div className="space-y-2">
              {AUTO_LOCK_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => {
                    setAutoLockMinutes(minutes);
                    setShowAutoLockPicker(false);
                  }}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    autoLockMinutes === minutes
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {minutes} 分钟
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAutoLockPicker(false)}
              className="w-full mt-4 p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* URI Match Type Picker Modal */}
      {showUriMatchPicker && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setShowUriMatchPicker(false)}
        >
          <div 
            className="w-full bg-white dark:bg-gray-800 rounded-t-xl p-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
              URI 匹配逻辑
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              选择默认的网址匹配方式，与 Bitwarden 兼容
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleUriMatchTypeChange(UriMatchType.Domain)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  defaultUriMatchType === UriMatchType.Domain
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-2 border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">域名匹配（推荐）</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  匹配基础域名，example.com 匹配 app.example.com
                </div>
              </button>
              
              <button
                onClick={() => handleUriMatchTypeChange(UriMatchType.Host)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  defaultUriMatchType === UriMatchType.Host
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-2 border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">主机名匹配</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  精确匹配完整主机名，包含端口
                </div>
              </button>
              
              <button
                onClick={() => handleUriMatchTypeChange(UriMatchType.StartsWith)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  defaultUriMatchType === UriMatchType.StartsWith
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-2 border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">前缀匹配</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  URL 以指定前缀开始
                </div>
              </button>
              
              <button
                onClick={() => handleUriMatchTypeChange(UriMatchType.Exact)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  defaultUriMatchType === UriMatchType.Exact
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-2 border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">精确匹配</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  完全匹配 URL
                </div>
              </button>
              
              <button
                onClick={() => handleUriMatchTypeChange(UriMatchType.RegularExpression)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  defaultUriMatchType === UriMatchType.RegularExpression
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-2 border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">正则表达式</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  使用正则表达式匹配（高级）
                </div>
              </button>
              
              <button
                onClick={() => handleUriMatchTypeChange(UriMatchType.Never)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  defaultUriMatchType === UriMatchType.Never
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-2 border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">从不匹配</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  禁用自动匹配
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowUriMatchPicker(false)}
              className="w-full mt-4 p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
