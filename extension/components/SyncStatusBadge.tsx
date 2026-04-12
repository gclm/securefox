import React, {useEffect, useState} from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';
import {syncPush} from '@/lib/api/sync';

interface SyncStatusBadgeProps {
    lastSyncTime?: number;
    hasError?: boolean;
    onSyncComplete?: () => void;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
    lastSyncTime,
    hasError,
    onSyncComplete,
}) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [, setTick] = useState(0);

    // Update every minute for relative time display
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(interval);
    }, []);

    const getRelativeTime = (timestamp: number): string => {
        const diffMs = Date.now() - timestamp;
        const diffMin = Math.floor(diffMs / 60_000);

        if (diffMin < 1) {
            return '刚刚';
        } else if (diffMin < 60) {
            return `${diffMin}分钟前`;
        } else if (diffMin < 1440) {
            const hours = Math.floor(diffMin / 60);
            return `${hours}小时前`;
        } else {
            const days = Math.floor(diffMin / 1440);
            return `${days}天前`;
        }
    };

    const getStatusColor = (): string => {
        if (syncError || hasError) return 'bg-red-500';
        if (!lastSyncTime) return 'bg-gray-300';

        const diffMin = (Date.now() - lastSyncTime) / 60_000;
        if (diffMin < 5) return 'bg-green-500';
        if (diffMin < 60) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const handleSync = async () => {
        if (isSyncing) return;

        setIsSyncing(true);
        setSyncError(null);

        try {
            await syncPush();
            onSyncComplete?.();
        } catch (err: any) {
            setSyncError(err.message || '同步失败');
        } finally {
            setIsSyncing(false);
        }
    };

    const displayText = syncError || (hasError ? '同步失败' : undefined)
        || (lastSyncTime ? getRelativeTime(lastSyncTime) : '未同步');

    return (
        <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors text-xs"
            title={syncError || '点击同步'}
        >
            {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin"/>
            ) : syncError || hasError ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-500"/>
            ) : (
                <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}/>
            )}
            <span className="text-gray-500">{displayText}</span>
        </button>
    );
};
