use anyhow::{Context, Result};
use colored::Colorize;
use securefox_core::config::ConfigManager;
use securefox_core::models::SyncMode;
use std::path::PathBuf;

pub async fn execute(_vault_path: Option<PathBuf>) -> Result<()> {
    let config_manager = ConfigManager::new()?;
    let config = config_manager.load().context("Failed to load config")?;

    println!("{}", "Sync Status".bold());
    println!("───────────────────────────────────");
    println!();

    // Git Configuration Section
    println!("{}", "Git Configuration".bold());
    if let Some(url) = &config.remote_url {
        println!("Remote URL:  {}", url.green());
        println!("Git Status:  {}", "Configured".green());
    } else {
        println!("Remote URL:  {}", "Not configured".yellow());
        println!("Git Status:  {}", "No remote".yellow());
    }
    println!();

    // Auto-Sync Configuration Section
    println!("{}", "Auto-Sync Configuration".bold());

    if let Some(sync_config) = &config.sync_config {
        println!(
            "Status:      {}",
            if sync_config.enabled {
                "Enabled".green()
            } else {
                "Disabled".red()
            }
        );

        match &sync_config.mode {
            SyncMode::Manual => {
                println!("Mode:        Manual");
                println!("             No automatic synchronization");
            }
            SyncMode::Auto { interval_seconds } => {
                println!("Mode:        Auto");
                println!("             Pull interval: {} seconds", interval_seconds);
                println!("             Automatic pull at intervals + push on vault changes");
            }
        }
    } else {
        println!("Status:      Not configured");
        println!("Mode:        Manual (default)");
    }

    Ok(())
}
