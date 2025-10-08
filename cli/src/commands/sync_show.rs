use anyhow::{Context, Result};
use dialoguer::Password;
use securefox_core::models::SyncMode;
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
    let vault = storage.load(&password).context("Failed to unlock vault")?;

    // Display sync configuration
    println!("Auto-Sync Configuration");
    println!("─────────────────────────");

    if let Some(config) = &vault.sync_config {
        println!(
            "Status: {}",
            if config.enabled {
                "Enabled"
            } else {
                "Disabled"
            }
        );

        match &config.mode {
            SyncMode::Manual => {
                println!("Mode:   Manual");
                println!("        No automatic synchronization");
            }
            SyncMode::AutoPull { interval_seconds } => {
                println!("Mode:   Auto-Pull");
                println!("        Pull interval: {} seconds", interval_seconds);
                println!("        Pull changes from remote automatically");
            }
            SyncMode::PushOnChange => {
                println!("Mode:   Push-On-Change");
                println!("        Push changes immediately after vault updates");
            }
            SyncMode::Full { interval_seconds } => {
                println!("Mode:   Full Bidirectional");
                println!("        Sync interval: {} seconds", interval_seconds);
                println!("        Automatic pull and push");
            }
        }
    } else {
        println!("Status: Not configured");
        println!("Mode:   Manual (default)");
    }

    Ok(())
}
