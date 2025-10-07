use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

pub async fn execute() -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        install_launchd_service().await
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        anyhow::bail!("Service installation is only supported on macOS");
    }
}

#[cfg(target_os = "macos")]
async fn install_launchd_service() -> Result<()> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?;
    
    let vault_path = home_dir.join(".securefox");
    let launch_agents_dir = home_dir.join("Library/LaunchAgents");
    let plist_path = launch_agents_dir.join("com.gclm.securefox.plist");
    
    // Get current executable path
    let current_exe = std::env::current_exe()
        .context("Failed to get current executable path")?;
    
    // Install binary to /usr/local/bin
    let target_path = PathBuf::from("/usr/local/bin/securefox");
    
    println!("Installing securefox to {}...", target_path.display());
    
    // Check if /usr/local/bin exists, create if not
    let target_dir = PathBuf::from("/usr/local/bin");
    if !target_dir.exists() {
        println!("Creating directory: {}", target_dir.display());
        std::process::Command::new("sudo")
            .arg("mkdir")
            .arg("-p")
            .arg(&target_dir)
            .status()
            .context("Failed to create /usr/local/bin directory")?;
    }
    
    // Copy executable to /usr/local/bin using sudo
    let copy_result = std::process::Command::new("sudo")
        .arg("cp")
        .arg(&current_exe)
        .arg(&target_path)
        .status()
        .context("Failed to copy executable")?;
    
    if !copy_result.success() {
        anyhow::bail!("Failed to copy executable to {}", target_path.display());
    }
    
    // Make it executable
    std::process::Command::new("sudo")
        .arg("chmod")
        .arg("+x")
        .arg(&target_path)
        .status()
        .context("Failed to set executable permissions")?;
    
    println!("✓ Binary installed to {}", target_path.display());
    
    // Use the installed path for launchd
    let exe_path = target_path;
    
    // Ensure LaunchAgents directory exists
    fs::create_dir_all(&launch_agents_dir)
        .context("Failed to create LaunchAgents directory")?;
    
    // Generate plist content
    let plist_content = generate_plist(&exe_path, &vault_path)?;
    
    // Write plist file
    fs::write(&plist_path, plist_content)
        .context("Failed to write plist file")?;
    
    // Load the service
    let output = std::process::Command::new("launchctl")
        .arg("load")
        .arg(&plist_path)
        .output()
        .context("Failed to load launchd service")?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Failed to load service: {}", error);
    }
    
    println!();
    println!("✓ Service installed successfully");
    println!("  Binary: /usr/local/bin/securefox");
    println!("  Plist:  {}", plist_path.display());
    println!();
    println!("The service will start automatically on login.");
    println!();
    println!("To start the service now, run:");
    println!("  securefox service start");
    println!();
    println!("To check service status:");
    println!("  securefox service status");
    
    Ok(())
}

#[cfg(target_os = "macos")]
fn generate_plist(exe_path: &PathBuf, vault_path: &PathBuf) -> Result<String> {
    let log_file = vault_path.join("service.log");
    let err_file = vault_path.join("service.err");
    
    let plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gclm.securefox</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
        <string>--vault</string>
        <string>{}</string>
        <string>service</string>
        <string>start</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>{}</string>
    
    <key>StandardErrorPath</key>
    <string>{}</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>"#,
        exe_path.display(),
        vault_path.display(),
        log_file.display(),
        err_file.display()
    );
    
    Ok(plist)
}
