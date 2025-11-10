import React, {useMemo, useState} from 'react';
import {CreditCard} from 'lucide-react';
import {useUIStore, useVaultStore} from '@/store';
import {ItemType} from '@/types';

export const CreditCardView: React.FC = () => {
    const {showNotification, showDetailView} = useUIStore();
    const {items, searchQuery} = useVaultStore();
    const [showAddForm, setShowAddForm] = useState(false);

    // 从 vault store 过滤出信用卡类型的项目
    const cards = useMemo(() => {
        let filtered = items.filter(item => item.type === ItemType.Card && item.card);

        // 如果有搜索查询，进一步过滤
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item => {
                const name = item.name?.toLowerCase() || '';
                const cardholderName = item.card?.cardholderName?.toLowerCase() || '';
                const brand = item.card?.brand?.toLowerCase() || '';
                const lastFour = item.card?.number?.slice(-4) || '';

                return name.includes(query) ||
                    cardholderName.includes(query) ||
                    brand.includes(query) ||
                    lastFour.includes(query);
            });
        }

        return filtered.map((item, index) => ({
            id: item.id,
            name: item.name,
            type: item.card?.brand || 'Card',
            lastFour: item.card?.number?.slice(-4) || '****',
            expiry: item.card?.expMonth && item.card?.expYear
                ? `${item.card.expMonth}/${item.card.expYear}`
                : 'N/A',
            cardholderName: item.card?.cardholderName || 'N/A',
            // 根据品牌选择不同的颜色
            color: item.card?.brand?.toLowerCase() === 'visa'
                ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                : item.card?.brand?.toLowerCase() === 'mastercard'
                    ? 'bg-gradient-to-br from-purple-500 to-purple-700'
                    : 'bg-gradient-to-br from-gray-500 to-gray-700',
            notes: item.notes
        }));
    }, [items, searchQuery]);

    return (
        <div className="p-4 space-y-4">
            {/* 卡片列表 */}
            {cards.map(card => (
                <div key={card.id} className="relative">
                    <button onClick={() => showDetailView(card.id, 'card')} className="w-full text-left">
                        <div className={`${card.color} text-white rounded-xl p-6 shadow-lg hover:opacity-95 transition-opacity`}>
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <p className="text-xs opacity-80 mb-1">信用卡</p>
                                <p className="font-semibold">{card.name}</p>
                            </div>
                            <div className="text-xl font-bold">{card.type}</div>
                        </div>

                        <div className="mb-4">
                            <p className="text-xs opacity-80">卡号</p>
                            <p className="text-lg font-mono">•••• •••• •••• {card.lastFour}</p>
                        </div>

                        <div className="flex justify-between">
                            <div>
                                <p className="text-xs opacity-80">持卡人</p>
                                <p className="font-medium">{card.cardholderName}</p>
                            </div>
                            <div>
                                <p className="text-xs opacity-80">有效期</p>
                                <p className="font-medium">{card.expiry}</p>
                            </div>
                        </div>
                    </div>
                    </button>
                </div>
            ))}

            {cards.length === 0 && (
                <div className="text-center py-12">
                    <CreditCard className="w-12 h-12 mx-auto text-gray-400 mb-3"/>
                    <p className="text-gray-600">暂无信用卡</p>
                    <p className="text-sm text-gray-500 mt-1">点击右上角按钮添加您的第一张卡片</p>
                </div>
            )}
        </div>
    );
};