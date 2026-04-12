use anyhow::{Context, Result};
use colored::Colorize;
use std::path::PathBuf;

#[cfg(feature = "git")]
use securefox_core::git_sync::GitSync;

use securefox_core::config::ConfigManager;

pub async fn execute(vault_path: Option<PathBuf>, remote_url: String) -> Result<()> {
    #[cfg(feature = "git")]
    {
        let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;

        // Validate SSH URL format
        if !remote_url.starts_with("git@") && !remote_url.starts_with("ssh://") {
            println!(
                "{}",
                "⚠ Warning: Non-SSH URLs are not supported for sync. Use SSH format (git@host:user/repo.git)".yellow()
            );
            println!();
        }

        let sync = GitSync::init(&vault_path).context("Failed to initialize git sync")?;

        // Configure remote URL
        sync.set_remote(&remote_url)
            .context("Failed to set remote URL")?;

        // Update standalone config file
        let config_manager = ConfigManager::new()?;
        config_manager
            .update_remote_url(Some(remote_url.clone()))
            .context("Failed to update config file")?;

        println!("{}", "✓ Remote configured successfully".green());
        println!("  URL: {}", remote_url.cyan());
        println!();
        println!("Next steps:");
        println!("  securefox sync          # Sync vault (pull + push)");
        println!("  securefox sync clone --remote {}  # Clone from remote", remote_url.cyan());
        Ok(())
    }

    #[cfg(not(feature = "git"))]
    {
        anyhow::bail!("Git feature not enabled");
    }
}
