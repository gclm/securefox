use anyhow::Result;
use colored::Colorize;
use std::path::PathBuf;

pub async fn execute(
    vault_path: Option<PathBuf>,
    host: String,
    port: u16,
    timeout: u64,
) -> Result<()> {
    let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;
    
    println!(
        "{} SecureFox API server on {}:{}",
        "Starting".cyan().bold(),
        host,
        port
    );
    
    println!("Session timeout: {}s", timeout);
    println!("Press Ctrl+C to stop");
    
    // Start API server
    securefox_api::run(vault_path, host, port, timeout).await?;
    
    Ok(())
}
