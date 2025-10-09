import React, {useMemo, useState} from 'react';
import {Calendar, FileText} from 'lucide-react';
import {useUIStore, useVaultStore} from '@/store';
import {ItemType} from '@/types';

interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
}

export const NotesView: React.FC = () => {
    const {items, deleteItem, searchQuery} = useVaultStore();
    const {showNotification, showDetailView} = useUIStore();
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);

    // 从 vault store 过滤出笔记类型的项目
    const filteredNotes = useMemo(() => {
        let filtered = items.filter(item => item.type === ItemType.SecureNote);

        // 如果有搜索查询，进一步过滤
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item => {
                const name = item.name?.toLowerCase() || '';
                const content = item.notes?.toLowerCase() || '';

                return name.includes(query) || content.includes(query);
            });
        }

        return filtered.map(item => ({
            id: item.id,
            title: item.name,
            content: item.notes || '',
            createdAt: item.creationDate,
            updatedAt: item.revisionDate,
            tags: [] // 可以从 fields 或其他地方提取标签
        }));
    }, [items, searchQuery]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const truncateContent = (content: string, maxLength: number = 60) => {
        if (content.length <= maxLength) return content;
        return content.substr(0, maxLength) + '...';
    };

    return (
        <div className="p-4 space-y-3 bg-gray-50">
            {filteredNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                        <FileText className="w-10 h-10 text-gray-400"/>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        还没有笔记
                    </h3>
                    <p className="text-sm text-gray-500">
                        点击右上角按钮创建您的第一个安全笔记
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredNotes.map(note => (
                        <div
                            key={note.id}
                            onClick={() => showDetailView(note.id, 'note')}
                            className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-400 cursor-pointer transition-all hover:shadow-lg group"
                        >
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1 break-words">
                                    {note.title}
                                </h3>
                                <p className="text-sm text-gray-600 mb-2 break-words">
                                    {truncateContent(note.content)}
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 text-xs text-gray-400">
                                        <Calendar className="w-3 h-3"/>
                                        <span>{formatDate(note.updatedAt)}</span>
                                    </div>
                                    {note.tags.length > 0 && (
                                        <div className="flex gap-1">
                                            {note.tags.map(tag => (
                                                <span
                                                    key={tag}
                                                    className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full"
                                                >
                            {tag}
                          </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};