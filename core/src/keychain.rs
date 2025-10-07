//! System keychain integration

use keyring::Entry;
use zeroize::Zeroizing;

use crate::errors::{Error, Result};

const SERVICE_NAME: &str = "SecureFox";
const MASTER_KEY_NAME: &str = "master_key";

/// Keychain manager for secure credential storage
pub struct Keychain {
    service: String,
}

impl Keychain {
    /// Create a new keychain instance
    pub fn new() -> Self {
        Self {
            service: SERVICE_NAME.to_string(),
        }
    }

    /// Create a keychain with custom service name
    pub fn with_service(service: impl Into<String>) -> Self {
        Self {
            service: service.into(),
        }
    }

    /// Store the master key in the system keychain
    pub fn store_master_key(&self, key: &[u8]) -> Result<()> {
        let entry = Entry::new(&self.service, MASTER_KEY_NAME)
            .map_err(|e| Error::Keychain(format!("Failed to create entry: {}", e)))?;

        // Convert key to base64 for storage
        let encoded = base64::encode(key);
        
        entry
            .set_password(&encoded)
            .map_err(|e| Error::Keychain(format!("Failed to store key: {}", e)))?;

        Ok(())
    }

    /// Retrieve the master key from the system keychain
    pub fn get_master_key(&self) -> Result<Zeroizing<Vec<u8>>> {
        let entry = Entry::new(&self.service, MASTER_KEY_NAME)
            .map_err(|e| Error::Keychain(format!("Failed to create entry: {}", e)))?;

        let encoded = entry
            .get_password()
            .map_err(|e| Error::Keychain(format!("Failed to retrieve key: {}", e)))?;

        // Decode from base64
        let decoded = base64::decode(&encoded)
            .map_err(|e| Error::Keychain(format!("Invalid key format: {}", e)))?;

        Ok(Zeroizing::new(decoded))
    }

    /// Delete the master key from the system keychain
    pub fn delete_master_key(&self) -> Result<()> {
        let entry = Entry::new(&self.service, MASTER_KEY_NAME)
            .map_err(|e| Error::Keychain(format!("Failed to create entry: {}", e)))?;

        entry
            .delete_password()
            .map_err(|e| Error::Keychain(format!("Failed to delete key: {}", e)))?;

        Ok(())
    }

    /// Check if master key exists in keychain
    pub fn has_master_key(&self) -> bool {
        if let Ok(entry) = Entry::new(&self.service, MASTER_KEY_NAME) {
            entry.get_password().is_ok()
        } else {
            false
        }
    }

    /// Store a generic credential
    pub fn store_credential(&self, username: &str, password: &str) -> Result<()> {
        let entry = Entry::new(&self.service, username)
            .map_err(|e| Error::Keychain(format!("Failed to create entry: {}", e)))?;

        entry
            .set_password(password)
            .map_err(|e| Error::Keychain(format!("Failed to store credential: {}", e)))?;

        Ok(())
    }

    /// Retrieve a generic credential
    pub fn get_credential(&self, username: &str) -> Result<String> {
        let entry = Entry::new(&self.service, username)
            .map_err(|e| Error::Keychain(format!("Failed to create entry: {}", e)))?;

        entry
            .get_password()
            .map_err(|e| Error::Keychain(format!("Failed to retrieve credential: {}", e)))
    }

    /// Delete a generic credential
    pub fn delete_credential(&self, username: &str) -> Result<()> {
        let entry = Entry::new(&self.service, username)
            .map_err(|e| Error::Keychain(format!("Failed to create entry: {}", e)))?;

        entry
            .delete_password()
            .map_err(|e| Error::Keychain(format!("Failed to delete credential: {}", e)))?;

        Ok(())
    }
}

impl Default for Keychain {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // Requires system keychain access
    fn test_store_and_retrieve_key() {
        let keychain = Keychain::with_service("SecureFox_Test");
        let test_key = b"test_master_key_12345678";

        // Store key
        keychain.store_master_key(test_key).unwrap();

        // Retrieve key
        let retrieved = keychain.get_master_key().unwrap();
        assert_eq!(&*retrieved, test_key);

        // Clean up
        keychain.delete_master_key().unwrap();
    }

    #[test]
    #[ignore] // Requires system keychain access
    fn test_credential_operations() {
        let keychain = Keychain::with_service("SecureFox_Test");
        let username = "test_user";
        let password = "test_password";

        // Store credential
        keychain.store_credential(username, password).unwrap();

        // Retrieve credential
        let retrieved = keychain.get_credential(username).unwrap();
        assert_eq!(retrieved, password);

        // Delete credential
        keychain.delete_credential(username).unwrap();

        // Verify deletion
        assert!(keychain.get_credential(username).is_err());
    }
}