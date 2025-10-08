//! Import/Export functionality

pub mod bitwarden;

use crate::errors::Result;
use crate::models::Vault;

/// Importer trait for various password manager formats
pub trait Importer {
    /// Import data from a string (usually JSON or CSV)
    fn import(&self, data: &str) -> Result<Vault>;
}

/// Exporter trait for various formats
pub trait Exporter {
    /// Export vault to a string format
    fn export(&self, vault: &Vault) -> Result<String>;
}
