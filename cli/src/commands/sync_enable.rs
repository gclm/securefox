use anyhow::{Context, Result};
use club_gclmit_securefox_core::VaultStorage;
use club_gclmit_securefox_core::models::{SyncConfig, SyncMode};
use std::path::PathBuf;
use dialoguer::Password;

pub async fn execute(vault_path: Option<PathBuf>, mode: String, interval: u64) -> Result<()> {
    let vault_path = vault_path
        .ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;
    
    let storage = VaultStorage::with_path(vault_path.join("vault.sf"));
    
    if !storage.exists() {
        anyhow::bail!("Vault not found. Please initialize a vault first.");
    }
    
    // Get password to unlock vault
    let password = Password::new()
        .with_prompt("Master password")
        .interact()?;
    
    // Load vault
    let mut vault = storage.load(&password)
        .context("Failed to unlock vault")?;
    
    // Parse and set sync mode
    let sync_config = match mode.as_str() {
        "manual" => SyncConfig::manual(),
        "auto-pull" => SyncConfig::auto_pull(interval),
        "push-on-change" => SyncConfig::push_on_change(),
        "full" => SyncConfig::full(interval),
        _ => anyhow::bail!("Invalid sync mode. Use: manual, auto-pull, push-on-change, or full"),
    };
    
    vault.sync_config = Some(sync_config.clone());
    
    // Save vault with updated config
    storage.save(&vault, &password)
        .context("Failed to save vault")?;
    
    // Print configuration
    println!("✓ Auto-sync enabled");
    println!("  Mode: {}", mode);
    match sync_config.mode {
        SyncMode::AutoPull { interval_seconds } => {
            println!("  Pull interval: {} seconds", interval_seconds);
        }
        SyncMode::Full { interval_seconds } => {
            println!("  Sync interval: {} seconds", interval_seconds);
        }
        SyncMode::PushOnChange => {
            println!("  Push: On vault changes");
        }
        _ => {}
    }
    
    Ok(())
}
