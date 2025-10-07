import React from 'react';
import { Key, Star, Clock, FileText } from 'lucide-react';
import { useVaultStore } from '@/store';
import { CreditCardView } from './CreditCardView';
import { FavoritesView } from './FavoritesView';
import { PasswordGenerator } from './PasswordGenerator';

interface EntryListProps {
  view: 'list' | 'favorites' | 'recent' | 'generator' | 'cards';
}

export const EntryList: React.FC<EntryListProps> = ({ view }) => {
  const { filteredItems, favoriteItems, recentItems } = useVaultStore();

  // 如果是特殊视图，渲染对应组件
  if (view === 'cards') {
    return <CreditCardView />;
  }
  
  if (view === 'generator') {
    return <PasswordGenerator />;
  }

  // 对于收藏夹视图，使用新的收藏夹组件
  if (view === 'favorites') {
    return <FavoritesView />;
  }

  // Determine which items to display for list and recent views
  let items = filteredItems;
  if (view === 'recent') {
    items = recentItems;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50 dark:bg-gray-900">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center shadow-2xl">
            {view === 'favorites' && <Star className="w-12 h-12 text-yellow-500" />}
            {view === 'recent' && <Clock className="w-12 h-12 text-purple-500" />}
            {view === 'list' && <Key className="w-12 h-12 text-blue-500" />}
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center shadow-lg">
            <span className="text-lg font-bold text-gray-600 dark:text-gray-300">0</span>
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          {view === 'favorites' && '没有收藏的项目'}
          {view === 'recent' && '没有最近使用的项目'}
          {view === 'list' && '开始使用 SecureFox'}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
          {view === 'favorites' && '将重要的密码标记为收藏，便于快速访问'}
          {view === 'recent' && '您最近使用的密码将自动显示在这里'}
          {view === 'list' && '添加您的第一个密码，开始安全的密码管理之旅'}
        </p>
        {view === 'list' && (
          <button className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105">
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加第一个密码
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900">
      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 hover:shadow-lg cursor-pointer transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 group"
            onClick={() => {
              // TODO: Handle item click (show details/fill)
              console.log('Clicked item:', item.name);
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
              <Key className="w-6 h-6 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 truncate">{item.name}</h4>
                {item.favorite && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
              </div>
              {item.login?.username && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {item.login.username}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {item.login?.totp && (
                <div className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 text-xs font-medium shadow-sm">
                  2FA
                </div>
              )}
              <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
