use anyhow::{Context, Result};
use std::fs;

pub async fn execute() -> Result<()> {
    let vault_path = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?
        .join(".securefox");

    let pid_file = vault_path.join("service.pid");

    if !pid_file.exists() {
        anyhow::bail!("Service is not running (no PID file found)");
    }

    let pid_str = fs::read_to_string(&pid_file).context("Failed to read PID file")?;
    let pid: u32 = pid_str.trim().parse().context("Invalid PID in file")?;

    // Try to stop the process
    #[cfg(unix)]
    {
        use std::process::Command;
        let result = Command::new("kill")
            .arg(pid.to_string())
            .output()
            .context("Failed to send kill signal")?;

        if result.status.success() {
            // Wait a bit for graceful shutdown
            std::thread::sleep(std::time::Duration::from_secs(1));

            // Check if still running
            let still_running = Command::new("kill")
                .arg("-0")
                .arg(pid.to_string())
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false);

            if still_running {
                // Force kill if still running
                Command::new("kill")
                    .arg("-9")
                    .arg(pid.to_string())
                    .output()
                    .context("Failed to force kill process")?;

                println!("⚠ Service forcefully stopped");
            } else {
                println!("✓ Service stopped gracefully");
            }
        } else {
            anyhow::bail!("Failed to stop service (PID: {})", pid);
        }
    }

    #[cfg(not(unix))]
    {
        anyhow::bail!("Service stop not implemented for this platform");
    }

    // Clean up PID file
    fs::remove_file(&pid_file).context("Failed to remove PID file")?;

    Ok(())
}
