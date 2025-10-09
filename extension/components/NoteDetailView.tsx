import React, {useEffect, useState} from 'react';
import {ArrowLeft, Edit2, FileText, Save, Trash2, X} from 'lucide-react';
import {useUIStore, useVaultStore} from '@/store';
import {Item} from '@/types';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';

interface NoteDetailViewProps {
    onBack: () => void;
}

export const NoteDetailView: React.FC<NoteDetailViewProps> = ({onBack}) => {
    // ✅ All hooks at the top level - always called
    const {selectedItemId, showNotification, closeDetailView} = useUIStore();
    const {items, updateItem, deleteItem} = useVaultStore();

    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        notes: '',
    });

    // Find item after all hooks
    const item = items.find(i => i.id === selectedItemId);

    useEffect(() => {
        if (item) {
            setForm({
                name: item.name || '',
                notes: item.notes || '',
            });
        }
    }, [item]);

    const handleSave = async () => {
        if (!item) return;

        if (!form.name) {
            showNotification({
                type: 'warning',
                title: '请填写必填字段',
                message: '名称不能为空',
            });
            return;
        }

        setIsLoading(true);

        try {
            const updatedItem: Item = {
                ...item,
                name: form.name,
                notes: form.notes,
            };

            const success = await updateItem(updatedItem);

            if (success) {
                showNotification({
                    type: 'success',
                    title: '保存成功',
                    message: '笔记已更新',
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
                    message: '笔记已删除',
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
        if (item) {
            setForm({
                name: item.name || '',
                notes: item.notes || '',
            });
        }
        setIsEditing(false);
    };

    // ✅ Use conditional rendering instead of early return
    return !item ? (
        <div className="flex flex-col h-screen bg-gray-50">
            <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600"/>
                </button>
                <h1 className="text-lg font-semibold text-gray-800">未找到笔记</h1>
            </header>
            <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">该笔记不存在</p>
            </div>
        </div>
    ) : (
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
                        {isEditing ? '编辑笔记' : '笔记详情'}
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
                                placeholder="例如：重要密码"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="edit-notes">内容</Label>
                            <textarea
                                id="edit-notes"
                                value={form.notes}
                                onChange={(e) => setForm({...form, notes: e.target.value})}
                                placeholder="添加笔记内容..."
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows={12}
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
                                className="w-16 h-16 flex-shrink-0 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                                <FileText className="w-8 h-8 text-white"/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-2xl font-bold text-gray-800 break-words">{item.name}</h2>
                                <p className="text-sm text-gray-500 mt-1">安全笔记</p>
                            </div>
                        </div>

                        {/* Content */}
                        {item.notes ? (
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <Label className="text-xs text-gray-500 mb-3 block">内容</Label>
                                <div className="prose max-w-none">
                                    <p className="text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                                        {item.notes}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <p className="text-gray-400 text-center italic">暂无内容</p>
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
                                {item.notes && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">字数统计</span>
                                        <span className="text-gray-800">
                      {item.notes.length} 字符
                    </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
