use anyhow::{Context, Result};
use std::fs;

pub async fn execute() -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        uninstall_launchd_service().await
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        anyhow::bail!("Service uninstallation is only supported on macOS");
    }
}

#[cfg(target_os = "macos")]
async fn uninstall_launchd_service() -> Result<()> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?;
    
    let plist_path = home_dir.join("Library/LaunchAgents/com.gclm.securefox.plist");
    
    if !plist_path.exists() {
        anyhow::bail!("Service is not installed");
    }
    
    // Try to stop the service first
    let _ = std::process::Command::new("launchctl")
        .arg("stop")
        .arg("com.gclm.securefox")
        .output();
    
    // Unload the service
    let output = std::process::Command::new("launchctl")
        .arg("unload")
        .arg(&plist_path)
        .output()
        .context("Failed to unload launchd service")?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        eprintln!("Warning: Failed to unload service: {}", error);
    }
    
    // Remove plist file
    fs::remove_file(&plist_path)
        .context("Failed to remove plist file")?;
    
    // Remove binary from /usr/local/bin
    let binary_path = "/usr/local/bin/securefox";
    if std::path::Path::new(binary_path).exists() {
        println!("Removing binary from {}...", binary_path);
        let remove_result = std::process::Command::new("sudo")
            .arg("rm")
            .arg("-f")
            .arg(binary_path)
            .status();
        
        match remove_result {
            Ok(status) if status.success() => {
                println!("✓ Binary removed from {}", binary_path);
            }
            _ => {
                eprintln!("Warning: Failed to remove binary from {}", binary_path);
                eprintln!("You may need to remove it manually.");
            }
        }
    }
    
    println!();
    println!("✓ Service uninstalled successfully");
    println!("  The service will no longer start automatically");
    
    Ok(())
}
