import React, { useState, useMemo, useEffect } from 'react';
import { Key, Star, Clock, FileText, Copy, Eye, EyeOff, Globe } from 'lucide-react';
import { useVaultStore, useUIStore } from '@/store';
import { CreditCardView } from './CreditCardView';
import { FavoritesView } from './FavoritesView';
import { PasswordGenerator } from './PasswordGenerator';
import { NotesView } from './NotesView';
import { ItemType, Item } from '@/types';
import { findMatchingItems } from '@/utils/helpers';

interface EntryListProps {
  view: 'list' | 'recent' | 'generator' | 'cards' | 'notes' | 'current' | 'favorites';
}

export const EntryList: React.FC<EntryListProps> = ({ view }) => {
  // ✅ All hooks at the top level
  const { items, searchQuery, selectedFolder } = useVaultStore();
  const { showDetailView, showNotification } = useUIStore();
  const [showPassword, setShowPassword] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  // 获取登录类型的项目 - 必须在条件返回之前调用所有hooks
  const loginItems = useMemo(() => {
    // 先过滤出登录类型
    let filtered = items.filter(item => item.type === ItemType.Login);
    
    // 根据文件夹过滤
    if (selectedFolder) {
      filtered = filtered.filter(item => item.folderId === selectedFolder);
    }
    
    // 根据搜索关键词过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const name = item.name?.toLowerCase() || '';
        const username = item.login?.username?.toLowerCase() || '';
        const notes = item.notes?.toLowerCase() || '';
        
        return name.includes(query) || 
               username.includes(query) || 
               notes.includes(query);
      });
    }
    
    // 按名称排序
    return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [items, searchQuery, selectedFolder]);
  
  // Get current tab URL when view is 'current'
  useEffect(() => {
    if (view === 'current') {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab?.url) {
          setCurrentUrl(tab.url);
        }
      }).catch(() => {
        setCurrentUrl('');
      });
    }
  }, [view]);
  
  // 根据视图确定要显示的项目
  const displayItems = useMemo(() => {
    if (view === 'recent') {
      // 最近使用的登录项目（按修改时间排序）
      return [...loginItems]
        .sort((a, b) => new Date(b.revisionDate).getTime() - new Date(a.revisionDate).getTime())
        .slice(0, 10);
    }
    if (view === 'current' && currentUrl) {
      // 当前网站匹配的项目
      return findMatchingItems(loginItems, currentUrl);
    }
    // 默认显示所有登录项目
    return loginItems;
  }, [view, loginItems, currentUrl]);

  // ✅ All remaining hooks before any early returns
  // 在登录视图中分组显示：当前网站匹配项 + 所有项
  const shouldShowCurrentSiteSection = (view === 'list' || view === 'recent') && currentUrl;
  
  const currentSiteItems = useMemo(() => {
    if (!shouldShowCurrentSiteSection) {
      return [];
    }
    return findMatchingItems(displayItems, currentUrl);
  }, [shouldShowCurrentSiteSection, displayItems, currentUrl]);

  const otherItems = useMemo(() => {
    if (!shouldShowCurrentSiteSection || currentSiteItems.length === 0) {
      return displayItems;
    }
    const currentItemIds = new Set(currentSiteItems.map(item => item.id));
    return displayItems.filter(item => !currentItemIds.has(item.id));
  }, [shouldShowCurrentSiteSection, currentSiteItems, displayItems]);

  // 自动获取当前网站URL
  useEffect(() => {
    if (view === 'list' || view === 'recent') {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab?.url) {
          setCurrentUrl(tab.url);
        }
      }).catch(() => {
        setCurrentUrl('');
      });
    }
  }, [view]);

  const handleCopyPassword = async (item: Item) => {
    if (item.login?.password) {
      await navigator.clipboard.writeText(item.login.password);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // ✅ Now all hooks are called - early returns can happen
  // 如果是特殊视图，渲染对应组件 (所有hooks已调用后才返回)
  if (view === 'cards') {
    return <CreditCardView />;
  }
  
  if (view === 'generator') {
    return <PasswordGenerator />;
  }
  
  if (view === 'notes') {
    return <NotesView />;
  }

  // 对于收藏夹视图，使用新的收藏夹组件
  if (view === 'favorites') {
    return <FavoritesView />;
  }

  if (displayItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50 dark:bg-gray-900">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center shadow-2xl">
            {view === 'recent' && <Clock className="w-12 h-12 text-purple-500" />}
            {view === 'current' && <Globe className="w-12 h-12 text-green-500" />}
            {view === 'list' && <Key className="w-12 h-12 text-blue-500" />}
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center shadow-lg">
            <span className="text-lg font-bold text-gray-600 dark:text-gray-300">0</span>
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          {view === 'recent' && '没有最近使用的项目'}
          {view === 'current' && '当前网站无匹配项'}
          {view === 'list' && '开始使用 SecureFox'}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
          {view === 'recent' && '您最近使用的密码将自动显示在这里'}
          {view === 'current' && '该网站还没有保存的登录信息'}
          {view === 'list' && '添加您的第一个密码，开始安全的密码管理之旅'}
        </p>
        {view === 'list' && (
          <button 
            onClick={() => {
              showNotification({
                type: 'info',
                title: '功能开发中',
                message: '添加密码功能即将推出'
              });
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
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


  const renderItem = (item: Item) => (
    <div
      key={item.id}
      className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 hover:shadow-lg cursor-pointer transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 group"
      onClick={() => showDetailView(item.id, 'login')}
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
        <Key className="w-6 h-6 text-white" />
      </div>
      
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-50 truncate">{item.name}</h4>
          {item.favorite && <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />}
        </div>
        
        {item.login?.username && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="truncate">{item.login.username}</span>
          </div>
        )}
        
        {item.login?.password && (
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500 flex-shrink-0">
              {showPassword === item.id ? item.login.password : '••••••••'}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPassword(showPassword === item.id ? null : item.id);
                }}
                className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                title="显示/隐藏密码"
              >
                {showPassword === item.id ? (
                  <EyeOff className="w-4 h-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyPassword(item);
                }}
                className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                title="复制密码"
              >
                <Copy className={`w-4 h-4 transition-colors ${
                  copiedId === item.id 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {item.login?.totp && (
          <div className="px-2.5 py-1 rounded-md bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs font-medium">
            2FA
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900">
      <div className="space-y-3">
        {/* 当前网站匹配项 */}
        {shouldShowCurrentSiteSection && currentSiteItems.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Globe className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                当前网站
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {currentSiteItems.length} 项
              </span>
            </div>
            {currentSiteItems.map(item => renderItem(item))}
            
            {otherItems.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 mt-6">
                <Key className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  所有登录
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {otherItems.length} 项
                </span>
              </div>
            )}
          </>
        )}
        
        {/* 其他或全部项目 */}
        {otherItems.map(item => renderItem(item))}
      </div>
    </div>
  );
};
