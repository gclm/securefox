use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct UnlockRequest {
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnlockResponse {
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub vault_summary: VaultSummary,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultSummary {
    pub item_count: usize,
    pub folder_count: usize,
    pub last_sync: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusResponse {
    pub locked: bool,
    pub session_valid: bool,
    pub vault_exists: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneratePasswordRequest {
    pub length: Option<usize>,
    pub include_uppercase: Option<bool>,
    pub include_lowercase: Option<bool>,
    pub include_numbers: Option<bool>,
    pub include_symbols: Option<bool>,
    pub exclude_similar: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneratePasswordResponse {
    pub password: String,
    pub strength: PasswordStrength,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PasswordStrength {
    pub score: u8,     // 0-5
    pub label: String, // "Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TotpResponse {
    pub code: String,
    pub ttl: u64, // Time to live in seconds
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListItemsQuery {
    pub folder_id: Option<String>,
    pub search: Option<String>,
    pub domain: Option<String>,
}

/// Request body for creating a new item
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateItemRequest {
    pub name: String,
    #[serde(rename = "type")]
    pub item_type: securefox_core::models::ItemType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub favorite: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    // Type-specific fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub login: Option<securefox_core::models::LoginData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card: Option<securefox_core::models::CardData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity: Option<securefox_core::models::IdentityData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secure_note: Option<securefox_core::models::SecureNoteData>,

    // Custom fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<Vec<securefox_core::models::CustomField>>,

    // Metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reprompt: Option<u8>,
}

/// Request body for updating an existing item
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateItemRequest {
    pub name: String,
    #[serde(rename = "type")]
    pub item_type: securefox_core::models::ItemType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub favorite: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    // Type-specific fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub login: Option<securefox_core::models::LoginData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card: Option<securefox_core::models::CardData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity: Option<securefox_core::models::IdentityData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secure_note: Option<securefox_core::models::SecureNoteData>,

    // Custom fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<Vec<securefox_core::models::CustomField>>,

    // Metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reprompt: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResponse {
    pub success: bool,
    pub message: String,
    pub items_synced: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionResponse {
    pub version: String,
    pub build_time: Option<String>,
    pub git_commit: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Session {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub master_password: String, // In production, store key derivation instead
}

impl Session {
    pub fn new(master_password: String, timeout: std::time::Duration) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            created_at: now,
            expires_at: now + chrono::Duration::from_std(timeout).unwrap(),
            master_password,
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    pub fn refresh(&mut self, timeout: std::time::Duration) {
        self.expires_at = Utc::now() + chrono::Duration::from_std(timeout).unwrap();
    }
}
