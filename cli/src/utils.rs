use dialoguer::Password;
use securefox_core::storage::VaultStorage;
use std::path::Path;

/// Get password from user or keychain
pub fn get_password(prompt: &str) -> anyhow::Result<String> {
    // Try keychain first
    #[cfg(feature = "keychain")]
    {
        use securefox_core::keychain::Keychain;
        let keychain = Keychain::new();
        if keychain.has_master_key() {
            if let Ok(key) = keychain.get_master_key() {
                // For simplicity, convert key to password
                // In real implementation, would store password hash
                return Ok(String::from_utf8_lossy(&key).to_string());
            }
        }
    }

    // Prompt for password
    Ok(Password::new().with_prompt(prompt).interact()?)
}

/// Load vault with password prompt
pub fn load_vault(path: &Path) -> anyhow::Result<(securefox_core::models::Vault, String)> {
    let storage = VaultStorage::with_path(path);
    
    if !storage.exists() {
        return Err(anyhow::anyhow!("Vault not found. Run 'securefox init' to create one."));
    }

    let password = get_password("Enter master password")?;
    let vault = storage.load(&password)?;
    
    Ok((vault, password))
}