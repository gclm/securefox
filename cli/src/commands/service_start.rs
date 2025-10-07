use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

pub async fn execute(
    vault_path: Option<PathBuf>,
    host: String,
    port: u16,
    timeout: u64,
) -> Result<()> {
    let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;
    
    // Check if service is already running
    let pid_file = vault_path.join("service.pid");
    if pid_file.exists() {
        let pid_str = fs::read_to_string(&pid_file)?;
        let pid: u32 = pid_str.trim().parse()?;
        
        // Check if process is still running
        if is_process_running(pid) {
            anyhow::bail!("Service is already running (PID: {})", pid);
        } else {
            // Clean up stale PID file
            fs::remove_file(&pid_file)?;
        }
    }
    
    // Write PID file
    let pid = std::process::id();
    fs::write(&pid_file, pid.to_string())
        .context("Failed to write PID file")?;
    
    println!("✓ Starting SecureFox API service...");
    println!("  PID: {}", pid);
    println!("  API: http://{}:{}", host, port);
    println!("  Vault: {}", vault_path.display());
    println!("");
    
    // Start API server only
    start_api_server(vault_path, host, port, timeout).await?;
    
    Ok(())
}

async fn start_api_server(
    vault_path: PathBuf,
    host: String,
    port: u16,
    timeout: u64,
) -> Result<()> {
    #[cfg(feature = "serve")]
    {
        securefox_api::run(
            vault_path,
            host,
            port,
            timeout,
        ).await?;
    }
    
    #[cfg(not(feature = "serve"))]
    {
        anyhow::bail!("API server feature not enabled");
    }
    
    Ok(())
}

fn is_process_running(pid: u32) -> bool {
    #[cfg(unix)]
    {
        use std::process::Command;
        Command::new("kill")
            .arg("-0")
            .arg(pid.to_string())
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    
    #[cfg(not(unix))]
    {
        // For Windows, would need different implementation
        false
    }
}
