use anyhow::{Context, Result};
use colored::Colorize;
use std::path::PathBuf;

#[cfg(feature = "git")]
use securefox_core::git_sync::GitSync;

pub async fn execute(vault_path: Option<PathBuf>) -> Result<()> {
    #[cfg(feature = "git")]
    {
        let vault_path = vault_path
            .ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;
        
        let sync = GitSync::init(&vault_path)
            .context("Failed to initialize git sync")?;
        
        // Get remote URL
        let remote_url = sync.get_remote()
            .context("Failed to get remote URL")?;
        
        println!("{}", "Sync Status".bold());
        println!("───────────────────────────────────");
        
        if let Some(url) = remote_url {
            println!("Remote URL: {}", url.green());
            
            // Check if there are unpushed commits
            // This is a simplified check - a real implementation would need
            // to compare with the remote
            println!("Status: {}", "Configured".green());
        } else {
            println!("Remote URL: {}", "Not configured".yellow());
            println!("Status: {}", "No remote".yellow());
        }
        
        Ok(())
    }

    #[cfg(not(feature = "git"))]
    {
        anyhow::bail!("Git feature not enabled");
    }
}
