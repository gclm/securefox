use anyhow::Result;
use colored::Colorize;
use std::fs;

pub async fn execute() -> Result<()> {
    let vault_path = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?
        .join(".securefox");

    let pid_file = vault_path.join("service.pid");

    println!("{}", "Service Status".bold());
    println!("───────────────────────────────────");

    if !pid_file.exists() {
        println!("Status: {}", "Not running".yellow());
        return Ok(());
    }

    let pid_str = fs::read_to_string(&pid_file)
        .map_err(|e| anyhow::anyhow!("Failed to read PID file: {}", e))?;
    let pid: u32 = pid_str
        .trim()
        .parse()
        .map_err(|e| anyhow::anyhow!("Invalid PID in file: {}", e))?;

    // Check if process is running
    let is_running = check_process_running(pid);

    if is_running {
        println!("Status: {}", "Running".green());
        println!("PID: {}", pid);
        println!("API: http://127.0.0.1:8787");

        // Get binary path from process
        #[cfg(target_os = "macos")]
        {
            if let Ok(binary_path) = get_process_binary(pid) {
                println!("Binary: {}", binary_path);

                // Get version of the running binary
                if let Ok(version) = get_binary_version(&binary_path) {
                    println!("Version: {}", version);
                }
            }
        }

        // Try to get process info
        #[cfg(target_os = "macos")]
        {
            if let Ok(output) = std::process::Command::new("ps")
                .arg("-p")
                .arg(pid.to_string())
                .arg("-o")
                .arg("etime=,rss=")
                .output()
            {
                if let Ok(info) = String::from_utf8(output.stdout) {
                    let parts: Vec<&str> = info.split_whitespace().collect();
                    if parts.len() >= 2 {
                        println!("Uptime: {}", parts[0]);
                        let mem_kb: usize = parts[1].parse().unwrap_or(0);
                        println!("Memory: {} MB", mem_kb / 1024);
                    }
                }
            }
        }
    } else {
        println!("Status: {}", "Stopped (stale PID file)".yellow());
        println!("PID file exists but process is not running");
    }

    Ok(())
}

fn check_process_running(pid: u32) -> bool {
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
        false
    }
}

#[cfg(target_os = "macos")]
fn get_process_binary(pid: u32) -> Result<String> {
    use std::process::Command;

    let output = Command::new("ps")
        .arg("-p")
        .arg(pid.to_string())
        .arg("-o")
        .arg("comm=")
        .output()?;

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(path)
    } else {
        anyhow::bail!("Failed to get process binary path")
    }
}

#[cfg(target_os = "macos")]
fn get_binary_version(binary_path: &str) -> Result<String> {
    use std::process::Command;

    let output = Command::new(binary_path).arg("version").output();

    match output {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout);

            // Parse version line
            for line in version_str.lines() {
                if let Some(value) = line.strip_prefix("Version:") {
                    return Ok(value.trim().to_string());
                }
            }
            Ok("unknown".to_string())
        }
        _ => Ok("unknown".to_string()),
    }
}
