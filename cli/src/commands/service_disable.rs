use anyhow::Result;
use dialoguer::Confirm;

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
    let home_dir =
        dirs::home_dir().ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?;

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
        .map_err(|e| anyhow::anyhow!("Failed to unload launchd service: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        eprintln!("Warning: Failed to unload service: {}", error);
    }

    // Remove plist file
    std::fs::remove_file(&plist_path)
        .map_err(|e| anyhow::anyhow!("Failed to remove plist file: {}", e))?;

    println!("✓ Service unloaded successfully");
    println!();

    // Ask user about removing the binary
    let binary_path = std::path::Path::new("/usr/local/bin/securefox");
    if binary_path.exists() {
        // Get current running binary path
        let current_exe = std::env::current_exe().ok();
        let current_canonical = current_exe.as_ref().and_then(|p| p.canonicalize().ok());
        let target_canonical = binary_path.canonicalize().ok();

        // Check if we're running from the same binary that would be deleted
        let is_same_binary = current_canonical
            .as_ref()
            .zip(target_canonical.as_ref())
            .map(|(a, b)| a == b)
            .unwrap_or(false);

        if is_same_binary {
            println!(
                "Note: You are currently running from {}",
                binary_path.display()
            );
        }

        let should_remove = Confirm::new()
            .with_prompt(format!(
                "Do you want to remove the binary at {}?",
                binary_path.display()
            ))
            .default(false)
            .interact()
            .unwrap_or(false);

        if should_remove {
            println!("Removing binary from {}...", binary_path.display());
            let remove_result = std::process::Command::new("sudo")
                .arg("rm")
                .arg("-f")
                .arg(binary_path)
                .status();

            match remove_result {
                Ok(status) if status.success() => {
                    println!("✓ Binary removed from {}", binary_path.display());
                }
                Ok(_) => {
                    eprintln!("Warning: Failed to remove binary (non-zero exit code)");
                    eprintln!("You may need to remove it manually with:");
                    eprintln!("  sudo rm {}", binary_path.display());
                }
                Err(e) => {
                    eprintln!("Warning: Failed to execute rm command: {}", e);
                    eprintln!("You may need to remove it manually with:");
                    eprintln!("  sudo rm {}", binary_path.display());
                }
            }
        } else {
            println!("Binary at {} was kept.", binary_path.display());
            println!("You can remove it later with:");
            println!("  sudo rm {}", binary_path.display());
        }
    } else {
        println!("No binary found at /usr/local/bin/securefox");
    }

    println!();
    println!("✓ Service disabled successfully");
    println!("  The service will no longer start automatically");

    Ok(())
}
