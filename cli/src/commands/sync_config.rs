use anyhow::{Context, Result};
use std::path::PathBuf;

#[cfg(feature = "git")]
use securefox_core::git_sync::GitSync;

pub async fn execute(vault_path: Option<PathBuf>, remote_url: String) -> Result<()> {
    #[cfg(feature = "git")]
    {
        let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;

        let sync = GitSync::init(&vault_path).context("Failed to initialize git sync")?;

        // Configure remote URL
        sync.set_remote(&remote_url)
            .context("Failed to set remote URL")?;

        println!("✓ Git remote configured: {}", remote_url);
        Ok(())
    }

    #[cfg(not(feature = "git"))]
    {
        anyhow::bail!("Git feature not enabled");
    }
}
