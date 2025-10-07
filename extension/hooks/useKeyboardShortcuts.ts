import { useEffect } from 'react';
import { useAuthStore, useVaultStore, useUIStore } from '@/store';

export const useKeyboardShortcuts = () => {
  const { lock } = useAuthStore();
  const { searchItems } = useVaultStore();
  const { setGeneratorOpen } = useUIStore();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check for modifier keys
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modifierKey) return;

      switch (e.key.toLowerCase()) {
        case 'l':
          // Ctrl/Cmd + L: Lock vault
          e.preventDefault();
          lock();
          break;

        case 'k':
          // Ctrl/Cmd + K: Focus search
          e.preventDefault();
          const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
          break;

        case 'g':
          // Ctrl/Cmd + G: Open generator
          e.preventDefault();
          setGeneratorOpen(true);
          break;

        case '/':
          // Ctrl/Cmd + /: Show shortcuts help
          e.preventDefault();
          // TODO: Show shortcuts modal
          console.log('Keyboard shortcuts help');
          break;

        case 'escape':
          // Escape: Clear search
          if (document.activeElement?.tagName === 'INPUT') {
            (document.activeElement as HTMLInputElement).blur();
            searchItems('');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [lock, searchItems, setGeneratorOpen]);
};