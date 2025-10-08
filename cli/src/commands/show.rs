use anyhow::Result;
use colored::Colorize;
use copypasta_ext::prelude::*;
use copypasta_ext::x11_fork::ClipboardContext;
use securefox_core::totp::TotpConfig;
use std::path::PathBuf;

pub async fn execute(
    vault_path: Option<PathBuf>,
    item_name: String,
    copy: bool,
    totp: bool,
) -> Result<()> {
    let vault_path = vault_path
        .ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?
        .join("vault.sf");

    // Load vault
    let (vault, _) = crate::utils::load_vault(&vault_path)?;

    // Find item by name or ID
    let item = vault
        .items
        .iter()
        .find(|i| i.name == item_name || i.id == item_name)
        .ok_or_else(|| anyhow::anyhow!("Item not found: {}", item_name))?;

    // Display basic info
    println!("{}: {}", "Name".cyan().bold(), item.name);
    println!(
        "{}: {}",
        "Type".cyan().bold(),
        format!("{:?}", item.item_type)
    );

    if item.favorite {
        println!("{}: {}", "Favorite".cyan().bold(), "★".yellow());
    }

    // Display type-specific fields
    if let Some(ref login) = item.login {
        if let Some(ref username) = login.username {
            println!("{}: {}", "Username".cyan().bold(), username);
        }

        if let Some(ref password) = login.password {
            if copy && !totp {
                // Copy password to clipboard
                if let Ok(mut ctx) = ClipboardContext::new() {
                    let _ = ctx.set_contents(password.clone());
                }
                println!(
                    "{}: {} (copied to clipboard)",
                    "Password".cyan().bold(),
                    "*".repeat(password.len()).dimmed()
                );
            } else {
                println!("{}: {}", "Password".cyan().bold(), password.green());
            }
        }

        if let Some(ref totp_secret) = login.totp {
            if totp {
                let config = TotpConfig::from_uri(totp_secret).or_else(|_| {
                    Ok::<TotpConfig, anyhow::Error>(TotpConfig::new(totp_secret.clone()))
                })?;
                let code = config.generate()?;
                let ttl = config.ttl();

                if copy {
                    if let Ok(mut ctx) = ClipboardContext::new() {
                        let _ = ctx.set_contents(code.clone());
                    }
                    println!(
                        "{}: {} (expires in {}s, copied)",
                        "TOTP".cyan().bold(),
                        code.green().bold(),
                        ttl
                    );
                } else {
                    println!(
                        "{}: {} (expires in {}s)",
                        "TOTP".cyan().bold(),
                        code.green().bold(),
                        ttl
                    );
                }
            } else {
                println!("{}: {}", "TOTP".cyan().bold(), "✓ Configured".green());
            }
        }

        if let Some(ref uris) = login.uris {
            for (i, uri) in uris.iter().enumerate() {
                println!("{} {}: {}", "URL".cyan().bold(), i + 1, uri.uri);
            }
        }
    }

    if let Some(ref notes) = item.notes {
        println!("{}: {}", "Notes".cyan().bold(), notes);
    }

    println!(
        "{}: {}",
        "Created".cyan().bold(),
        item.creation_date.format("%Y-%m-%d %H:%M:%S")
    );
    println!(
        "{}: {}",
        "Modified".cyan().bold(),
        item.revision_date.format("%Y-%m-%d %H:%M:%S")
    );

    Ok(())
}
