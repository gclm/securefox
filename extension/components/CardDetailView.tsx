import React, {useEffect, useMemo, useState} from 'react';
import {ArrowLeft, Copy, CreditCard as CardIcon, Edit2, Eye, EyeOff, Save, Trash2, X} from 'lucide-react';
import {useUIStore, useVaultStore} from '@/store';
import {Item} from '@/types';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {detectCardBrand} from '@/utils/cardDetector';

interface CardDetailViewProps {
    onBack: () => void;
}

export const CardDetailView: React.FC<CardDetailViewProps> = ({onBack}) => {
    const {selectedItemId, showNotification, closeDetailView} = useUIStore();
    const {items, updateItem, deleteItem} = useVaultStore();

    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showCardNumber, setShowCardNumber] = useState(false);
    const [showCVV, setShowCVV] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const item = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

    const [form, setForm] = useState({
        name: '',
        cardholderName: '',
        number: '',
        code: '',
        brand: '',
        notes: '',
        expMonth: '',
        expYear: '',
        expiry: '', // MM/YY 或 MM/YYYY（显示用）
    });

    useEffect(() => {
        if (item && item.card) {
            const expMonth = item.card.expMonth || '';
            const expYearFull = item.card.expYear || '';
            const expiry = buildExpiryDisplay(expMonth, expYearFull);
            setForm({
                name: item.name || '',
                cardholderName: item.card.cardholderName || '',
                number: formatCardNumberDisplay(item.card.number || ''),
                code: item.card.code || '',
                brand: item.card.brand || '',
                notes: item.notes || '',
                expMonth,
                expYear: expYearFull,
                expiry,
            });
        }
    }, [item]);

    const buildExpiryDisplay = (mm: string, yyyy: string): string => {
        if (!mm && !yyyy) return '';
        if (!mm) return '';
        if (!yyyy) return mm;
        return `${mm}/${yyyy}`;
    };

    // 与新增对齐的解析/格式化
    const parseExpiry = (input: string): { month: string; year: string } => {
        const digits = (input || '').replace(/\D/g, '').slice(0, 6);
        if (!digits) return {month: '', year: ''};
        const mm = digits.slice(0, 2);
        const rest = digits.slice(2);
        let year = '';
        if (rest.length === 0) {
            year = '';
        } else if (rest.length <= 2) {
            year = `20${rest.padStart(2, '0')}`;
        } else {
            year = rest.slice(0, 4);
        }
        return {month: mm, year};
    };

    const formatExpiryForDisplay = (input: string): string => {
        const digits = (input || '').replace(/\D/g, '').slice(0, 6);
        if (!digits) return '';
        const mm = digits.slice(0, 2);
        const rest = digits.slice(2);
        if (rest.length === 0) return mm;
        if (rest.length <= 2) return `${mm}/${rest}`;
        return `${mm}/${rest.slice(0, 4)}`;
    };

    const handleExpiryChange = (raw: string) => {
        const formatted = formatExpiryForDisplay(raw);
        const {month, year} = parseExpiry(formatted);
        setForm(prev => ({...prev, expiry: formatted, expMonth: month, expYear: year}));
    };

    // 卡号格式化/规范化
    const normalizeCardNumber = (input: string): string => (input || '').replace(/\D/g, '').slice(0, 19);
    const formatCardNumberDisplay = (input: string): string => {
        const digits = normalizeCardNumber(input);
        if (!digits) return '';
        return digits.replace(/(.{4})/g, '$1 ').trim();
    };

    // 处理卡号变化：格式化 + 自动识别品牌
    const handleCardNumberChange = (value: string) => {
        const formatted = formatCardNumberDisplay(value);
        const detectedBrand = detectCardBrand(formatted);

        setForm(prev => ({
            ...prev,
            number: formatted,
            // 只在品牌字段为空时自动填充，避免覆盖用户手动编辑的内容
            brand: prev.brand ? prev.brand : detectedBrand,
        }));
    };

    const handleSave = async () => {
        if (!item) return;
        if (!form.name || !form.number) {
            showNotification({type: 'warning', title: '请填写必填字段', message: '名称和卡号不能为空'});
            return;
        }

        setIsLoading(true);
        try {
            // 从 expiry 兜底解析
            let expMonthLocal = form.expMonth;
            let expYearLocal = form.expYear;
            if (form.expiry && (!expMonthLocal || !expYearLocal)) {
                const {month, year} = parseExpiry(form.expiry);
                if (month) expMonthLocal = month;
                if (year) expYearLocal = year;
            }

            const updated: Item = {
                ...item,
                name: form.name,
                card: {
                    ...item.card,
                    cardholderName: form.cardholderName || undefined,
                    number: normalizeCardNumber(form.number) || undefined,
                    expMonth: expMonthLocal || undefined,
                    expYear: expYearLocal || undefined,
                    code: form.code || undefined,
                    brand: form.brand || undefined,
                },
                notes: form.notes,
            };

            const ok = await updateItem(updated);
            if (ok) {
                showNotification({type: 'success', title: '保存成功', message: '信用卡信息已更新'});
                setIsEditing(false);
            } else {
                showNotification({type: 'error', title: '保存失败', message: '请稍后重试'});
            }
        } catch (e) {
            showNotification({type: 'error', title: '保存失败', message: '发生错误，请稍后重试'});
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!item) return;
        if (!confirm(`确定要删除"${item.name}"吗？此操作无法撤销。`)) return;

        setIsLoading(true);
        try {
            const ok = await deleteItem(item.id);
            if (ok) {
                showNotification({type: 'success', title: '删除成功', message: '信用卡已删除'});
                closeDetailView();
                onBack();
            } else {
                showNotification({type: 'error', title: '删除失败', message: '请稍后重试'});
            }
        } catch (e) {
            showNotification({type: 'error', title: '删除失败', message: '发生错误，请稍后重试'});
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        if (item && item.card) {
            const expMonth = item.card.expMonth || '';
            const expYearFull = item.card.expYear || '';
            setForm({
                name: item.name || '',
                cardholderName: item.card.cardholderName || '',
                number: item.card.number || '',
                code: item.card.code || '',
                brand: item.card.brand || '',
                notes: item.notes || '',
                expMonth,
                expYear: expYearFull,
                expiry: buildExpiryDisplay(expMonth, expYearFull),
            });
        }
        setIsEditing(false);
    };

    const handleCopy = async (text: string, fieldName: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldName);
            showNotification({type: 'success', title: '已复制', message: `${fieldName}已复制到剪贴板`});
            setTimeout(() => setCopiedField(null), 2000);
        } catch (e) {
            showNotification({type: 'error', title: '复制失败', message: '无法访问剪贴板'});
        }
    };

    if (!item) {
        return (
            <div className="flex flex-col h-screen bg-gray-50">
                <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-600"/>
                    </button>
                    <h1 className="text-lg font-semibold text-gray-800">未找到项目</h1>
                </header>
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500">该信用卡不存在</p>
                </div>
            </div>
        );
    }

    const expiryDisplay = buildExpiryDisplay(form.expMonth, form.expYear);

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-600"/>
                    </button>
                    <h1 className="text-lg font-semibold text-gray-800">
                        {isEditing ? '编辑信用卡' : '信用卡详情'}
                    </h1>
                </div>

                {!isEditing && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsEditing(true)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="编辑">
                            <Edit2 className="w-5 h-5 text-gray-600"/>
                        </button>
                        <button onClick={handleDelete} className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                title="删除" disabled={isLoading}>
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
                            <Input id="edit-name" value={form.name}
                                   onChange={(e) => setForm({...form, name: e.target.value})}
                                   placeholder="例如：工商银行信用卡" required/>
                        </div>

                        <div>
                            <Label htmlFor="edit-holder">持卡人姓名</Label>
                            <Input id="edit-holder" value={form.cardholderName}
                                   onChange={(e) => setForm({...form, cardholderName: e.target.value})}
                                   placeholder="持卡人姓名"/>
                        </div>

                        <div>
                            <Label htmlFor="edit-number">卡号 *</Label>
                            <Input id="edit-number" value={form.number}
                                   onChange={(e) => handleCardNumberChange(e.target.value)}
                                   placeholder="1234 5678 9012 3456" inputMode="numeric" autoComplete="cc-number"
                                   maxLength={23} required/>
                        </div>

                        <div>
                            <Label htmlFor="edit-expiry">有效期</Label>
                            <Input id="edit-expiry" value={form.expiry}
                                   onChange={(e) => handleExpiryChange(e.target.value)} placeholder="MM/YY 或 MM/YYYY"
                                   maxLength={7}/>
                            <p className="text-xs text-gray-500 mt-1">自动解析为 月/年</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="edit-code">CVV</Label>
                                <Input id="edit-code" value={form.code}
                                       onChange={(e) => setForm({...form, code: e.target.value})} placeholder="123"
                                       maxLength={4}/>
                            </div>

                            <div>
                                <Label htmlFor="edit-brand">品牌</Label>
                                <Input id="edit-brand" value={form.brand}
                                       onChange={(e) => setForm({...form, brand: e.target.value})}
                                       placeholder="Visa, MasterCard"/>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="edit-notes">备注</Label>
                            <textarea id="edit-notes" value={form.notes}
                                      onChange={(e) => setForm({...form, notes: e.target.value})}
                                      placeholder="添加备注..."
                                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                      rows={4}/>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="button" onClick={handleCancel}
                                    className="flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300" disabled={isLoading}>
                                <X className="w-4 h-4 mr-2"/>
                                取消
                            </Button>
                            <Button type="button" onClick={handleSave}
                                    className="flex-1 bg-blue-500 text-white hover:bg-blue-600" disabled={isLoading}>
                                <Save className="w-4 h-4 mr-2"/>
                                {isLoading ? '保存中...' : '保存'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div
                                className="w-16 h-16 flex-shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                <CardIcon className="w-8 h-8 text-white"/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-2xl font-bold text-gray-800 break-words">{item.name}</h2>
                                <p className="text-sm text-gray-500 mt-1">信用卡</p>
                            </div>
                        </div>

                        {/* Card Number */}
                        {form.number && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-xs text-gray-500">卡号</Label>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setShowCardNumber(!showCardNumber)}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            {showCardNumber ? (
                                                <EyeOff className="w-4 h-4 text-gray-400"/>
                                            ) : (
                                                <Eye className="w-4 h-4 text-gray-400"/>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleCopy(normalizeCardNumber(form.number), '卡号')}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <Copy
                                                className={`w-4 h-4 ${copiedField === '卡号' ? 'text-green-500' : 'text-gray-400'}`}/>
                                        </button>
                                    </div>
                                </div>
                                <p className="text-gray-800 font-mono break-all">
                                    {showCardNumber ? formatCardNumberDisplay(form.number) : `•••• •••• •••• ${normalizeCardNumber(form.number).slice(-4)}`}
                                </p>
                            </div>
                        )}

                        {/* Cardholder Name */}
                        {form.cardholderName && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-xs text-gray-500">持卡人姓名</Label>
                                    <button
                                        onClick={() => handleCopy(form.cardholderName, '持卡人姓名')}
                                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <Copy
                                            className={`w-4 h-4 ${copiedField === '持卡人姓名' ? 'text-green-500' : 'text-gray-400'}`}/>
                                    </button>
                                </div>
                                <p className="text-gray-800 font-medium break-all">{form.cardholderName}</p>
                            </div>
                        )}

                        {/* Expiry and CVV */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Expiry */}
                            {(form.expMonth || form.expYear) && (
                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <Label className="text-xs text-gray-500">有效期</Label>
                                        <button
                                            onClick={() => handleCopy(expiryDisplay || '', '有效期')}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <Copy
                                                className={`w-4 h-4 ${copiedField === '有效期' ? 'text-green-500' : 'text-gray-400'}`}/>
                                        </button>
                                    </div>
                                    <p className="text-gray-800 font-medium">{expiryDisplay || 'N/A'}</p>
                                </div>
                            )}

                            {/* CVV */}
                            {form.code && (
                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <Label className="text-xs text-gray-500">CVV</Label>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setShowCVV(!showCVV)}
                                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                {showCVV ? (
                                                    <EyeOff className="w-4 h-4 text-gray-400"/>
                                                ) : (
                                                    <Eye className="w-4 h-4 text-gray-400"/>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleCopy(form.code, 'CVV')}
                                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <Copy
                                                    className={`w-4 h-4 ${copiedField === 'CVV' ? 'text-green-500' : 'text-gray-400'}`}/>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-gray-800 font-mono font-medium">
                                        {showCVV ? form.code : '•••'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Brand */}
                        {form.brand && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-xs text-gray-500">品牌</Label>
                                    <button
                                        onClick={() => handleCopy(form.brand, '品牌')}
                                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <Copy
                                            className={`w-4 h-4 ${copiedField === '品牌' ? 'text-green-500' : 'text-gray-400'}`}/>
                                    </button>
                                </div>
                                <p className="text-gray-800 font-medium">{form.brand}</p>
                            </div>
                        )}

                        {/* Notes */}
                        {form.notes && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <Label className="text-xs text-gray-500 mb-2 block">备注</Label>
                                <p className="text-gray-800 whitespace-pre-wrap break-all">{form.notes}</p>
                            </div>
                        )}

                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">创建时间</span>
                                    <span
                                        className="text-gray-800">{new Date(item.creationDate).toLocaleString('zh-CN')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">修改时间</span>
                                    <span
                                        className="text-gray-800">{new Date(item.revisionDate).toLocaleString('zh-CN')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
