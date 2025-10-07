use anyhow::Result;
use colored::Colorize;
use dialoguer::{Input, Password, Confirm};
use passwords::PasswordGenerator;
use club_gclmit_securefox_core::{prelude::*, storage::VaultStorage};
use std::path::PathBuf;

pub async fn execute(
    vault_path: Option<PathBuf>,
    name: String,
    item_type: String,
    username: Option<String>,
    generate: bool,
    totp: Option<String>,
) -> Result<()> {
    let vault_path = vault_path
        .ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?
        .join("vault.sf");
    
    // Load vault
    let (mut vault, master_password) = crate::utils::load_vault(&vault_path)?;
    
    // Create item based on type
    let mut item = match item_type.as_str() {
        "login" => Item::new_login(&name),
        "note" => Item::new_secure_note(&name),
        _ => return Err(anyhow::anyhow!("Unsupported item type: {}", item_type)),
    };
    
    // Handle login-specific fields
    if item_type == "login" {
        if let Some(ref mut login) = item.login {
            // Set username
            login.username = username.or_else(|| {
                Input::<String>::new()
                    .with_prompt("Username")
                    .interact()
                    .ok()
            });
            
            // Generate or prompt for password
            if generate {
                let pg = PasswordGenerator {
                    length: 20,
                    numbers: true,
                    lowercase_letters: true,
                    uppercase_letters: true,
                    symbols: true,
                    spaces: false,
                    exclude_similar_characters: true,
                    strict: true,
                };
                let password = pg.generate_one().unwrap();
                println!("Generated password: {}", password.green().bold());
                login.password = Some(password);
            } else {
                login.password = Some(
                    Password::new()
                        .with_prompt("Password")
                        .interact()?
                );
            }
            
            // Set TOTP if provided
            if let Some(totp_secret) = totp {
                login.totp = Some(totp_secret);
            }
            
            // Add URL
            let url = Input::<String>::new()
                .with_prompt("URL (optional)")
                .allow_empty(true)
                .interact()?;
            
            if !url.is_empty() {
                login.uris = Some(vec![LoginUri {
                    uri: url,
                    match_type: Some(UriMatchType::BASE_DOMAIN),
                }]);
            }
        }
    }
    
    // Add notes if desired
    if Confirm::new()
        .with_prompt("Add notes?")
        .default(false)
        .interact()?
    {
        item.notes = Some(
            Input::<String>::new()
                .with_prompt("Notes")
                .interact()?
        );
    }
    
    // Add item to vault
    vault.add_item(item);
    
    // Save vault
    let storage = VaultStorage::with_path(&vault_path);
    storage.save(&vault, &master_password)?;
    
    // Git sync
    #[cfg(feature = "git")]
    {
        use club_gclmit_securefox_core::git_sync::GitSync;
        if let Some(parent) = vault_path.parent() {
            let sync = GitSync::init(parent)?;
            sync.auto_commit_push(&format!("Added item: {}", name))?;
        }
    }
    
    println!("{} Item '{}' added successfully", "✓".green().bold(), name);
    Ok(())
}
