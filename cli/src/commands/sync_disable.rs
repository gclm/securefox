use anyhow::{Context, Result};
use dialoguer::Password;
use securefox_core::models::SyncConfig;
use securefox_core::VaultStorage;
use std::path::PathBuf;

pub async fn execute(vault_path: Option<PathBuf>) -> Result<()> {
    let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;

    let storage = VaultStorage::with_path(vault_path.join("vault.sf"));

    if !storage.exists() {
        anyhow::bail!("Vault not found. Please initialize a vault first.");
    }

    // Get password to unlock vault
    let password = Password::new().with_prompt("Master password").interact()?;

    // Load vault
    let mut vault = storage.load(&password).context("Failed to unlock vault")?;

    // Disable sync
    vault.sync_config = Some(SyncConfig::disabled());

    // Save vault with updated config
    storage
        .save(&vault, &password)
        .context("Failed to save vault")?;

    println!("✓ Auto-sync disabled");

    Ok(())
}
