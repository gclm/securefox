import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Plus, 
  Settings, 
  LogOut, 
  Key, 
  Star,
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

export const MainView: React.FC = () => {
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
  const { activeView, setActiveView } = useUIStore();
  
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
    // TODO: Implement add item modal
    console.log('Add new item');
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Key className="w-4 h-4 text-white" />
          </div>
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
          <button
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => {
              // TODO: Implement settings
              console.log('Open settings');
            }}
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
            placeholder="搜索密码库..."
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
    </div>
  );
};