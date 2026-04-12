use anyhow::{Context, Result};
use colored::Colorize;
use std::path::PathBuf;

#[cfg(feature = "git")]
use securefox_core::git_sync::GitSync;

pub async fn execute(remote_url: String, local_path: Option<PathBuf>) -> Result<()> {
    #[cfg(feature = "git")]
    {
        let vault_path = local_path.unwrap_or_else(|| {
            dirs::home_dir()
                .expect("Could not determine home directory")
                .join(".securefox")
        });

        println!("{}", "Cloning remote vault...".cyan().bold());
        println!("  Remote: {}", remote_url.green());
        println!("  Local:  {}", vault_path.display().to_string().cyan());
        println!();

        let result = GitSync::clone(&remote_url, &vault_path).context("Failed to clone vault")?;

        println!("{}", "✓ Vault cloned successfully!".green().bold());
        println!();
        println!("  Vault file: {}", result.vault_path.cyan());
        println!();
        println!("Next steps:");
        println!("  1. securefox unlock    (unlock with your master password)");
        println!("  2. securefox service start  (start the API server)");
        Ok(())
    }

    #[cfg(not(feature = "git"))]
    {
        anyhow::bail!("Git feature not enabled. Rebuild with --features git");
    }
}
