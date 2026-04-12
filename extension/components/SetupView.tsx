import React, {useState} from 'react';
import {AlertTriangle, ArrowRight, Copy, Key, Terminal} from 'lucide-react';
import {syncClone} from '@/lib/api/sync';

interface SetupViewProps {
    onVaultReady: () => void;
    onSkipToUnlock: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({onVaultReady, onSkipToUnlock}) => {
    const [remoteUrl, setRemoteUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSshGuide, setShowSshGuide] = useState(false);

    const handleClone = async () => {
        if (!remoteUrl.trim()) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await syncClone(remoteUrl.trim());
            onVaultReady();
        } catch (err: any) {
            const message = err.message || '';

            if (message.includes('网络') || message.includes('connect') || message.includes('timeout') || message.includes('ENOTFOUND')) {
                setError('网络连接失败，请检查网络后重试');
            } else if (message.includes('认证') || message.includes('auth') || message.includes('Permission denied') || message.includes('Host key verification failed')) {
                setError('认证失败，请检查 SSH 配置');
                setShowSshGuide(true);
            } else if (message.includes('无效') || message.includes('invalid') || message.includes('not found') || message.includes('404')) {
                setError('无效的远程仓库地址');
            } else {
                setError(message || '同步失败，请稍后重试');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && remoteUrl.trim() && !isLoading) {
            handleClone();
        }
    };

    const sshGuideSteps = [
        {
            title: '生成 SSH 密钥（如已有可跳过）',
            code: 'ssh-keygen -t ed25519 -C "your_email@example.com"',
        },
        {
            title: '将公钥添加到你的 Git 托管平台',
            code: 'cat ~/.ssh/id_ed25519.pub',
            hint: '复制到 GitHub Settings → SSH and GPG keys → New SSH key',
        },
        {
            title: '测试连接',
            code: 'ssh -T git@github.com',
        },
    ];

    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-b from-white to-gray-50">
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
                    <h1 className="text-2xl font-bold text-center text-gray-900">欢迎使用 SecureFox</h1>
                    <p className="text-sm text-center text-gray-500 mt-2">
                        从远程同步你的密码库
                    </p>
                </div>

                {/* Input and Clone Button */}
                <div className="w-full max-w-sm">
                    <div className="space-y-4">
                        <div>
                            <input
                                type="text"
                                value={remoteUrl}
                                onChange={(e) => {
                                    setRemoteUrl(e.target.value);
                                    if (error) setError(null);
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder="git@github.com:user/vault.git"
                                disabled={isLoading}
                                className={`w-full h-12 px-4 text-base bg-white border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 ${
                                    error ? 'border-red-500' : 'border-gray-200'
                                }`}
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0"/>
                                <div className="flex-1">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleClone}
                            disabled={!remoteUrl.trim() || isLoading}
                            className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                    </svg>
                                    同步中...
                                </>
                            ) : (
                                <>
                                    <ArrowRight className="h-5 w-5"/>
                                    同步密码库
                                </>
                            )}
                        </button>

                        {/* SSH Guide Link */}
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => setShowSshGuide(!showSshGuide)}
                                className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
                            >
                                如何配置 SSH？
                            </button>
                        </div>
                    </div>

                    {/* SSH Configuration Guide */}
                    {showSshGuide && (
                        <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="h-4 w-4 text-amber-600"/>
                                <p className="text-sm font-medium text-amber-800">
                                    SecureFox 使用 SSH 进行 Git 同步
                                </p>
                            </div>
                            <div className="space-y-4">
                                {sshGuideSteps.map((step, index) => (
                                    <div key={index}>
                                        <p className="text-sm font-medium text-amber-700 mb-1">
                                            {index + 1}. {step.title}
                                        </p>
                                        <div className="relative">
                                            <code className="block p-2 bg-amber-100 rounded-lg text-xs font-mono text-amber-900 break-all">
                                                {step.code}
                                            </code>
                                            <button
                                                type="button"
                                                onClick={() => navigator.clipboard.writeText(step.code)}
                                                className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-amber-200 transition-colors"
                                                title="复制"
                                            >
                                                <Copy className="h-3.5 w-3.5 text-amber-600"/>
                                            </button>
                                        </div>
                                        {step.hint && (
                                            <p className="text-xs text-amber-600 mt-1">
                                                {step.hint}
                                            </p>
                                        )}
                                    </div>
                                ))}
                                <p className="text-xs text-amber-600">
                                    4. 完成后再尝试同步配置。
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-gray-200"/>
                        <span className="text-xs text-gray-400">或</span>
                        <div className="flex-1 h-px bg-gray-200"/>
                    </div>

                    {/* CLI Option */}
                    <div className="text-center space-y-3">
                        <p className="text-sm text-gray-600">使用命令行创建新密码库</p>
                        <div className="relative">
                            <code className="block p-3 bg-gray-100 rounded-xl text-sm font-mono text-gray-700">
                                <Terminal className="h-4 w-4 inline mr-2 text-gray-400"/>
                                securefox init --remote {'<git-url>'}
                            </code>
                            <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText('securefox init --remote <git-url>')}
                                className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                                title="复制"
                            >
                                <Copy className="h-4 w-4 text-gray-400"/>
                            </button>
                        </div>
                    </div>

                    {/* Skip Link */}
                    <div className="text-center mt-6">
                        <button
                            type="button"
                            onClick={onSkipToUnlock}
                            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
                        >
                            跳过，直接解锁
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom decoration */}
            <div className="p-4 text-center">
                <p className="text-xs text-gray-400">
                    你的密码安全存储在本地
                </p>
            </div>
        </div>
    );
};
