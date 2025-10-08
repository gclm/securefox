use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};

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
    
    // Get current executable path
    let exe_path = std::env::current_exe()
        .context("Failed to get current executable path")?;
    
    // Prepare log files
    let log_file = vault_path.join("service.log");
    let err_file = vault_path.join("service.err");
    
    // Spawn background process
    let child = Command::new(&exe_path)
        .arg("--vault")
        .arg(&vault_path)
        .arg("service")
        .arg("run")
        .arg("--host")
        .arg(&host)
        .arg("--port")
        .arg(port.to_string())
        .arg("--timeout")
        .arg(timeout.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::from(fs::File::create(&log_file)?))
        .stderr(Stdio::from(fs::File::create(&err_file)?))
        .spawn()
        .context("Failed to spawn background service")?;
    
    let pid = child.id();
    
    // Write PID file
    fs::write(&pid_file, pid.to_string())
        .context("Failed to write PID file")?;
    
    // Give the service a moment to start and bind the port
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Check if the process is still running
    if !is_process_running(pid) {
        // Clean up PID file
        let _ = fs::remove_file(&pid_file);
        anyhow::bail!(
            "Service failed to start. Check logs at {} and {}",
            log_file.display(),
            err_file.display()
        );
    }
    
    // Check if port is actually bound
    if !is_port_in_use(port) {
        // Clean up PID file
        let _ = fs::remove_file(&pid_file);
        anyhow::bail!(
            "Service started but failed to bind port {}. Check logs at {} and {}",
            port,
            log_file.display(),
            err_file.display()
        );
    }
    
    println!("✓ Service started successfully");
    println!("  PID: {}", pid);
    println!("  API: http://{}:{}", host, port);
    println!("  Vault: {}", vault_path.display());
    println!("  Logs: {}", log_file.display());
    
    Ok(())
}

fn is_process_running(pid: u32) -> bool {
    #[cfg(unix)]
    {
        use std::process::Command as StdCommand;
        StdCommand::new("kill")
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

fn is_port_in_use(port: u16) -> bool {
    #[cfg(unix)]
    {
        use std::process::Command as StdCommand;
        StdCommand::new("lsof")
            .arg("-i")
            .arg(format!(":{}", port))
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    
    #[cfg(not(unix))]
    {
        // For Windows, use netstat
        false
    }
}
