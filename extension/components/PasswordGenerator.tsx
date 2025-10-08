import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generatePassword as apiGeneratePassword } from '@/lib/api/entries';
import { copyToClipboard, clearClipboardAfterDelay } from '@/utils/helpers';
import { PASSWORD_DEFAULTS, UI_CONFIG } from '@/utils/constants';
import { useUIStore } from '@/store';

interface PasswordGeneratorProps {
  onUsePassword?: (password: string) => void;
}

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({ onUsePassword }) => {
  const { showNotification } = useUIStore();
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState({
    length: PASSWORD_DEFAULTS.LENGTH,
    useUppercase: PASSWORD_DEFAULTS.USE_UPPERCASE,
    useLowercase: PASSWORD_DEFAULTS.USE_LOWERCASE,
    useNumbers: PASSWORD_DEFAULTS.USE_NUMBERS,
    useSymbols: PASSWORD_DEFAULTS.USE_SYMBOLS,
  });

  // Generate password on mount and when options change
  useEffect(() => {
    generateNewPassword();
  }, [options.length, options.useUppercase, options.useLowercase, options.useNumbers, options.useSymbols]);

  const generateNewPassword = async () => {
    try {
      const response = await apiGeneratePassword({
        length: options.length,
        include_uppercase: options.useUppercase,
        include_lowercase: options.useLowercase,
        include_numbers: options.useNumbers,
        include_symbols: options.useSymbols,
      });
      setPassword(response.password);
      setCopied(false);
    } catch (error) {
      console.error('Failed to generate password:', error);
      showNotification({
        type: 'error',
        title: '生成密码失败',
        message: '请稍后重试',
      });
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(password);
    if (success) {
      setCopied(true);
      showNotification({
        type: 'success',
        title: 'Password copied to clipboard',
        message: 'It will be cleared in 30 seconds',
      });
      clearClipboardAfterDelay(UI_CONFIG.CLIPBOARD_CLEAR_SECONDS * 1000);
      
      // Reset copy state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLengthChange = (value: string) => {
    const length = parseInt(value, 10);
    if (!isNaN(length) && length >= PASSWORD_DEFAULTS.MIN_LENGTH && length <= PASSWORD_DEFAULTS.MAX_LENGTH) {
      setOptions({ ...options, length });
    }
  };

  const toggleOption = (option: keyof typeof options) => {
    // Ensure at least one character type is selected
    const newOptions = { ...options, [option]: !options[option] };
    const hasCharType = newOptions.useUppercase || newOptions.useLowercase || 
                       newOptions.useNumbers || newOptions.useSymbols;
    
    if (hasCharType) {
      setOptions(newOptions);
    } else {
      showNotification({
        type: 'warning',
        title: 'At least one character type must be selected',
      });
    }
  };

  // Calculate password strength
  const calculateStrength = () => {
    let strength = 0;
    if (options.length >= 12) strength++;
    if (options.length >= 16) strength++;
    if (options.useUppercase) strength++;
    if (options.useLowercase) strength++;
    if (options.useNumbers) strength++;
    if (options.useSymbols) strength++;
    
    const maxStrength = 6;
    const percentage = (strength / maxStrength) * 100;
    
    return {
      percentage,
      label: percentage > 80 ? '非常强' : percentage > 60 ? '强' : percentage > 40 ? '中等' : '弱',
      color: percentage > 80 ? 'bg-green-500' : percentage > 60 ? 'bg-blue-500' : percentage > 40 ? 'bg-yellow-500' : 'bg-red-500',
    };
  };

  const strength = calculateStrength();

  return (
    <div className="w-full space-y-4 p-4 pb-20">
      {!onUsePassword && (
        <div className="mb-2">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">密码生成器</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">为您的账户创建强大且独一无二的密码</p>
        </div>
      )}
      
      <div className="space-y-4">
        {/* Generated Password Display */}
        <div className="relative">
          <Input
            value={password}
            readOnly
            className="pr-20 font-mono text-lg"
            onClick={(e) => e.currentTarget.select()}
          />
        </div>

        {/* Password Strength Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">强度</span>
            <span className="font-medium">{strength.label}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${strength.color}`}
              style={{ width: `${strength.percentage}%` }}
            />
          </div>
        </div>

        {/* Length Slider */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="length">长度</Label>
            <span className="text-sm font-medium">{options.length}</span>
          </div>
          <input
            id="length"
            type="range"
            min={PASSWORD_DEFAULTS.MIN_LENGTH}
            max={PASSWORD_DEFAULTS.MAX_LENGTH}
            value={options.length}
            onChange={(e) => handleLengthChange(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Character Options */}
        <div className="space-y-2">
          <Label>包含</Label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.useUppercase}
                onChange={() => toggleOption('useUppercase')}
                className="rounded"
              />
              <span className="text-sm">大写字母 (A-Z)</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.useLowercase}
                onChange={() => toggleOption('useLowercase')}
                className="rounded"
              />
              <span className="text-sm">小写字母 (a-z)</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.useNumbers}
                onChange={() => toggleOption('useNumbers')}
                className="rounded"
              />
              <span className="text-sm">数字 (0-9)</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.useSymbols}
                onChange={() => toggleOption('useSymbols')}
                className="rounded"
              />
              <span className="text-sm">符号 (!@#$%^&*)</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            className="flex-1" 
            onClick={handleCopy}
            disabled={!password}
          >
            复制密码
          </Button>
          <Button 
            variant="outline"
            className="flex-1"
            onClick={generateNewPassword}
          >
            生成新密码
          </Button>
        </div>
        
        {/* Use Password Button (when used in modal) */}
        {onUsePassword && (
          <Button
            type="button"
            onClick={() => onUsePassword(password)}
            className="w-full mt-2"
          >
            使用此密码
          </Button>
        )}
      </div>
    </div>
  );
};
