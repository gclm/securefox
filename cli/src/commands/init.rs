use anyhow::Result;
use colored::Colorize;
use dialoguer::{Input, Password};
use club_gclmit_securefox_core::{prelude::*, storage::VaultStorage};
use std::path::PathBuf;

pub async fn execute(vault_path: Option<PathBuf>, remote: Option<String>) -> Result<()> {
    println!("{}", "Initializing new SecureFox vault...".cyan().bold());

    // Get vault path
    let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;

    // Check if vault already exists
    let storage = VaultStorage::with_path(&vault_path.join("vault.sf"));
    if storage.exists() {
        return Err(anyhow::anyhow!("Vault already exists at this location"));
    }

    // Get master password
    let password = Password::new()
        .with_prompt("Enter master password")
        .with_confirmation("Confirm master password", "Passwords do not match")
        .interact()?;

    // Create new vault
    let vault = Vault::new();

    // Save vault
    storage.save(&vault, &password)?;

    println!("{}", "✓ Vault initialized successfully".green());

    // Setup git if remote specified
    if let Some(remote_url) = remote {
        #[cfg(feature = "git")]
        {
            use club_gclmit_securefox_core::git_sync::GitSync;
            
            println!("{}", "Setting up Git sync...".cyan());
            let sync = GitSync::init(&vault_path)?;
            sync.set_remote(&remote_url)?;
            sync.auto_commit("Initial vault commit")?;
            
            println!("{}", "✓ Git remote configured".green());
        }
    }

    Ok(())
}