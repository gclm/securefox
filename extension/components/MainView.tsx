import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Plus, 
  Settings, 
  LogOut, 
  Key, 
  FileText,
  Clock,
  Folder,
  ChevronRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore, useVaultStore, useUIStore } from '@/store';
import { EntryList } from '@/components/EntryList';
import { ItemType } from '@/types';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SettingsView } from '@/components/SettingsView';
import { DebugView } from '@/components/DebugView';
import { AddItemModal } from '@/components/AddItemModal';
import { LoginDetailView } from '@/components/LoginDetailView';
import { NoteDetailView } from '@/components/NoteDetailView';

export const MainView: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  
  // 将所有hooks调用移到条件语句之前
  useKeyboardShortcuts();
  const { lock } = useAuthStore();
  const { 
    loadVault, 
    searchItems, 
    selectFolder,
    searchQuery,
    folders,
    items,
    isLoading 
  } = useVaultStore();
  const { activeView, setActiveView, setAddItemModalOpen, detailViewType, closeDetailView } = useUIStore();
  
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Load vault on mount
  useEffect(() => {
    loadVault();
  }, [loadVault]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchItems(localSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchQuery, searchItems]);

  const handleLogout = async () => {
    await lock();
  };

  const handleAddItem = () => {
    setAddItemModalOpen(true);
  };

  // 如果显示设置页面，渲染设置视图
  if (showSettings) {
    return <SettingsView onBack={() => setShowSettings(false)} />;
  }
  
  // 如果显示详情页面
  if (detailViewType === 'login') {
    return <LoginDetailView onBack={closeDetailView} />;
  }
  
  if (detailViewType === 'note') {
    return <NoteDetailView onBack={closeDetailView} />;
  }
  
  // 如果显示调试页面，渲染调试视图
  if (showDebug) {
    return (
      <div className="flex flex-col h-screen">
        <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b">
          <button
            onClick={() => setShowDebug(false)}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            返回
          </button>
          <span className="font-semibold">调试视图</span>
        </header>
        <DebugView />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <img 
            src="/icon/securefox-icon.svg"
            alt="SecureFox" 
            className="w-8 h-8"
          />
          <span className="font-semibold text-base text-gray-800 dark:text-gray-100">SecureFox</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={handleAddItem}
            title="添加新项目"
          >
            <Plus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          {/* 临时调试按钮 */}
          <button
            className="p-2 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-700 transition-colors"
            onClick={() => setShowDebug(true)}
            title="调试"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => setShowSettings(true)}
            title="设置"
          >
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors group"
            onClick={handleLogout}
            title="锁定密码库"
          >
            <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder={activeView === 'cards' ? '搜索信用卡...' : activeView === 'notes' ? '搜索笔记...' : '搜索密码库...'}
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-16 bg-gray-50 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">加载密码库中...</p>
            </div>
          </div>
        ) : (
          <EntryList view={activeView} />
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-around py-2">
          {/* All Items */}
          <button
            onClick={() => {
              setActiveView('list');
              selectFolder(null);
            }}
            className={`flex flex-col items-center p-2 rounded-lg transition-all ${
              activeView === 'list'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              activeView === 'list'
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : ''
            }`}>
              <Key className="w-5 h-5" />
            </div>
            <span className="text-xs mt-1">登录</span>
          </button>

          {/* Cards */}
          <button
            onClick={() => setActiveView('cards')}
            className={`flex flex-col items-center p-2 rounded-lg transition-all ${
              activeView === 'cards'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              activeView === 'cards'
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : ''
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <span className="text-xs mt-1">信用卡</span>
          </button>

          {/* Notes */}
          <button
            onClick={() => setActiveView('notes')}
            className={`flex flex-col items-center p-2 rounded-lg transition-all ${
              activeView === 'notes'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              activeView === 'notes'
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : ''
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs mt-1">笔记</span>
          </button>

          {/* Generator */}
          <button
            onClick={() => setActiveView('generator')}
            className={`flex flex-col items-center p-2 rounded-lg transition-all ${
              activeView === 'generator'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              activeView === 'generator'
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : ''
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <span className="text-xs mt-1">生成器</span>
          </button>
        </div>
      </nav>
      
      {/* Add Item Modal */}
      <AddItemModal />
    </div>
  );
};
