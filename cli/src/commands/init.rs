use anyhow::Result;
use colored::Colorize;
use dialoguer::Password;
use securefox_core::{crypto::KdfParams, prelude::*, storage::VaultStorage};
use std::path::PathBuf;

pub async fn execute(
    vault_path: Option<PathBuf>,
    remote: Option<String>,
    kdf: String,
) -> Result<()> {
    println!("{}", "Initializing new SecureFox vault...".cyan().bold());

    // Get vault path
    let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;

    // Check if vault already exists
    let storage = VaultStorage::with_path(vault_path.join("vault.sf"));
    if storage.exists() {
        return Err(anyhow::anyhow!("Vault already exists at this location"));
    }

    // Get master password
    let password = Password::new()
        .with_prompt("Enter master password")
        .with_confirmation("Confirm master password", "Passwords do not match")
        .interact()?;

    // Create KDF params based on user choice
    let kdf_params = match kdf.to_lowercase().as_str() {
        "argon2" | "argon2id" => {
            println!(
                "{}",
                "Using Argon2id KDF (higher security, slower)".yellow()
            );
            println!(
                "{}",
                "⚠ Note: Argon2 provides stronger protection against GPU-based attacks".yellow()
            );
            println!(
                "{}",
                "  but may take 1-2 seconds for each unlock operation.".yellow()
            );
            KdfParams::argon2()
        }
        "pbkdf2" => {
            println!("{}", "Using PBKDF2 KDF (standard security, faster)".cyan());
            println!(
                "{}",
                "ℹ PBKDF2 provides good security for most use cases and is widely compatible."
                    .cyan()
            );
            KdfParams::pbkdf2()
        }
        _ => {
            return Err(anyhow::anyhow!(
                "Invalid KDF algorithm. Use 'pbkdf2' or 'argon2'"
            ));
        }
    };

    println!("Encrypting vault...");

    // Create new vault
    let vault = Vault::new();

    // Save vault with specified KDF
    storage.save_with_kdf(&vault, &password, kdf_params)?;

    println!("{}", "✓ Vault initialized successfully".green());

    // Setup git if remote specified
    if let Some(remote_url) = remote {
        #[cfg(feature = "git")]
        {
            use securefox_core::git_sync::GitSync;

            println!("{}", "Setting up Git sync...".cyan());
            let sync = GitSync::init(&vault_path)?;
            sync.set_remote(&remote_url)?;
            sync.auto_commit("Initial vault commit")?;

            println!("{}", "✓ Git remote configured".green());
        }
    }

    Ok(())
}
