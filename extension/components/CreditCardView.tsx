import React, { useState, useMemo } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { useUIStore, useVaultStore } from '@/store';
import { ItemType } from '@/types';

export const CreditCardView: React.FC = () => {
  const { showNotification } = useUIStore();
  const { items } = useVaultStore();
  const [showAddForm, setShowAddForm] = useState(false);
  
  // 从 vault store 过滤出信用卡类型的项目
  const cards = useMemo(() => {
    return items
      .filter(item => item.type === ItemType.Card && item.card)
      .map((item, index) => ({
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
  }, [items]);

  return (
    <div className="p-4 space-y-4">
      {/* 添加按钮 */}
      <button 
        onClick={() => {
          showNotification({
            type: 'info',
            title: '功能开发中',
            message: '添加信用卡功能即将推出'
          });
        }}
        className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
      >
        <div className="flex items-center justify-center gap-2 text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400">
          <Plus className="w-5 h-5" />
          <span className="font-medium">添加信用卡</span>
        </div>
      </button>

      {/* 卡片列表 */}
      {cards.map(card => (
        <div key={card.id} className="relative">
          <div className={`${card.color} text-white rounded-xl p-6 shadow-lg`}>
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
        </div>
      ))}
      
      {cards.length === 0 && (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">暂无信用卡</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">点击上方按钮添加您的第一张卡片</p>
        </div>
      )}
    </div>
  );
};