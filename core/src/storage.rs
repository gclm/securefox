//! Vault storage management

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::crypto::{decrypt_with_password, encrypt_with_password, encrypt_with_password_and_kdf, EncryptedData, KdfParams};
use crate::errors::{Error, Result};
use crate::models::Vault;

/// Default vault file name
const VAULT_FILE_NAME: &str = "vault.sf";

/// Default config directory name
const CONFIG_DIR_NAME: &str = ".securefox";

/// Encrypted vault container
#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedVault {
    pub version: String,
    pub encrypted_data: EncryptedData,
}

/// Vault storage manager
pub struct VaultStorage {
    vault_path: PathBuf,
}

impl VaultStorage {
    /// Create a new vault storage with default path
    pub fn new() -> Result<Self> {
        let home = dirs::home_dir()
            .ok_or_else(|| Error::Other("Could not determine home directory".to_string()))?;
        let config_dir = home.join(CONFIG_DIR_NAME);
        Ok(Self {
            vault_path: config_dir.join(VAULT_FILE_NAME),
        })
    }

    /// Create a vault storage with custom path
    pub fn with_path<P: AsRef<Path>>(path: P) -> Self {
        Self {
            vault_path: path.as_ref().to_path_buf(),
        }
    }

    /// Get the vault file path
    pub fn path(&self) -> &Path {
        &self.vault_path
    }

    /// Check if vault exists
    pub fn exists(&self) -> bool {
        self.vault_path.exists()
    }

    /// Ensure the vault directory exists
    fn ensure_directory(&self) -> Result<()> {
        if let Some(parent) = self.vault_path.parent() {
            fs::create_dir_all(parent)?;
        }
        Ok(())
    }

    /// Save a vault with encryption using default KDF (PBKDF2)
    pub fn save(&self, vault: &Vault, password: &str) -> Result<()> {
        self.save_internal(vault, password, true)
    }
    
    /// Internal save method with optional sync
    fn save_internal(&self, vault: &Vault, password: &str, trigger_sync: bool) -> Result<()> {
        self.ensure_directory()?;

        // Serialize vault to JSON
        let json = serde_json::to_vec(vault)?;

        // Encrypt the JSON with default KDF
        let encrypted_data = encrypt_with_password(&json, password)?;

        // Create encrypted vault container
        let encrypted_vault = EncryptedVault {
            version: "1.0.0".to_string(),
            encrypted_data,
        };

        // Save to file
        let contents = serde_json::to_string_pretty(&encrypted_vault)?;
        fs::write(&self.vault_path, contents)?;
        
        // Trigger git sync if enabled and configured for PushOnChange
        #[cfg(feature = "git")]
        if trigger_sync {
            self.try_auto_sync(vault)?;
        }

        Ok(())
    }

    /// Save a vault with encryption using specified KDF
    pub fn save_with_kdf(&self, vault: &Vault, password: &str, kdf_params: KdfParams) -> Result<()> {
        self.ensure_directory()?;

        // Serialize vault to JSON
        let json = serde_json::to_vec(vault)?;

        // Encrypt the JSON with specified KDF
        let encrypted_data = encrypt_with_password_and_kdf(&json, password, kdf_params)?;

        // Create encrypted vault container
        let encrypted_vault = EncryptedVault {
            version: "1.0.0".to_string(),
            encrypted_data,
        };

        // Save to file
        let contents = serde_json::to_string_pretty(&encrypted_vault)?;
        fs::write(&self.vault_path, contents)?;
        
        // Trigger git sync if enabled and configured for PushOnChange
        #[cfg(feature = "git")]
        self.try_auto_sync(vault)?;

        Ok(())
    }
    
    /// Try to auto-sync if configured
    #[cfg(feature = "git")]
    fn try_auto_sync(&self, vault: &Vault) -> Result<()> {
        use crate::git_sync::GitSync;
        
        // Check if sync is configured and enabled
        if let Some(sync_config) = &vault.sync_config {
            if sync_config.enabled && sync_config.mode.is_push_on_change() {
                // Get vault directory (parent of vault file)
                if let Some(vault_dir) = self.vault_path.parent() {
                    // Try to sync, but don't fail the save operation if sync fails
                    if let Ok(git_sync) = GitSync::init(vault_dir) {
                        let _ = git_sync.auto_commit_push("Auto-sync: vault updated");
                    }
                }
            }
        }
        
        Ok(())
    }

    /// Load and decrypt a vault
    pub fn load(&self, password: &str) -> Result<Vault> {
        if !self.exists() {
            return Err(Error::VaultNotFound);
        }

        // Read the encrypted vault file
        let contents = fs::read_to_string(&self.vault_path)?;
        let encrypted_vault: EncryptedVault = serde_json::from_str(&contents)?;

        // Decrypt the data
        let decrypted = decrypt_with_password(&encrypted_vault.encrypted_data, password)?;

        // Deserialize the vault
        let vault: Vault = serde_json::from_slice(&decrypted)?;

        Ok(vault)
    }

    /// Create a backup of the vault
    pub fn backup(&self) -> Result<PathBuf> {
        if !self.exists() {
            return Err(Error::VaultNotFound);
        }

        let backup_name = format!(
            "{}.{}.backup",
            VAULT_FILE_NAME,
            chrono::Utc::now().timestamp()
        );
        
        let backup_path = self
            .vault_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("backups")
            .join(backup_name);

        // Ensure backup directory exists
        if let Some(parent) = backup_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Copy vault to backup
        fs::copy(&self.vault_path, &backup_path)?;

        Ok(backup_path)
    }

    /// Rotate backups, keeping only the most recent N backups
    pub fn rotate_backups(&self, keep_count: usize) -> Result<()> {
        let backup_dir = self
            .vault_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("backups");

        if !backup_dir.exists() {
            return Ok(());
        }

        // List all backup files
        let mut backups: Vec<_> = fs::read_dir(&backup_dir)?
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(VAULT_FILE_NAME)
                    && entry.file_name().to_string_lossy().ends_with(".backup")
            })
            .collect();

        // Sort by modification time (newest first)
        backups.sort_by_key(|entry| {
            entry
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .map(std::cmp::Reverse)
        });

        // Remove old backups
        for entry in backups.iter().skip(keep_count) {
            fs::remove_file(entry.path())?;
        }

        Ok(())
    }

    /// Delete the vault file
    pub fn delete(&self) -> Result<()> {
        if self.exists() {
            fs::remove_file(&self.vault_path)?;
        }
        Ok(())
    }
}

impl Default for VaultStorage {
    fn default() -> Self {
        Self::new().expect("Failed to create default vault storage")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Item;
    use tempfile::tempdir;

    #[test]
    fn test_save_and_load_vault() {
        let temp_dir = tempdir().unwrap();
        let vault_path = temp_dir.path().join("test.vault");
        let storage = VaultStorage::with_path(&vault_path);

        let mut vault = Vault::new();
        vault.add_item(Item::new_login("test@example.com"));

        let password = "test_password";
        storage.save(&vault, password).unwrap();

        assert!(storage.exists());

        let loaded_vault = storage.load(password).unwrap();
        assert_eq!(loaded_vault.items.len(), 1);
        assert_eq!(loaded_vault.items[0].name, "test@example.com");
    }

    #[test]
    fn test_wrong_password_fails() {
        let temp_dir = tempdir().unwrap();
        let vault_path = temp_dir.path().join("test.vault");
        let storage = VaultStorage::with_path(&vault_path);

        let vault = Vault::new();
        storage.save(&vault, "correct_password").unwrap();

        let result = storage.load("wrong_password");
        assert!(result.is_err());
    }

    #[test]
    fn test_backup_creation() {
        let temp_dir = tempdir().unwrap();
        let vault_path = temp_dir.path().join("test.vault");
        let storage = VaultStorage::with_path(&vault_path);

        let vault = Vault::new();
        storage.save(&vault, "password").unwrap();

        let backup_path = storage.backup().unwrap();
        assert!(backup_path.exists());
        assert!(backup_path.to_string_lossy().contains(".backup"));
    }
}