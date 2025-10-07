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
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
    <Card className="w-80 shadow-xl">
      <CardHeader className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">欢迎使用 SecureFox</CardTitle>
        <CardDescription>
          输入主密码以解锁您的密码库
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">主密码</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入您的主密码"
                disabled={isLoading || isLocked}
                className={error ? 'border-destructive' : ''}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p>{error}</p>
                {loginAttempts > 0 && remainingAttempts > 0 && (
                  <p className="text-xs opacity-90">
                    剩余 {remainingAttempts} 次尝试机会
                  </p>
                )}
              </div>
            </div>
          )}

          {isLocked && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">尝试次数过多</p>
                <p className="text-xs mt-1">请重启扩展或联系支持</p>
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full"
            disabled={!password || isLoading || isLocked}
          >
            {isLoading ? '解锁中...' : '解锁密码库'}
          </Button>

          <div className="text-center space-y-2 pt-2">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                // TODO: Implement forgot password flow
                alert('请使用命令行工具重置您的主密码');
              }}
            >
              忘记主密码？
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
    </div>
  );
};
