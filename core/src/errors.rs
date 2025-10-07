//! Error types for SecureFox core

use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Error)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("Decryption error: {0}")]
    Decryption(String),

    #[error("Invalid password")]
    InvalidPassword,

    #[error("Vault not found")]
    VaultNotFound,

    #[error("Item not found: {0}")]
    ItemNotFound(String),

    #[error("Invalid TOTP secret")]
    InvalidTotp,

    #[error("Keychain error: {0}")]
    Keychain(String),

    #[cfg(feature = "git")]
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),

    #[error("Import error: {0}")]
    Import(String),

    #[error("Other error: {0}")]
    Other(String),
}