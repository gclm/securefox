use anyhow::Result;
use chrono::Local;
use std::path::PathBuf;

/// Internal command to actually run the service
/// This is called by `service start` in a background process
pub async fn execute(
    vault_path: Option<PathBuf>,
    host: String,
    port: u16,
    timeout: u64,
) -> Result<()> {
    let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;

    // Print startup information with timestamp
    let now = Local::now();
    println!(
        "[{}] SecureFox Service Starting...",
        now.format("%Y-%m-%d %H:%M:%S")
    );
    println!(
        "[{}]   Vault: {}",
        now.format("%Y-%m-%d %H:%M:%S"),
        vault_path.display()
    );
    println!(
        "[{}]   API: http://{}:{}",
        now.format("%Y-%m-%d %H:%M:%S"),
        host,
        port
    );
    println!(
        "[{}]   Timeout: {} seconds",
        now.format("%Y-%m-%d %H:%M:%S"),
        timeout
    );
    println!("[{}] {}", now.format("%Y-%m-%d %H:%M:%S"), "=".repeat(40));

    #[cfg(feature = "serve")]
    {
        securefox_api::run(vault_path, host, port, timeout).await?;
    }

    #[cfg(not(feature = "serve"))]
    {
        anyhow::bail!("API server feature not enabled");
    }

    Ok(())
}
