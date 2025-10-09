use anyhow::{Context, Result};
use securefox_core::config::ConfigManager;
use securefox_core::models::{SyncConfig, SyncMode};
use securefox_core::VaultStorage;
use std::path::PathBuf;

pub async fn execute(vault_path: Option<PathBuf>, mode: String, interval: u64) -> Result<()> {
    let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;

    let storage = VaultStorage::with_path(vault_path.join("vault.sf"));

    if !storage.exists() {
        anyhow::bail!("Vault not found. Please initialize a vault first.");
    }

    // Parse and set sync mode
    let sync_config = match mode.as_str() {
        "manual" => SyncConfig::manual(),
        "auto" => SyncConfig::auto(interval),
        _ => anyhow::bail!("Invalid sync mode. Use: manual or auto"),
    };

    // Update standalone config file
    let config_manager = ConfigManager::new()?;
    config_manager
        .update_sync_config(Some(sync_config.clone()))
        .context("Failed to update config file")?;

    // Print configuration
    println!("✓ Auto-sync enabled");
    println!("  Mode: {}", mode);
    match sync_config.mode {
        SyncMode::Auto { interval_seconds } => {
            println!("  Pull interval: {} seconds", interval_seconds);
            println!("  Automatic pull at intervals + push on vault changes");
        }
        SyncMode::Manual => {
            println!("  Manual mode: No automatic synchronization");
        }
    }

    Ok(())
}
