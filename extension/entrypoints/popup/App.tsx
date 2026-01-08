import React, {useEffect, useState} from 'react';
import {UnlockForm} from '@/components/UnlockForm';
import {MainView} from '@/components/MainView';
import {Notifications} from '@/components/Notifications';
import {useAuthStore, useUIStore} from '@/store';
import './globals.css';

function App() {
    const {isUnlocked, checkSession} = useAuthStore();
    const {setAddItemModalOpen} = useUIStore();
    const [pendingAddItem, setPendingAddItem] = useState<any>(null);

    // Check session on mount
    useEffect(() => {
        checkSession();
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

    return (
        <div className="w-full h-screen bg-background overflow-hidden">
            {isUnlocked ? (
                <MainView pendingAddItem={pendingAddItem} onPendingItemUsed={() => setPendingAddItem(null)}/>
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
