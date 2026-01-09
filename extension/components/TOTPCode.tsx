import React, {useEffect, useState} from 'react';
import {Copy} from 'lucide-react';
import {getTOTP} from '@/lib/api/entries';

interface TOTPCodeProps {
    entryId: string;
    onCopy?: () => void;
}

export const TOTPCode: React.FC<TOTPCodeProps> = ({entryId, onCopy}) => {
    const [code, setCode] = useState('------');
    const [timeLeft, setTimeLeft] = useState(30);
    const [progress, setProgress] = useState(100);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTOTP = async () => {
            try {
                const response = await getTOTP(entryId);
                setCode(response.code);
                setTimeLeft(response.ttl);
                setProgress((response.ttl / 30) * 100);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch TOTP:', err);
                setError('Failed to load');
                setCode('------');
            }
        };

        // 立即获取一次
        fetchTOTP();

        // 每秒更新
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // 时间到了，重新获取
                    fetchTOTP();
                    return 30;
                }
                const newTimeLeft = prev - 1;
                setProgress((newTimeLeft / 30) * 100);
                return newTimeLeft;
            });
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [entryId]);

    return (
        <div className="space-y-3">
            {error ? (
                <div className="text-sm text-red-500">
                    {error} - 请检查TOTP密钥是否正确
                </div>
            ) : (
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="text-3xl font-mono font-bold text-gray-800 tracking-wider">
                            {code.slice(0, 3)} {code.slice(3, 6)}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                            <div className="relative w-12 h-12">
                                <svg className="w-12 h-12 transform -rotate-90">
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r="20"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        fill="none"
                                        className="text-gray-200"
                                    />
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r="20"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        fill="none"
                                        strokeDasharray={`${2 * Math.PI * 20}`}
                                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                                        className={`transition-all ${
                                            timeLeft <= 5 ? 'text-red-500' : 'text-blue-500'
                                        }`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-bold ${
                    timeLeft <= 5 ? 'text-red-500' : 'text-gray-600'
                }`}>
                  {timeLeft}
                </span>
                                </div>
                            </div>
                        </div>

                        {onCopy && (
                            <button
                                onClick={onCopy}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="复制验证码"
                            >
                                <Copy className="w-5 h-5 text-gray-400"/>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
