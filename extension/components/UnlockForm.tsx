import React, { useState, FormEvent, useEffect } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store';
import { validatePasswordStrength } from '@/utils/helpers';
import { SESSION_CONFIG } from '@/utils/constants';

export const UnlockForm: React.FC = () => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { unlock, isLoading, error, loginAttempts, clearError } = useAuthStore();

  // Clear error when password changes
  useEffect(() => {
    if (error && password) {
      clearError();
    }
  }, [password, error, clearError]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      return;
    }

    try {
      const success = await unlock(password);
      if (success) {
        setPassword('');
      }
    } catch (error) {
      // Error is handled by the store
    }
  };

  const isLocked = loginAttempts >= SESSION_CONFIG.MAX_LOGIN_ATTEMPTS;
  const remainingAttempts = SESSION_CONFIG.MAX_LOGIN_ATTEMPTS - loginAttempts;

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo and Brand */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-4">
            <img 
              src="/icon/securefox-icon.svg"
              alt="SecureFox" 
              className="w-full h-full drop-shadow-2xl"
            />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">SecureFox</h1>
          <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-2">
            您的专属密码管理助手
          </p>
        </div>
        {/* Login Form */}
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入主密码解锁"
                  disabled={isLoading || isLocked}
                  className={`h-12 pl-4 pr-12 text-base bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    error ? 'border-red-500' : ''
                  }`}
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  {loginAttempts > 0 && remainingAttempts > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
                      剩余 {remainingAttempts} 次尝试
                    </p>
                  )}
                </div>
              </div>
            )}

            {isLocked && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">账户已锁定</p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">请稍后再试或联系管理员</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!password || isLoading || isLocked}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  解锁中...
                </span>
              ) : (
                '解锁密码库'
              )}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={() => {
                  alert('请使用命令行工具重置您的主密码');
                }}
              >
                忘记密码？
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="p-4 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          您的密码安全存储在本地
        </p>
      </div>
    </div>
  );
};
