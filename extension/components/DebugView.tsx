import React, { useEffect } from 'react';
import { useVaultStore } from '@/store';
import { ItemType } from '@/types';

export const DebugView: React.FC = () => {
  const { items, filteredItems, loadVault, isLoading, error, searchQuery, selectedFolder } = useVaultStore();

  useEffect(() => {
    loadVault();
  }, []);

  // 按类型分组项目
  const groupedItems = {
    logins: items.filter(item => item.type === ItemType.Login),
    notes: items.filter(item => item.type === ItemType.SecureNote),
    cards: items.filter(item => item.type === ItemType.Card),
    identities: items.filter(item => item.type === ItemType.Identity),
  };

  return (
    <div className="p-4 space-y-4 bg-gray-50 dark:bg-gray-900 h-screen overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">调试信息</h2>
      
      {/* 加载状态 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">状态</h3>
        <p>加载中: {isLoading ? '是' : '否'}</p>
        <p>错误: {error || '无'}</p>
        <p>总项目数: {items.length}</p>
        <p>过滤后项目数 (filteredItems): {filteredItems.length}</p>
        <p>搜索关键词: {searchQuery || '无'}</p>
        <p>选中文件夹: {selectedFolder || '无'}</p>
      </div>

      {/* 类型统计 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">类型统计</h3>
        <ul className="space-y-1 text-sm">
          <li>登录 (type={ItemType.Login}): {groupedItems.logins.length} 个</li>
          <li>笔记 (type={ItemType.SecureNote}): {groupedItems.notes.length} 个</li>
          <li>信用卡 (type={ItemType.Card}): {groupedItems.cards.length} 个</li>
          <li>身份 (type={ItemType.Identity}): {groupedItems.identities.length} 个</li>
        </ul>
      </div>

      {/* 原始数据 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">原始数据 (前3个)</h3>
        <pre className="text-xs overflow-x-auto bg-gray-100 dark:bg-gray-900 p-2 rounded">
          {JSON.stringify(items.slice(0, 3), null, 2)}
        </pre>
      </div>

      {/* 登录项目详情 */}
      {groupedItems.logins.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">登录项目详情</h3>
          {groupedItems.logins.map(item => (
            <div key={item.id} className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm">用户名: {item.login?.username || '无'}</p>
              <p className="text-sm">密码: {item.login?.password ? '有' : '无'}</p>
              <p className="text-sm">TOTP: {item.login?.totp ? '有' : '无'}</p>
            </div>
          ))}
        </div>
      )}

      {/* 笔记项目详情 */}
      {groupedItems.notes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">笔记项目详情</h3>
          {groupedItems.notes.map(item => (
            <div key={item.id} className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm">内容: {item.notes || '无'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};