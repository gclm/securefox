import React from 'react';
import { Star, Globe, Copy, Eye, EyeOff } from 'lucide-react';

export const FavoritesView: React.FC = () => {
  const [showPassword, setShowPassword] = React.useState<{ [key: string]: boolean }>({});

  // 模拟收藏的密码数据
  const favorites = [
    {
      id: '1',
      title: 'GitHub',
      username: 'johndoe@example.com',
      password: '************',
      url: 'github.com',
      favicon: '🐙'
    },
    {
      id: '2',
      title: 'Gmail',
      username: 'johndoe@gmail.com',
      password: '************',
      url: 'gmail.com',
      favicon: '📧'
    },
    {
      id: '3',
      title: 'Netflix',
      username: 'johndoe@example.com',
      password: '************',
      url: 'netflix.com',
      favicon: '🎬'
    }
  ];

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    // 可以添加通知提示
  };

  return (
    <div className="p-4 space-y-3">
      {favorites.map(item => (
        <div 
          key={item.id}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-start gap-3">
            {/* 图标 */}
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white shadow-md">
              <Star className="w-5 h-5" />
            </div>
            
            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-gray-800 dark:text-gray-100">{item.title}</h3>
                <span className="text-2xl">{item.favicon}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                <Globe className="w-3 h-3" />
                <span className="truncate">{item.url}</span>
              </div>
              
              {/* 用户名 */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">{item.username}</span>
                <button
                  onClick={() => copyToClipboard(item.username, 'username')}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="复制用户名"
                >
                  <Copy className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              
              {/* 密码 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-gray-600 dark:text-gray-300">
                  {showPassword[item.id] ? 'MySecureP@ss123' : item.password}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => togglePasswordVisibility(item.id)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title={showPassword[item.id] ? "隐藏密码" : "显示密码"}
                  >
                    {showPassword[item.id] ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  <button
                    onClick={() => copyToClipboard('MySecureP@ss123', 'password')}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="复制密码"
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {favorites.length === 0 && (
        <div className="text-center py-12">
          <Star className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">暂无收藏项目</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">将常用的登录信息添加到收藏夹</p>
        </div>
      )}
    </div>
  );
};