import { create } from 'zustand';
import { Item, Folder, ItemType } from '@/types';
import * as entriesApi from '@/lib/api/entries';
import { findMatchingItems } from '@/utils/helpers';

interface VaultState {
  // State
  items: Item[];
  folders: Folder[];
  searchQuery: string;
  selectedFolder: string | null;
  selectedItem: Item | null;
  isLoading: boolean;
  error: string | null;
  
  // Computed
  filteredItems: Item[];
  favoriteItems: Item[];
  recentItems: Item[];
  
  // Actions
  loadVault: () => Promise<void>;
  searchItems: (query: string) => void;
  selectFolder: (folderId: string | null) => void;
  selectItem: (item: Item | null) => void;
  addItem: (item: Omit<Item, 'id' | 'creationDate' | 'revisionDate'>) => Promise<Item | null>;
  updateItem: (item: Item) => Promise<boolean>;
  deleteItem: (itemId: string) => Promise<boolean>;
  addFolder: (name: string) => Promise<Folder | null>;
  updateFolder: (id: string, name: string) => Promise<boolean>;
  deleteFolder: (folderId: string) => Promise<boolean>;
  getItemsForDomain: (domain: string) => Item[];
  clearError: () => void;
}

const useVaultStore = create<VaultState>((set, get) => ({
  // Initial state
  items: [],
  folders: [],
  searchQuery: '',
  selectedFolder: null,
  selectedItem: null,
  isLoading: false,
  error: null,
  
  // Computed: Filtered items
  get filteredItems() {
    const state = get();
    let filtered = state.items;
    
    // Filter by folder
    if (state.selectedFolder) {
      filtered = filtered.filter(item => item.folderId === state.selectedFolder);
    }
    
    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const name = item.name.toLowerCase();
        const username = item.login?.username?.toLowerCase() || '';
        const notes = item.notes?.toLowerCase() || '';
        
        return name.includes(query) || 
               username.includes(query) || 
               notes.includes(query);
      });
    }
    
    // Sort by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  },
  
  // Computed: Favorite items
  get favoriteItems() {
    return get().items.filter(item => item.favorite);
  },
  
  // Computed: Recent items (last 10 modified)
  get recentItems() {
    return [...get().items]
      .sort((a, b) => new Date(b.revisionDate).getTime() - new Date(a.revisionDate).getTime())
      .slice(0, 10);
  },
  
  // Load vault data
  loadVault: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const items = await entriesApi.getEntries();
      
      set({
        items,
        folders: [], // No folders in current API
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to load vault',
        isLoading: false,
      });
    }
  },
  
  // Search items
  searchItems: (query: string) => {
    set({ searchQuery: query });
  },
  
  // Select folder
  selectFolder: (folderId: string | null) => {
    set({ selectedFolder: folderId });
  },
  
  // Select item
  selectItem: (item: Item | null) => {
    set({ selectedItem: item });
  },
  
  // Add new item
  addItem: async (itemData) => {
    set({ isLoading: true, error: null });
    
    try {
      const newItem = await entriesApi.createEntry({
        name: itemData.name,
        type: itemData.type,
        login: itemData.login,
        card: itemData.card,
        identity: itemData.identity,
        notes: itemData.notes,
        folderId: itemData.folderId,
      });
      
      set(state => ({
        items: [...state.items, newItem],
        isLoading: false,
      }));
      
      return newItem;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to add item',
        isLoading: false,
      });
      return null;
    }
  },
  
  // Update item
  updateItem: async (item) => {
    set({ isLoading: true, error: null });
    
    try {
      const updatedItem = await entriesApi.updateEntry({
        id: item.id,
        name: item.name,
        type: item.type,
        login: item.login,
        card: item.card,
        identity: item.identity,
        notes: item.notes,
        folderId: item.folderId,
      });
      
      set(state => ({
        items: state.items.map(i => i.id === item.id ? updatedItem : i),
        isLoading: false,
      }));
      
      return true;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update item',
        isLoading: false,
      });
      return false;
    }
  },
  
  // Delete item
  deleteItem: async (itemId) => {
    set({ isLoading: true, error: null });
    
    try {
      await entriesApi.deleteEntry(itemId);
      
      set(state => ({
        items: state.items.filter(i => i.id !== itemId),
        selectedItem: state.selectedItem?.id === itemId ? null : state.selectedItem,
        isLoading: false,
      }));
      
      return true;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to delete item',
        isLoading: false,
      });
      return false;
    }
  },
  
  // Folder operations - Not implemented in backend yet
  addFolder: async (name) => {
    console.log('Folders not implemented yet');
    return null;
  },
  
  updateFolder: async (id, name) => {
    console.log('Folders not implemented yet');
    return false;
  },
  
  deleteFolder: async (folderId) => {
    console.log('Folders not implemented yet');
    return false;
  },
  
  // Get items for specific domain
  getItemsForDomain: (domain: string) => {
    const state = get();
    return findMatchingItems(state.items, `https://${domain}`);
  },
  
  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));

export default useVaultStore;