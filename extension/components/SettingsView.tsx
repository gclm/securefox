import React, {useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {
    ArrowLeft,
    Bell,
    ChevronRight,
    Globe,
    HelpCircle,
    Info,
    Link,
    Lock,
    LucideIcon,
    MousePointer,
    Shield,
    Zap
} from 'lucide-react';
import {useAuthStore, useUIStore} from '@/store';
import {AUTO_LOCK_OPTIONS} from '@/utils/constants';
import {getVersion} from '@/lib/api';
import {UriMatchType} from '@/types';
import {getUserSettings, saveDefaultUriMatchType} from '@/lib/storage';

interface SettingsViewProps {
    onBack: () => void;
}

type SettingItem =
    | {
    icon: LucideIcon;
    label: string;
    description: string;
    type: 'toggle';
    value: boolean;
    action?: never;
    disabled?: never;
}
    | {
    icon: LucideIcon;
    label: string;
    description: string;
    disabled: true;
    type?: never;
    value?: never;
    action?: never;
}
    | {
    icon: LucideIcon;
    label: string;
    description: string;
    action: () => void | Promise<void>;
    type?: never;
    value?: never;
    disabled?: never;
};

export const SettingsView: React.FC<SettingsViewProps> = ({onBack}) => {
    const {
        autoLockMinutes,
        setAutoLockMinutes,
        clickToFill,
        setClickToFill,
        showQuickCopy,
        setShowQuickCopy,
        autofillOnPageLoad,
        setAutofillOnPageLoad
    } = useUIStore();
    const {lock} = useAuthStore();
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

    const getAutoLockLabel = (minutes: number): string => {
        if (minutes === -1) {
            return '跟随浏览器关闭';
        } else if (minutes === 15) {
            return '15 分钟';
        } else if (minutes === 60) {
            return '1 小时';
        } else if (minutes === 360) {
            return '6 小时';
        } else {
            return `${minutes} 分钟`;
        }
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
    const {data: versionData, isLoading: isVersionLoading} = useQuery({
        queryKey: ['version'],
        queryFn: getVersion,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const settingGroups: Array<{ title: string; items: SettingItem[] }> = [
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
                    description: getAutoLockLabel(autoLockMinutes),
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
            title: '用户体验',
            items: [
                {
                    icon: MousePointer,
                    label: '点击直接填充',
                    description: '点击列表项直接填充凭据',
                    type: 'toggle',
                    value: clickToFill,
                    action: async () => {
                        await setClickToFill(!clickToFill);
                    }
                },
                {
                    icon: Zap,
                    label: '快速复制按钮',
                    description: '在列表中显示快速复制按钮',
                    type: 'toggle',
                    value: showQuickCopy,
                    action: async () => {
                        await setShowQuickCopy(!showQuickCopy);
                    }
                },
                {
                    icon: Globe,
                    label: '页面加载自动填充',
                    description: '自动填充匹配的凭据',
                    type: 'toggle',
                    value: autofillOnPageLoad,
                    action: async () => {
                        await setAutofillOnPageLoad(!autofillOnPageLoad);
                    }
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
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600"/>
                </button>
                <h1 className="text-lg font-semibold text-gray-800">设置</h1>
            </header>

            {/* Settings List */}
            <div className="flex-1 overflow-y-auto">
                {settingGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="mb-6">
                        <h2 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {group.title}
                        </h2>
                        <div className="bg-white border-y border-gray-200">
                            {group.items.map((item, itemIndex) => (
                                <button
                                    key={itemIndex}
                                    onClick={'action' in item ? item.action : undefined}
                                    disabled={'disabled' in item ? item.disabled : false}
                                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                                        item.disabled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-gray-50'
                                    } ${itemIndex < group.items.length - 1 ? 'border-b border-gray-100' : ''}`}
                                >
                                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                                        <item.icon className="w-5 h-5 text-gray-600"/>
                                    </div>

                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-medium text-gray-800">
                                            {item.label}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {item.description}
                                        </div>
                                    </div>

                                    {'type' in item && item.type === 'toggle' ? (
                                        <div className={`w-11 h-6 rounded-full transition-colors ${
                                            item.value ? 'bg-blue-500' : 'bg-gray-300'
                                        }`}>
                                            <div
                                                className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                                                    item.value ? 'translate-x-5' : 'translate-x-0.5'
                                                } mt-0.5`}/>
                                        </div>
                                    ) : !('disabled' in item && item.disabled) ? (
                                        <ChevronRight className="w-4 h-4 text-gray-400"/>
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
                    <h3 className="font-semibold text-gray-800 mb-1">SecureFox</h3>
                    <p className="text-xs text-gray-500">
                        本地优先的密码管理器
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
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
                        className="w-full bg-white rounded-t-xl p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">
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
                                            ? 'bg-blue-50 text-blue-600 font-medium'
                                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    {getAutoLockLabel(minutes)}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowAutoLockPicker(false)}
                            className="w-full mt-4 p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
                        className="w-full bg-white rounded-t-xl p-4 max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            URI 匹配逻辑
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                            选择默认的网址匹配方式，与 Bitwarden 兼容
                        </p>
                        <div className="space-y-2">
                            <button
                                onClick={() => handleUriMatchTypeChange(UriMatchType.Domain)}
                                className={`w-full p-3 rounded-lg text-left transition-colors ${
                                    defaultUriMatchType === UriMatchType.Domain
                                        ? 'bg-blue-50 text-blue-600 border-2 border-blue-500'
                                        : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                                }`}
                            >
                                <div className="font-medium">域名匹配（推荐）</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    匹配基础域名，example.com 匹配 app.example.com
                                </div>
                            </button>

                            <button
                                onClick={() => handleUriMatchTypeChange(UriMatchType.Host)}
                                className={`w-full p-3 rounded-lg text-left transition-colors ${
                                    defaultUriMatchType === UriMatchType.Host
                                        ? 'bg-blue-50 text-blue-600 border-2 border-blue-500'
                                        : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                                }`}
                            >
                                <div className="font-medium">主机名匹配</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    精确匹配完整主机名，包含端口
                                </div>
                            </button>

                            <button
                                onClick={() => handleUriMatchTypeChange(UriMatchType.StartsWith)}
                                className={`w-full p-3 rounded-lg text-left transition-colors ${
                                    defaultUriMatchType === UriMatchType.StartsWith
                                        ? 'bg-blue-50 text-blue-600 border-2 border-blue-500'
                                        : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                                }`}
                            >
                                <div className="font-medium">前缀匹配</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    URL 以指定前缀开始
                                </div>
                            </button>

                            <button
                                onClick={() => handleUriMatchTypeChange(UriMatchType.Exact)}
                                className={`w-full p-3 rounded-lg text-left transition-colors ${
                                    defaultUriMatchType === UriMatchType.Exact
                                        ? 'bg-blue-50 text-blue-600 border-2 border-blue-500'
                                        : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                                }`}
                            >
                                <div className="font-medium">精确匹配</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    完全匹配 URL
                                </div>
                            </button>

                            <button
                                onClick={() => handleUriMatchTypeChange(UriMatchType.RegularExpression)}
                                className={`w-full p-3 rounded-lg text-left transition-colors ${
                                    defaultUriMatchType === UriMatchType.RegularExpression
                                        ? 'bg-blue-50 text-blue-600 border-2 border-blue-500'
                                        : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                                }`}
                            >
                                <div className="font-medium">正则表达式</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    使用正则表达式匹配（高级）
                                </div>
                            </button>

                            <button
                                onClick={() => handleUriMatchTypeChange(UriMatchType.Never)}
                                className={`w-full p-3 rounded-lg text-left transition-colors ${
                                    defaultUriMatchType === UriMatchType.Never
                                        ? 'bg-blue-50 text-blue-600 border-2 border-blue-500'
                                        : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                                }`}
                            >
                                <div className="font-medium">从不匹配</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    禁用自动匹配
                                </div>
                            </button>
                        </div>
                        <button
                            onClick={() => setShowUriMatchPicker(false)}
                            className="w-full mt-4 p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
