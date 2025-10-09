use anyhow::{Context, Result};
use securefox_core::config::ConfigManager;
use securefox_core::models::SyncConfig;
use securefox_core::VaultStorage;
use std::path::PathBuf;

pub async fn execute(vault_path: Option<PathBuf>) -> Result<()> {
    let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;

    let storage = VaultStorage::with_path(vault_path.join("vault.sf"));

    if !storage.exists() {
        anyhow::bail!("Vault not found. Please initialize a vault first.");
    }

    // Disable sync
    let disabled_config = SyncConfig::disabled();

    // Update standalone config file
    let config_manager = ConfigManager::new()?;
    config_manager
        .update_sync_config(Some(disabled_config))
        .context("Failed to update config file")?;

    println!("✓ Auto-sync disabled");

    Ok(())
}
