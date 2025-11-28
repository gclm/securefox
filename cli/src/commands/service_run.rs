use anyhow::Result;
use chrono::Local;
use std::fs;
use std::path::PathBuf;

/// Internal command to actually run the service
/// This is called by `service start` in a background process
pub async fn execute(
    vault_path: Option<PathBuf>,
    host: String,
    port: u16,
    timeout: u64,
) -> Result<()> {
    let vault_path = vault_path.ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?;

    // Write PID file for service tracking
    let pid_file = vault_path.join("service.pid");
    let pid = std::process::id();
    if let Err(e) = fs::write(&pid_file, pid.to_string()) {
        eprintln!("Warning: Failed to write PID file: {}", e);
    }

    // Print startup information with timestamp
    let now = Local::now();
    println!(
        "[{}] SecureFox Service Starting...",
        now.format("%Y-%m-%d %H:%M:%S")
    );
    println!("[{}]   PID: {}", now.format("%Y-%m-%d %H:%M:%S"), pid);
    println!(
        "[{}]   Vault: {}",
        now.format("%Y-%m-%d %H:%M:%S"),
        vault_path.display()
    );
    println!(
        "[{}]   API: http://{}:{}",
        now.format("%Y-%m-%d %H:%M:%S"),
        host,
        port
    );
    println!(
        "[{}]   Timeout: {} seconds",
        now.format("%Y-%m-%d %H:%M:%S"),
        timeout
    );
    println!("[{}] {}", now.format("%Y-%m-%d %H:%M:%S"), "=".repeat(40));

    #[cfg(feature = "serve")]
    {
        // Ensure PID file is cleaned up on exit
        let vault_path_clone = vault_path.clone();
        let cleanup = move || {
            let pid_file = vault_path_clone.join("service.pid");
            let _ = fs::remove_file(&pid_file);
        };

        // Register cleanup handler
        ctrlc::set_handler(move || {
            cleanup();
            std::process::exit(0);
        })
        .ok();

        let result = securefox_api::run(vault_path.clone(), host, port, timeout).await;

        // Clean up PID file on normal exit
        let pid_file = vault_path.join("service.pid");
        let _ = fs::remove_file(&pid_file);

        result?;
    }

    #[cfg(not(feature = "serve"))]
    {
        anyhow::bail!("API server feature not enabled");
    }

    Ok(())
}
