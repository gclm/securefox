//! SecureFox Core - Password management library

pub mod crypto;
pub mod errors;
pub mod models;
pub mod storage;
pub mod totp;

#[cfg(feature = "git")]
pub mod git_sync;

#[cfg(feature = "keychain")]
pub mod keychain;

pub mod importers;

pub use errors::{Error, Result};
pub use models::{Folder, Item, ItemType, Vault};
pub use storage::VaultStorage;

// Re-export commonly used types
pub mod prelude {
    pub use crate::{
        crypto::{decrypt, derive_key, encrypt},
        models::*,
        storage::VaultStorage,
        Error, Result,
    };

    #[cfg(feature = "git")]
    pub use crate::git_sync::GitSync;

    #[cfg(feature = "keychain")]
    pub use crate::keychain::Keychain;
}
