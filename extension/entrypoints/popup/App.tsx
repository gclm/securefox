import React, { useEffect } from 'react';
import { UnlockForm } from '@/components/UnlockForm';
import { MainView } from '@/components/MainView';
import { Notifications } from '@/components/Notifications';
import { useAuthStore } from '@/store';
import './globals.css';

function App() {
  const { isUnlocked, checkSession } = useAuthStore();

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <div className="w-full h-screen bg-background overflow-hidden">
      {isUnlocked ? (
        <MainView />
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          <UnlockForm />
        </div>
      )}
      <Notifications />
    </div>
  );
}

export default App;
