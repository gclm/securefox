use anyhow::Result;
#[cfg(target_os = "macos")]
use dialoguer::Confirm;

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
    let home_dir =
        dirs::home_dir().ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?;

    let vault_path = home_dir.join(".securefox");
    let launch_agents_dir = home_dir.join("Library/LaunchAgents");
    let plist_path = launch_agents_dir.join("com.gclm.securefox.plist");

    // Get current executable path
    let current_exe = std::env::current_exe()
        .map_err(|e| anyhow::anyhow!("Failed to get current executable path: {}", e))?;

    // Canonicalize to resolve symlinks and get absolute paths
    let current_exe_canonical = current_exe
        .canonicalize()
        .unwrap_or_else(|_| current_exe.clone());

    // Install binary to /usr/local/bin
    let target_path = std::path::PathBuf::from("/usr/local/bin/securefox");
    let target_canonical = target_path
        .canonicalize()
        .unwrap_or_else(|_| target_path.clone());

    // Check if source and target are the same
    if current_exe_canonical == target_canonical {
        println!("✓ Binary already installed at {}", target_path.display());
    } else if target_path.exists() {
        // Target exists but is different - check versions
        let current_version = get_binary_version(&current_exe)?;
        let target_version = get_binary_version(&target_path)?;

        println!("Found existing securefox installation:");
        println!(
            "  Current binary: {} (version: {})",
            current_exe.display(),
            current_version
        );
        println!(
            "  Installed binary: {} (version: {})",
            target_path.display(),
            target_version
        );
        println!();

        if current_version == target_version {
            println!("✓ Versions are identical, no update needed.");
        } else {
            let should_update = Confirm::new()
                .with_prompt(format!(
                    "Do you want to update from {} to {}?",
                    target_version, current_version
                ))
                .default(false)
                .interact()
                .unwrap_or(false);

            if !should_update {
                println!("Skipping binary update. Using existing installation.");
            } else {
                println!("Updating securefox to {}...", target_path.display());

                // Copy executable to /usr/local/bin using sudo
                let copy_result = std::process::Command::new("sudo")
                    .arg("cp")
                    .arg("-f") // Force overwrite
                    .arg(&current_exe)
                    .arg(&target_path)
                    .status()
                    .map_err(|e| anyhow::anyhow!("Failed to copy executable: {}", e))?;

                if !copy_result.success() {
                    anyhow::bail!("Failed to update executable to {}", target_path.display());
                }

                // Make it executable
                std::process::Command::new("sudo")
                    .arg("chmod")
                    .arg("+x")
                    .arg(&target_path)
                    .status()
                    .map_err(|e| anyhow::anyhow!("Failed to set executable permissions: {}", e))?;

                println!("✓ Binary updated to {}", target_path.display());
            }
        }
    } else {
        println!("Installing securefox to {}...", target_path.display());

        // Check if /usr/local/bin exists, create if not
        let target_dir = std::path::PathBuf::from("/usr/local/bin");
        if !target_dir.exists() {
            println!("Creating directory: {}", target_dir.display());
            std::process::Command::new("sudo")
                .arg("mkdir")
                .arg("-p")
                .arg(&target_dir)
                .status()
                .map_err(|e| anyhow::anyhow!("Failed to create /usr/local/bin directory: {}", e))?;
        }

        // Copy executable to /usr/local/bin using sudo
        let copy_result = std::process::Command::new("sudo")
            .arg("cp")
            .arg(&current_exe)
            .arg(&target_path)
            .status()
            .map_err(|e| anyhow::anyhow!("Failed to copy executable: {}", e))?;

        if !copy_result.success() {
            anyhow::bail!("Failed to copy executable to {}", target_path.display());
        }

        // Make it executable
        std::process::Command::new("sudo")
            .arg("chmod")
            .arg("+x")
            .arg(&target_path)
            .status()
            .map_err(|e| anyhow::anyhow!("Failed to set executable permissions: {}", e))?;

        println!("✓ Binary installed to {}", target_path.display());
    }

    // Use the installed path for launchd
    let exe_path = target_path;

    // Ensure LaunchAgents directory exists
    std::fs::create_dir_all(&launch_agents_dir)
        .map_err(|e| anyhow::anyhow!("Failed to create LaunchAgents directory: {}", e))?;

    // Generate plist content
    let plist_content = generate_plist(&exe_path, &vault_path)?;

    // Write plist file
    std::fs::write(&plist_path, plist_content)
        .map_err(|e| anyhow::anyhow!("Failed to write plist file: {}", e))?;

    // Unload the service first if it exists (ignore errors)
    let _ = std::process::Command::new("launchctl")
        .arg("bootout")
        .arg(format!("gui/{}", users::get_current_uid()))
        .arg(&plist_path)
        .output();

    // Bootstrap the service (this ensures it persists across reboots)
    let output = std::process::Command::new("launchctl")
        .arg("bootstrap")
        .arg(format!("gui/{}", users::get_current_uid()))
        .arg(&plist_path)
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to bootstrap launchd service: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        // If service is already loaded, that's okay
        if !error.contains("already loaded") && !error.contains("service already loaded") {
            anyhow::bail!("Failed to bootstrap service: {}", error);
        }
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
fn get_binary_version(binary_path: &std::path::Path) -> Result<String> {
    let output = std::process::Command::new(binary_path)
        .arg("version")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout);

            // Parse version info: Version, Git Branch, Git Commit
            let mut version = String::from("unknown");
            let mut branch = String::from("unknown");
            let mut commit = String::from("unknown");

            for line in version_str.lines() {
                if let Some(value) = line.strip_prefix("Version:") {
                    version = value.trim().to_string();
                } else if let Some(value) = line.strip_prefix("Git Branch:") {
                    branch = value.trim().to_string();
                } else if let Some(value) = line.strip_prefix("Git Commit:") {
                    commit = value.trim().to_string();
                }
            }

            Ok(format!("{} ({}@{})", version, branch, commit))
        }
        _ => Ok("unknown".to_string()),
    }
}

#[cfg(target_os = "macos")]
fn generate_plist(exe_path: &std::path::Path, vault_path: &std::path::Path) -> Result<String> {
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
