import React, {useEffect, useState} from 'react';
import {UnlockForm} from '@/components/UnlockForm';
import {MainView} from '@/components/MainView';
import {Notifications} from '@/components/Notifications';
import {SetupView} from '@/components/SetupView';
import {useAuthStore, useUIStore} from '@/store';
import {getStatus} from '@/lib/api';
import './globals.css';

function App() {
    const {isUnlocked, checkSession} = useAuthStore();
    const {setAddItemModalOpen} = useUIStore();
    const [pendingAddItem, setPendingAddItem] = useState<any>(null);

    // Vault existence and setup state
    const [vaultExists, setVaultExists] = useState<boolean | null>(null);
    const [isSetupMode, setIsSetupMode] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);

    // Check session and vault existence on mount
    useEffect(() => {
        async function init() {
            try {
                await checkSession();

                const status = await getStatus();
                setVaultExists(status.vault_exists);

                // If no vault exists, show setup view
                if (!status.vault_exists) {
                    setIsSetupMode(true);
                }
            } catch {
                // If status check fails, assume no vault and show setup
                setVaultExists(false);
                setIsSetupMode(true);
            } finally {
                setIsInitializing(false);
            }
        }

        init();
    }, [checkSession]);

    // Check for pending actions (e.g., open add modal)
    useEffect(() => {
        chrome.storage.local.get(['pendingAction', 'pendingAddItem']).then((result) => {
            if (result.pendingAction === 'openAddModal' && isUnlocked) {
                // Store the pending item data and open modal
                setPendingAddItem(result.pendingAddItem || null);
                setAddItemModalOpen(true);
                // Clear the pending action
                chrome.storage.local.remove(['pendingAction', 'pendingAddItem']);
            }
        });
    }, [isUnlocked, setAddItemModalOpen]);

    // Show loading state while initializing
    if (isInitializing) {
        return (
            <div className="w-full h-screen bg-background overflow-hidden flex items-center justify-center">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
                        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="mt-4 text-sm font-medium text-gray-600">加载中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-background overflow-hidden">
            {isUnlocked ? (
                <MainView pendingAddItem={pendingAddItem} onPendingItemUsed={() => setPendingAddItem(null)}/>
            ) : isSetupMode && vaultExists === false ? (
                <div className="flex items-center justify-center w-full h-full">
                    <SetupView
                        onVaultReady={() => {
                            setIsSetupMode(false);
                            setVaultExists(true);
                            checkSession();
                        }}
                        onSkipToUnlock={() => {
                            setIsSetupMode(false);
                        }}
                    />
                </div>
            ) : (
                <div className="flex items-center justify-center w-full h-full">
                    <UnlockForm/>
                </div>
            )}
            <Notifications/>
        </div>
    );
}

export default App;
