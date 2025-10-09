import React, {useState} from 'react';
import {CreditCard, Eye, EyeOff, FileText, Key, User, X, Zap} from 'lucide-react';
import {useUIStore, useVaultStore} from '@/store';
import {ItemType} from '@/types';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {PasswordGenerator} from '@/components/PasswordGenerator';

export const AddItemModal: React.FC = () => {
    const {isAddItemModalOpen, setAddItemModalOpen, showNotification} = useUIStore();
    const {addItem} = useVaultStore();

    const [itemType, setItemType] = useState<ItemType>(ItemType.Login);
    const [isLoading, setIsLoading] = useState(false);
    const [showPasswordGenerator, setShowPasswordGenerator] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // 登录表单
    const [loginForm, setLoginForm] = useState({
        name: '',
        username: '',
        password: '',
        totp: '',
        urls: [''] as string[],
        notes: '',
    });

    // 信用卡表单
    const [cardForm, setCardForm] = useState({
        name: '',
        cardholderName: '',
        number: '',
        expMonth: '',
        expYear: '',
        code: '',
        brand: '',
        notes: '',
    });

    // 笔记表单
    const [noteForm, setNoteForm] = useState({
        name: '',
        notes: '',
    });

    const handleClose = () => {
        setAddItemModalOpen(false);
        // 重置表单
        setLoginForm({name: '', username: '', password: '', totp: '', urls: [''], notes: ''});
        setCardForm({
            name: '',
            cardholderName: '',
            number: '',
            expMonth: '',
            expYear: '',
            code: '',
            brand: '',
            notes: ''
        });
        setNoteForm({name: '', notes: ''});
        setItemType(ItemType.Login);
        setShowPasswordGenerator(false);
        setShowPassword(false);
    };

    const handleUsePassword = (password: string) => {
        setLoginForm({...loginForm, password});
        setShowPasswordGenerator(false);
        showNotification({
            type: 'success',
            title: '密码已填充',
            message: '密码已自动填充到表单',
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            let itemData: any = {type: itemType};

            if (itemType === ItemType.Login) {
                if (!loginForm.name || !loginForm.username) {
                    showNotification({
                        type: 'warning',
                        title: '请填写必填字段',
                        message: '名称和用户名不能为空',
                    });
                    setIsLoading(false);
                    return;
                }

                itemData = {
                    ...itemData,
                    name: loginForm.name,
                    login: {
                        username: loginForm.username,
                        password: loginForm.password,
                        totp: loginForm.totp || undefined,
                        uris: loginForm.urls
                            .filter(url => url.trim())
                            .map(url => ({uri: url.trim()})),
                    },
                    notes: loginForm.notes,
                };
            } else if (itemType === ItemType.Card) {
                if (!cardForm.name || !cardForm.number) {
                    showNotification({
                        type: 'warning',
                        title: '请填写必填字段',
                        message: '名称和卡号不能为空',
                    });
                    setIsLoading(false);
                    return;
                }

                itemData = {
                    ...itemData,
                    name: cardForm.name,
                    card: {
                        cardholderName: cardForm.cardholderName,
                        number: cardForm.number,
                        expMonth: cardForm.expMonth,
                        expYear: cardForm.expYear,
                        code: cardForm.code,
                        brand: cardForm.brand,
                    },
                    notes: cardForm.notes,
                };
            } else if (itemType === ItemType.SecureNote) {
                if (!noteForm.name) {
                    showNotification({
                        type: 'warning',
                        title: '请填写必填字段',
                        message: '名称不能为空',
                    });
                    setIsLoading(false);
                    return;
                }

                itemData = {
                    ...itemData,
                    name: noteForm.name,
                    notes: noteForm.notes,
                };
            }

            const result = await addItem(itemData);

            if (result) {
                showNotification({
                    type: 'success',
                    title: '添加成功',
                    message: '密码项已成功添加',
                });
                handleClose();
            } else {
                showNotification({
                    type: 'error',
                    title: '添加失败',
                    message: '请稍后重试',
                });
            }
        } catch (error) {
            showNotification({
                type: 'error',
                title: '添加失败',
                message: '发生错误，请稍后重试',
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAddItemModalOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
                {/* Header */}
                <div
                    className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">添加密码项</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-600"/>
                    </button>
                </div>

                {/* Type Selection */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <Label className="mb-3 block">类型</Label>
                    <div className="grid grid-cols-4 gap-2">
                        <button
                            type="button"
                            onClick={() => setItemType(ItemType.Login)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                itemType === ItemType.Login
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <Key
                                className={`w-6 h-6 ${itemType === ItemType.Login ? 'text-blue-500' : 'text-gray-400'}`}/>
                            <span className="text-xs">登录</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setItemType(ItemType.Card)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                itemType === ItemType.Card
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <CreditCard
                                className={`w-6 h-6 ${itemType === ItemType.Card ? 'text-blue-500' : 'text-gray-400'}`}/>
                            <span className="text-xs">信用卡</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setItemType(ItemType.SecureNote)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                itemType === ItemType.SecureNote
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <FileText
                                className={`w-6 h-6 ${itemType === ItemType.SecureNote ? 'text-blue-500' : 'text-gray-400'}`}/>
                            <span className="text-xs">笔记</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setItemType(ItemType.Identity)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                itemType === ItemType.Identity
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                            disabled
                        >
                            <User className="w-6 h-6 text-gray-300"/>
                            <span className="text-xs text-gray-400">身份</span>
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                    {/* Login Form */}
                    {itemType === ItemType.Login && (
                        <>
                            <div>
                                <Label htmlFor="login-name">名称 *</Label>
                                <Input
                                    id="login-name"
                                    value={loginForm.name}
                                    onChange={(e) => setLoginForm({...loginForm, name: e.target.value})}
                                    placeholder="例如：GitHub"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="login-username">用户名 *</Label>
                                <Input
                                    id="login-username"
                                    value={loginForm.username}
                                    onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                                    placeholder="用户名或邮箱"
                                    required
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label htmlFor="login-password">密码</Label>
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordGenerator(!showPasswordGenerator)}
                                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors"
                                    >
                                        <Zap className="w-3 h-3"/>
                                        {showPasswordGenerator ? '隐藏生成器' : '生成密码'}
                                    </button>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={loginForm.password}
                                        onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                                        placeholder="密码"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                                        title="显示/隐藏密码"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4 text-gray-500"/>
                                        ) : (
                                            <Eye className="w-4 h-4 text-gray-500"/>
                                        )}
                                    </button>
                                </div>
                                {showPasswordGenerator && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                        <PasswordGenerator onUsePassword={handleUsePassword}/>
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="login-totp">2FA 验证码 (TOTP)</Label>
                                <Input
                                    id="login-totp"
                                    value={loginForm.totp}
                                    onChange={(e) => setLoginForm({...loginForm, totp: e.target.value})}
                                    placeholder="otpauth://totp/..."
                                />
                                <p className="text-xs text-gray-500 mt-1">两步验证密钥</p>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>网址</Label>
                                    <button
                                        type="button"
                                        onClick={() => setLoginForm({...loginForm, urls: [...loginForm.urls, '']})}
                                        className="text-xs text-blue-500 hover:text-blue-600"
                                    >
                                        + 添加网址
                                    </button>
                                </div>
                                {loginForm.urls.map((url, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <Input
                                            value={url}
                                            onChange={(e) => {
                                                const newUrls = [...loginForm.urls];
                                                newUrls[index] = e.target.value;
                                                setLoginForm({...loginForm, urls: newUrls});
                                            }}
                                            placeholder="https://example.com"
                                        />
                                        {loginForm.urls.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newUrls = loginForm.urls.filter((_, i) => i !== index);
                                                    setLoginForm({...loginForm, urls: newUrls});
                                                }}
                                                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                删除
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div>
                                <Label htmlFor="login-notes">备注</Label>
                                <textarea
                                    id="login-notes"
                                    value={loginForm.notes}
                                    onChange={(e) => setLoginForm({...loginForm, notes: e.target.value})}
                                    placeholder="添加备注..."
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    rows={3}
                                />
                            </div>
                        </>
                    )}

                    {/* Card Form */}
                    {itemType === ItemType.Card && (
                        <>
                            <div>
                                <Label htmlFor="card-name">名称 *</Label>
                                <Input
                                    id="card-name"
                                    value={cardForm.name}
                                    onChange={(e) => setCardForm({...cardForm, name: e.target.value})}
                                    placeholder="例如：工商银行信用卡"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="card-holder">持卡人姓名</Label>
                                <Input
                                    id="card-holder"
                                    value={cardForm.cardholderName}
                                    onChange={(e) => setCardForm({...cardForm, cardholderName: e.target.value})}
                                    placeholder="持卡人姓名"
                                />
                            </div>

                            <div>
                                <Label htmlFor="card-number">卡号 *</Label>
                                <Input
                                    id="card-number"
                                    value={cardForm.number}
                                    onChange={(e) => setCardForm({...cardForm, number: e.target.value})}
                                    placeholder="1234 5678 9012 3456"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="card-exp-month">有效期月</Label>
                                    <Input
                                        id="card-exp-month"
                                        value={cardForm.expMonth}
                                        onChange={(e) => setCardForm({...cardForm, expMonth: e.target.value})}
                                        placeholder="MM"
                                        maxLength={2}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="card-exp-year">有效期年</Label>
                                    <Input
                                        id="card-exp-year"
                                        value={cardForm.expYear}
                                        onChange={(e) => setCardForm({...cardForm, expYear: e.target.value})}
                                        placeholder="YYYY"
                                        maxLength={4}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="card-code">CVV</Label>
                                    <Input
                                        id="card-code"
                                        value={cardForm.code}
                                        onChange={(e) => setCardForm({...cardForm, code: e.target.value})}
                                        placeholder="123"
                                        maxLength={4}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="card-brand">品牌</Label>
                                    <Input
                                        id="card-brand"
                                        value={cardForm.brand}
                                        onChange={(e) => setCardForm({...cardForm, brand: e.target.value})}
                                        placeholder="Visa, MasterCard"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="card-notes">备注</Label>
                                <textarea
                                    id="card-notes"
                                    value={cardForm.notes}
                                    onChange={(e) => setCardForm({...cardForm, notes: e.target.value})}
                                    placeholder="添加备注..."
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    rows={3}
                                />
                            </div>
                        </>
                    )}

                    {/* Note Form */}
                    {itemType === ItemType.SecureNote && (
                        <>
                            <div>
                                <Label htmlFor="note-name">名称 *</Label>
                                <Input
                                    id="note-name"
                                    value={noteForm.name}
                                    onChange={(e) => setNoteForm({...noteForm, name: e.target.value})}
                                    placeholder="例如：重要密码"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="note-content">内容</Label>
                                <textarea
                                    id="note-content"
                                    value={noteForm.notes}
                                    onChange={(e) => setNoteForm({...noteForm, notes: e.target.value})}
                                    placeholder="添加笔记内容..."
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    rows={6}
                                />
                            </div>
                        </>
                    )}

                    {/* Footer */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300"
                            disabled={isLoading}
                        >
                            取消
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-blue-500 text-white hover:bg-blue-600"
                            disabled={isLoading}
                        >
                            {isLoading ? '添加中...' : '添加'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
