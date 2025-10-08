//! Data models compatible with Bitwarden format

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Main vault container
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vault {
    pub encrypted: bool,
    pub folders: Vec<Folder>,
    pub items: Vec<Item>,
    pub version: String,
    pub sync_time: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sync_config: Option<SyncConfig>,
}

impl Vault {
    pub fn new() -> Self {
        Self {
            encrypted: false,
            folders: Vec::new(),
            items: Vec::new(),
            version: "1.0.0".to_string(),
            sync_time: Utc::now(),
            sync_config: None,
        }
    }

    pub fn add_item(&mut self, item: Item) {
        self.items.push(item);
        self.sync_time = Utc::now();
    }

    pub fn remove_item(&mut self, id: &str) -> Option<Item> {
        if let Some(pos) = self.items.iter().position(|i| i.id == id) {
            self.sync_time = Utc::now();
            return Some(self.items.remove(pos));
        }
        None
    }

    pub fn get_item(&self, id: &str) -> Option<&Item> {
        self.items.iter().find(|i| i.id == id)
    }

    pub fn get_item_mut(&mut self, id: &str) -> Option<&mut Item> {
        self.sync_time = Utc::now();
        self.items.iter_mut().find(|i| i.id == id)
    }
}

impl Default for Vault {
    fn default() -> Self {
        Self::new()
    }
}

/// Folder for organizing items
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub name: String,
}

impl Folder {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
        }
    }
}

/// Item types matching Bitwarden
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(transparent)]
pub struct ItemType(pub u8);

impl ItemType {
    pub const LOGIN: Self = Self(1);
    pub const SECURE_NOTE: Self = Self(2);
    pub const CARD: Self = Self(3);
    pub const IDENTITY: Self = Self(4);
}

/// Main item structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
    pub favorite: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    // Type-specific fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub login: Option<LoginData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card: Option<CardData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity: Option<IdentityData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secure_note: Option<SecureNoteData>,

    // Custom fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<Vec<CustomField>>,

    // Metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reprompt: Option<u8>,
    pub creation_date: DateTime<Utc>,
    pub revision_date: DateTime<Utc>,
}

impl Item {
    pub fn new_login(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            item_type: ItemType::LOGIN,
            name: name.into(),
            folder_id: None,
            favorite: false,
            notes: None,
            login: Some(LoginData::default()),
            card: None,
            identity: None,
            secure_note: None,
            fields: None,
            reprompt: None,
            creation_date: now,
            revision_date: now,
        }
    }

    pub fn new_secure_note(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            item_type: ItemType::SECURE_NOTE,
            name: name.into(),
            folder_id: None,
            favorite: false,
            notes: None,
            login: None,
            card: None,
            identity: None,
            secure_note: Some(SecureNoteData {
                type_: SecureNoteType::GENERIC,
            }),
            fields: None,
            reprompt: None,
            creation_date: now,
            revision_date: now,
        }
    }
}

/// Login-specific data
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub totp: Option<String>, // otpauth://totp/... format
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uris: Option<Vec<LoginUri>>,
}

/// Login URI with matching options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginUri {
    pub uri: String,
    #[serde(rename = "match", skip_serializing_if = "Option::is_none")]
    pub match_type: Option<UriMatchType>,
}

/// URI matching types
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(transparent)]
pub struct UriMatchType(pub u8);

impl UriMatchType {
    pub const BASE_DOMAIN: Self = Self(0);
    pub const HOST: Self = Self(1);
    pub const STARTS_WITH: Self = Self(2);
    pub const EXACT: Self = Self(3);
    pub const REGEX: Self = Self(4);
    pub const NEVER: Self = Self(5);
}

/// Card data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cardholder_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exp_month: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exp_year: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brand: Option<String>,
}

/// Identity data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub middle_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address1: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address2: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address3: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub postal_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
}

/// Secure note data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureNoteData {
    #[serde(rename = "type")]
    pub type_: SecureNoteType,
}

/// Secure note types
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SecureNoteType(pub u8);

impl SecureNoteType {
    pub const GENERIC: Self = Self(0);
}

impl Default for SecureNoteType {
    fn default() -> Self {
        Self::GENERIC
    }
}

/// Custom field types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomField {
    pub name: String,
    pub value: String,
    #[serde(rename = "type")]
    pub field_type: FieldType,
}

/// Field types
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(transparent)]
pub struct FieldType(pub u8);

impl FieldType {
    pub const TEXT: Self = Self(0);
    pub const HIDDEN: Self = Self(1);
    pub const BOOLEAN: Self = Self(2);
}

/// Sync configuration for git synchronization
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfig {
    pub enabled: bool,
    pub mode: SyncMode,
}

impl SyncConfig {
    pub fn disabled() -> Self {
        Self {
            enabled: false,
            mode: SyncMode::Manual,
        }
    }

    pub fn manual() -> Self {
        Self {
            enabled: true,
            mode: SyncMode::Manual,
        }
    }

    pub fn auto_pull(interval_seconds: u64) -> Self {
        Self {
            enabled: true,
            mode: SyncMode::AutoPull { interval_seconds },
        }
    }

    pub fn push_on_change() -> Self {
        Self {
            enabled: true,
            mode: SyncMode::PushOnChange,
        }
    }

    pub fn full(interval_seconds: u64) -> Self {
        Self {
            enabled: true,
            mode: SyncMode::Full { interval_seconds },
        }
    }
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self::manual()
    }
}

/// Synchronization modes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SyncMode {
    /// Manual synchronization only
    Manual,

    /// Automatically pull from remote at regular intervals
    AutoPull {
        #[serde(rename = "intervalSeconds")]
        interval_seconds: u64,
    },

    /// Push to remote immediately when vault data changes
    PushOnChange,

    /// Full bidirectional sync at regular intervals
    Full {
        #[serde(rename = "intervalSeconds")]
        interval_seconds: u64,
    },
}

impl SyncMode {
    pub fn is_auto_pull(&self) -> bool {
        matches!(self, SyncMode::AutoPull { .. } | SyncMode::Full { .. })
    }

    pub fn is_push_on_change(&self) -> bool {
        matches!(self, SyncMode::PushOnChange | SyncMode::Full { .. })
    }

    pub fn interval_seconds(&self) -> Option<u64> {
        match self {
            SyncMode::AutoPull { interval_seconds } | SyncMode::Full { interval_seconds } => {
                Some(*interval_seconds)
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_creation() {
        let vault = Vault::new();
        assert_eq!(vault.items.len(), 0);
        assert_eq!(vault.folders.len(), 0);
        assert!(!vault.encrypted);
    }

    #[test]
    fn test_item_creation() {
        let item = Item::new_login("test@example.com");
        assert_eq!(item.item_type, ItemType::LOGIN);
        assert!(item.login.is_some());
    }

    #[test]
    fn test_json_serialization() {
        let mut vault = Vault::new();
        let mut item = Item::new_login("GitHub");
        if let Some(ref mut login) = item.login {
            login.username = Some("user@example.com".to_string());
            login.password = Some("secure123".to_string());
            login.totp = Some("otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP".to_string());
        }
        vault.add_item(item);

        let json = serde_json::to_string_pretty(&vault).unwrap();
        let deserialized: Vault = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.items.len(), 1);
        assert_eq!(deserialized.items[0].name, "GitHub");
    }
}
