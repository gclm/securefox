// Vault types (Bitwarden compatible)
export interface Vault {
    encrypted: boolean;
    folders: Folder[];
    items: Item[];
    version: string;
    sync_time: number;
}

export interface Folder {
    id: string;
    name: string;
}

export enum ItemType {
    Login = 1,
    SecureNote = 2,
    Card = 3,
    Identity = 4,
}

export enum FieldType {
    Text = 0,
    Hidden = 1,
    Boolean = 2,
}

export enum UriMatchType {
    Domain = 0,
    Host = 1,
    StartsWith = 2,
    Exact = 3,
    RegularExpression = 4,
    Never = 5,
}

export interface Item {
    id: string;
    type: ItemType;
    name: string;
    folderId?: string;
    favorite: boolean;
    notes?: string;
    login?: LoginItem;
    card?: CardItem;
    identity?: IdentityItem;
    secureNote?: SecureNoteItem;
    fields?: CustomField[];
    reprompt?: number;
    creationDate: string;
    revisionDate: string;
}

export interface LoginItem {
    username?: string;
    password?: string;
    totp?: string;
    uris?: Array<{
        uri: string;
        match?: UriMatchType;
    }>;
}

export interface CardItem {
    cardholderName?: string;
    number?: string;
    expMonth?: string;
    expYear?: string;
    code?: string;
    brand?: string;
}

export interface IdentityItem {
    title?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
}

export interface SecureNoteItem {
    type: number; // 0 = Generic
}

export interface CustomField {
    name: string;
    value: string;
    type: FieldType;
}

// Status response type
export interface StatusResponse {
    locked: boolean;
    configured: boolean;
    version: string;
    vault_exists: boolean;
}

// API types
export interface UnlockRequest {
    password: string;
}

export interface UnlockResponse {
    success: boolean;
    token?: string;
    message?: string;
    vault_summary?: {
        items_count: number;
        folders_count: number;
    };
}

export interface CreateEntryRequest {
    name: string;
    type: ItemType;
    login?: LoginItem;
    card?: CardItem;
    identity?: IdentityItem;
    notes?: string;
    folderId?: string;
}

export interface UpdateEntryRequest extends CreateEntryRequest {
    id: string;
}

export interface SearchEntriesRequest {
    query?: string;
    domain?: string;
    folder_id?: string;
}

export interface TOTPResponse {
    code: string;
    ttl: number;
}

// Session types
export interface Session {
    token: string;
    locked: boolean;
}

// Sync types
export interface SyncStatusResponse {
    configured: boolean;
    remote_url: string | null;
    sync_enabled: boolean;
    sync_mode: string | null;
    has_local_changes: boolean | null;
    has_remote_updates: boolean | null;
    last_error: string | null;
}

export interface SyncResponse {
    success: boolean;
    message: string;
    items_synced: number;
    pulled?: boolean;
    pushed?: boolean;
    error?: string;
}

export interface CloneRequest {
    remote_url: string;
}

export interface CloneResponse {
    success: boolean;
    message: string;
    vault_path: string;
}

// UI types
export interface Notification {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message?: string;
    duration?: number;
}