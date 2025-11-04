import React, {useEffect, useState} from 'react';
import {ArrowLeft, Copy, Edit2, ExternalLink, Eye, EyeOff, Globe, Save, Trash2, X} from 'lucide-react';
import {useUIStore, useVaultStore} from '@/store';
import {Item} from '@/types';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {TOTPCode} from '@/components/TOTPCode';
import {browser} from 'wxt/browser';

interface LoginDetailViewProps {
    onBack: () => void;
}

export const LoginDetailView: React.FC<LoginDetailViewProps> = ({onBack}) => {
    const {selectedItemId, showNotification, closeDetailView} = useUIStore();
    const {items, updateItem, deleteItem} = useVaultStore();

    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showTOTPSecret, setShowTOTPSecret] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const item = items.find(i => i.id === selectedItemId);

    const [form, setForm] = useState({
        name: '',
        username: '',
        password: '',
        totp: '',
        urls: [''] as string[],
        notes: '',
    });

    useEffect(() => {
        if (item && item.login) {
            setForm({
                name: item.name || '',
                username: item.login.username || '',
                password: item.login.password || '',
                totp: item.login.totp || '',
                urls: item.login.uris && item.login.uris.length > 0
                    ? item.login.uris.map(u => u.uri)
                    : [''],
                notes: item.notes || '',
            });
        }
    }, [item]);

    const handleCopy = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        showNotification({
            type: 'success',
            title: '已复制',
            message: `${field}已复制到剪贴板`,
        });
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleSave = async () => {
        if (!item) return;

        if (!form.name || !form.username) {
            showNotification({
                type: 'warning',
                title: '请填写必填字段',
                message: '名称和用户名不能为空',
            });
            return;
        }

        setIsLoading(true);

        try {
            const updatedItem: Item = {
                ...item,
                name: form.name,
                login: {
                    ...item.login,
                    username: form.username,
                    password: form.password,
                    totp: form.totp || undefined,
                    uris: form.urls
                        .filter(url => url.trim())
                        .map(url => ({uri: url.trim()})),
                },
                notes: form.notes,
            };

            const success = await updateItem(updatedItem);

            if (success) {
                showNotification({
                    type: 'success',
                    title: '保存成功',
                    message: '登录信息已更新',
                });
                setIsEditing(false);
            } else {
                showNotification({
                    type: 'error',
                    title: '保存失败',
                    message: '请稍后重试',
                });
            }
        } catch (error) {
            showNotification({
                type: 'error',
                title: '保存失败',
                message: '发生错误，请稍后重试',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!item) return;

        if (!confirm(`确定要删除"${item.name}"吗？此操作无法撤销。`)) {
            return;
        }

        setIsLoading(true);

        try {
            const success = await deleteItem(item.id);

            if (success) {
                showNotification({
                    type: 'success',
                    title: '删除成功',
                    message: '登录项已删除',
                });
                closeDetailView();
                onBack();
            } else {
                showNotification({
                    type: 'error',
                    title: '删除失败',
                    message: '请稍后重试',
                });
            }
        } catch (error) {
            showNotification({
                type: 'error',
                title: '删除失败',
                message: '发生错误，请稍后重试',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        if (item && item.login) {
            setForm({
                name: item.name || '',
                username: item.login.username || '',
                password: item.login.password || '',
                totp: item.login.totp || '',
                urls: item.login.uris && item.login.uris.length > 0
                    ? item.login.uris.map(u => u.uri)
                    : [''],
                notes: item.notes || '',
            });
        }
        setIsEditing(false);
    };

    // 手动填充当前网站地址
    const handleFillCurrentUrl = async () => {
        try {
            const tabs = await browser.tabs.query({active: true, currentWindow: true});
            if (tabs[0]?.url) {
                const url = tabs[0].url;
                // 只在 http/https 协议下填充
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    setForm(prev => ({...prev, urls: [...prev.urls, url]}));
                    showNotification({
                        type: 'success',
                        title: '已添加',
                        message: '当前网站地址已添加',
                    });
                } else {
                    showNotification({
                        type: 'warning',
                        title: '无效地址',
                        message: '当前页面不是有效的网站地址',
                    });
                }
            }
        } catch (error) {
            showNotification({
                type: 'error',
                title: '获取失败',
                message: '无法获取当前页面地址',
            });
        }
    };

    if (!item) {
        return (
            <div className="flex flex-col h-screen bg-gray-50">
                <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600"/>
                    </button>
                    <h1 className="text-lg font-semibold text-gray-800">未找到项目</h1>
                </header>
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500">该登录项不存在</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600"/>
                    </button>
                    <h1 className="text-lg font-semibold text-gray-800">
                        {isEditing ? '编辑登录' : '登录详情'}
                    </h1>
                </div>

                {!isEditing && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="编辑"
                        >
                            <Edit2 className="w-5 h-5 text-gray-600"/>
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                            title="删除"
                            disabled={isLoading}
                        >
                            <Trash2 className="w-5 h-5 text-red-500"/>
                        </button>
                    </div>
                )}
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {isEditing ? (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="edit-name">名称 *</Label>
                            <Input
                                id="edit-name"
                                value={form.name}
                                onChange={(e) => setForm({...form, name: e.target.value})}
                                placeholder="例如：GitHub"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="edit-username">用户名 *</Label>
                            <Input
                                id="edit-username"
                                value={form.username}
                                onChange={(e) => setForm({...form, username: e.target.value})}
                                placeholder="用户名或邮箱"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="edit-password">密码</Label>
                            <div className="relative">
                                <Input
                                    id="edit-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={(e) => setForm({...form, password: e.target.value})}
                                    placeholder="密码"
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4 text-gray-400"/>
                                    ) : (
                                        <Eye className="w-4 h-4 text-gray-400"/>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="edit-totp">2FA 验证码 (TOTP)</Label>
                            <Input
                                id="edit-totp"
                                value={form.totp}
                                onChange={(e) => setForm({...form, totp: e.target.value})}
                                placeholder="otpauth://totp/..."
                            />
                            <p className="text-xs text-gray-500 mt-1">两步验证密钥</p>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label>网址</Label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleFillCurrentUrl}
                                        className="text-xs text-green-500 hover:text-green-600 transition-colors"
                                        title="填充当前网站地址"
                                    >
                                        🌐 填充当前
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({...form, urls: [...form.urls, '']})}
                                        className="text-xs text-blue-500 hover:text-blue-600"
                                    >
                                        + 添加网址
                                    </button>
                                </div>
                            </div>
                            {form.urls.map((url, index) => (
                                <div key={index} className="flex gap-2 mb-2">
                                    <Input
                                        value={url}
                                        onChange={(e) => {
                                            const newUrls = [...form.urls];
                                            newUrls[index] = e.target.value;
                                            setForm({...form, urls: newUrls});
                                        }}
                                        placeholder="https://example.com"
                                    />
                                    {form.urls.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newUrls = form.urls.filter((_, i) => i !== index);
                                                setForm({...form, urls: newUrls});
                                            }}
                                            className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm"
                                        >
                                            删除
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div>
                            <Label htmlFor="edit-notes">备注</Label>
                            <textarea
                                id="edit-notes"
                                value={form.notes}
                                onChange={(e) => setForm({...form, notes: e.target.value})}
                                placeholder="添加备注..."
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows={4}
                            />
                        </div>

                        {/* Edit Actions */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="button"
                                onClick={handleCancel}
                                className="flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300"
                                disabled={isLoading}
                            >
                                <X className="w-4 h-4 mr-2"/>
                                取消
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                className="flex-1 bg-blue-500 text-white hover:bg-blue-600"
                                disabled={isLoading}
                            >
                                <Save className="w-4 h-4 mr-2"/>
                                {isLoading ? '保存中...' : '保存'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Icon and Name */}
                        <div className="flex items-center gap-4">
                            <div
                                className="w-16 h-16 flex-shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                <Globe className="w-8 h-8 text-white"/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-2xl font-bold text-gray-800 break-words">{item.name}</h2>
                            </div>
                        </div>

                        {/* Username */}
                        {item.login?.username && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-xs text-gray-500">用户名</Label>
                                    <button
                                        onClick={() => handleCopy(item.login!.username || '', '用户名')}
                                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <Copy
                                            className={`w-4 h-4 ${copiedField === '用户名' ? 'text-green-500' : 'text-gray-400'}`}/>
                                    </button>
                                </div>
                                <p className="text-gray-800 font-medium break-all">{item.login.username}</p>
                            </div>
                        )}

                        {/* TOTP */}
                        {item.login?.totp && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <Label className="text-xs text-gray-500 mb-3 block">2FA 验证码</Label>

                                {/* 验证码显示 */}
                                <TOTPCode
                                    entryId={item.id}
                                    onCopy={async () => {
                                        const code = document.querySelector('.text-3xl')?.textContent?.replace(/\s/g, '') || '';
                                        await handleCopy(code, '验证码');
                                    }}
                                />

                                {/* TOTP密钥显示 */}
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs text-gray-500">TOTP密钥</Label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowTOTPSecret(!showTOTPSecret)}
                                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                                title={showTOTPSecret ? '隐藏密钥' : '显示密钥'}
                                            >
                                                {showTOTPSecret ? (
                                                    <EyeOff className="w-4 h-4 text-gray-400"/>
                                                ) : (
                                                    <Eye className="w-4 h-4 text-gray-400"/>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleCopy(item.login!.totp || '', 'TOTP密钥')}
                                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="复制密钥"
                                            >
                                                <Copy
                                                    className={`w-4 h-4 ${copiedField === 'TOTP密钥' ? 'text-green-500' : 'text-gray-400'}`}/>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-gray-800 text-sm font-mono break-all mt-2">
                                        {showTOTPSecret ? item.login.totp : '••••••••••••••••••••'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Password */}
                        {item.login?.password && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-xs text-gray-500">密码</Label>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-4 h-4 text-gray-400"/>
                                            ) : (
                                                <Eye className="w-4 h-4 text-gray-400"/>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleCopy(item.login!.password || '', '密码')}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <Copy
                                                className={`w-4 h-4 ${copiedField === '密码' ? 'text-green-500' : 'text-gray-400'}`}/>
                                        </button>
                                    </div>
                                </div>
                                <p className="text-gray-800 font-mono break-all">
                                    {showPassword ? item.login.password : '••••••••••••'}
                                </p>
                            </div>
                        )}

                        {/* Notes */}
                        {item.notes && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <Label className="text-xs text-gray-500 mb-2 block">备注</Label>
                                <p className="text-gray-800 whitespace-pre-wrap break-all">{item.notes}</p>
                            </div>
                        )}

                        {/* URLs */}
                        {item.login?.uris && item.login.uris.length > 0 && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <Label className="text-xs text-gray-500 mb-3 block">网址</Label>
                                <div className="space-y-2">
                                    {item.login.uris.map((uri, index) => (
                                        <div key={index}
                                             className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-blue-50 transition-colors">
                                            <div className="flex-1 min-w-0 mr-3">
                                                <p className="text-gray-800 text-sm break-all">{uri.uri}</p>
                                            </div>
                                            <button
                                                onClick={() => window.open(uri.uri, '_blank')}
                                                className="flex-shrink-0 p-1.5 hover:bg-blue-100 rounded transition-colors"
                                                title="打开网址"
                                            >
                                                <ExternalLink className="w-4 h-4 text-blue-500"/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Metadata */}
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">创建时间</span>
                                    <span className="text-gray-800">
                    {new Date(item.creationDate).toLocaleString('zh-CN')}
                  </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">修改时间</span>
                                    <span className="text-gray-800">
                    {new Date(item.revisionDate).toLocaleString('zh-CN')}
                  </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
