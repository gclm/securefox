use anyhow::Result;
use std::path::PathBuf;

pub async fn execute(
    vault_path: Option<PathBuf>,
    host: String,
    port: u16,
    timeout: u64,
) -> Result<()> {
    println!("Restarting SecureFox service...");
    println!();

    // Try to stop the service (ignore errors if not running)
    println!("Stopping service...");
    match crate::commands::service_stop::execute().await {
        Ok(_) => {
            println!("✓ Service stopped");
        }
        Err(e) => {
            println!("⚠ Stop failed: {} (continuing anyway)", e);
        }
    }

    println!();

    // Wait a moment for cleanup
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    // Start the service with new parameters
    println!("Starting service...");
    crate::commands::service_start::execute(vault_path, host, port, timeout).await?;

    Ok(())
}
