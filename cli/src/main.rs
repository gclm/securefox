mod commands;
mod sync_daemon;
mod utils;

use anyhow::Result;
use clap::{Parser, Subcommand};
use colored::Colorize;
use std::path::PathBuf;
const GIT_HASH: &str = env!("GIT_HASH");
const GIT_BRANCH: &str = env!("GIT_BRANCH");
const BUILD_TIME: &str = env!("BUILD_TIME");
const GIT_DIRTY: &str = env!("GIT_DIRTY");
const RUSTC_VERSION: &str = env!("RUSTC_VERSION");
const VERSION: &str = env!("CARGO_PKG_VERSION");

fn print_version_info() {
    let dirty_marker = if GIT_DIRTY == "dirty" { "-dirty" } else { "" };

    println!("{}", "SecureFox".bold());
    println!("─────────────────────────────────────────");
    println!("Version:      {}", VERSION.cyan());
    println!("Git Branch:   {}", GIT_BRANCH.cyan());
    println!("Git Commit:   {}{}", GIT_HASH.cyan(), dirty_marker.yellow());
    println!("Build Time:   {}", BUILD_TIME.cyan());
    println!("Rust Version: {}", RUSTC_VERSION.cyan());
}

/// SecureFox - Local-first password manager
#[derive(Parser, Debug)]
#[command(name = "securefox")]
#[command(author, about, long_about = None)]
#[command(disable_version_flag = true)]
#[command(propagate_version = false)]
struct Cli {
    /// Path to vault file
    #[arg(short, long, env = "SECUREFOX_VAULT")]
    vault: Option<PathBuf>,

    /// Verbose output
    #[arg(short, long, env = "SECUREFOX_VERBOSE")]
    verbose: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Show detailed version information
    Version,

    /// Initialize a new vault
    Init {
        /// Remote git repository URL
        #[arg(short, long)]
        remote: Option<String>,
        /// KDF algorithm to use (pbkdf2 or argon2)
        #[arg(long, default_value = "pbkdf2")]
        kdf: String,
    },

    /// Unlock the vault
    Unlock {
        /// Remember in keychain
        #[arg(short, long)]
        remember: bool,
    },

    /// Lock the vault
    Lock,

    /// Add a new item
    Add {
        /// Item name
        name: String,

        /// Item type (login, note, card, identity)
        #[arg(short = 't', long, default_value = "login")]
        item_type: String,

        /// Username (for login items)
        #[arg(short, long)]
        username: Option<String>,

        /// Generate password
        #[arg(short = 'g', long)]
        generate: bool,

        /// TOTP secret
        #[arg(long)]
        totp: Option<String>,
    },

    /// List items
    List {
        /// Filter by type
        #[arg(short = 't', long)]
        item_type: Option<String>,

        /// Search query
        #[arg(short, long)]
        search: Option<String>,

        /// Show full details
        #[arg(short = 'd', long)]
        detailed: bool,
    },

    /// Show item details
    Show {
        /// Item ID or name
        name: String,

        /// Copy password to clipboard
        #[arg(short, long)]
        copy: bool,

        /// Show TOTP code
        #[arg(short = 't', long)]
        totp: bool,
    },

    /// Edit an existing item
    Edit {
        /// Item ID or name
        name: String,
    },

    /// Remove an item
    Remove {
        /// Item ID or name
        name: String,

        /// Force removal without confirmation
        #[arg(short, long)]
        force: bool,
    },

    /// Generate a password
    Generate {
        /// Password length
        #[arg(short, long, default_value = "16")]
        length: usize,

        /// Include numbers
        #[arg(short = 'n', long, default_value = "true")]
        numbers: bool,

        /// Include symbols
        #[arg(short = 's', long, default_value = "false")]
        symbols: bool,

        /// Copy to clipboard
        #[arg(short, long)]
        copy: bool,
    },

    /// Get TOTP code for an item
    Totp {
        /// Item ID or name
        name: String,

        /// Copy to clipboard
        #[arg(short, long)]
        copy: bool,
    },

    /// Import data from another password manager
    Import {
        /// Import file path
        file: PathBuf,

        /// Import format (bitwarden, csv)
        #[arg(short = 'f', long, default_value = "bitwarden")]
        format: String,
    },

    /// Export vault data
    Export {
        /// Export file path
        file: PathBuf,

        /// Export format (bitwarden, csv)
        #[arg(short = 'f', long, default_value = "bitwarden")]
        format: String,
    },

    /// Git synchronization commands
    Sync {
        #[command(subcommand)]
        command: Option<SyncCommands>,
    },

    /// Background service management
    Service {
        #[command(subcommand)]
        command: ServiceCommands,
    },
}

#[derive(Subcommand, Debug)]
enum SyncCommands {
    /// Push changes to remote
    Push,

    /// Pull changes from remote
    Pull,

    /// Configure git remote URL
    Config {
        /// Remote git repository URL
        url: String,
    },

    /// Show sync status
    Status,

    /// Enable auto-sync
    Enable {
        /// Sync mode: manual or auto
        #[arg(short, long, default_value = "manual")]
        mode: String,

        /// Sync interval in seconds (for auto mode)
        #[arg(short, long, default_value = "600")]
        interval: u64,
    },

    /// Disable auto-sync
    Disable,
}

#[derive(Subcommand, Debug)]
enum ServiceCommands {
    /// Start background service
    Start {
        /// Port to listen on
        #[arg(short, long, default_value = "8787")]
        port: u16,

        /// Host to bind to
        #[arg(short = 'H', long, default_value = "127.0.0.1")]
        host: String,

        /// Unlock timeout in seconds
        #[arg(short = 't', long, default_value = "1800")]
        timeout: u64,
    },

    /// Stop background service
    Stop,

    /// Restart background service
    Restart {
        /// Port to listen on
        #[arg(short, long, default_value = "8787")]
        port: u16,

        /// Host to bind to
        #[arg(short = 'H', long, default_value = "127.0.0.1")]
        host: String,

        /// Unlock timeout in seconds
        #[arg(short = 't', long, default_value = "1800")]
        timeout: u64,
    },

    /// Show service status
    Status,

    /// Enable system service (auto-start on boot)
    Install,

    /// Disable system service (remove auto-start)
    Uninstall,

    /// Internal: Actually run the service (hidden command)
    #[command(hide = true)]
    Run {
        /// Port to listen on
        #[arg(short, long, default_value = "8787")]
        port: u16,

        /// Host to bind to
        #[arg(short = 'H', long, default_value = "127.0.0.1")]
        host: String,

        /// Unlock timeout in seconds
        #[arg(short = 't', long, default_value = "1800")]
        timeout: u64,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Setup logging
    let log_level = if cli.verbose { "debug" } else { "info" };
    tracing_subscriber::fmt().with_env_filter(log_level).init();

    // Get vault path
    let vault_path = cli
        .vault
        .or_else(|| dirs::home_dir().map(|h| h.join(".securefox")));

    // Execute command
    let result = match cli.command {
        Commands::Version => {
            print_version_info();
            return Ok(());
        }

        Commands::Init { remote, kdf } => commands::init::execute(vault_path, remote, kdf).await,
        Commands::Lock => commands::lock::execute(vault_path).await,
        Commands::Unlock { remember } => commands::unlock::execute(vault_path, remember).await,

        Commands::Add {
            name,
            item_type,
            username,
            generate,
            totp,
        } => commands::add::execute(vault_path, name, item_type, username, generate, totp).await,
        Commands::List {
            item_type,
            search,
            detailed,
        } => commands::list::execute(vault_path, item_type, search, detailed).await,
        Commands::Show { name, copy, totp } => {
            commands::show::execute(vault_path, name, copy, totp).await
        }
        Commands::Edit { name } => commands::edit::execute(vault_path, name).await,
        Commands::Remove { name, force } => {
            commands::remove::execute(vault_path, name, force).await
        }

        Commands::Generate {
            length,
            numbers,
            symbols,
            copy,
        } => commands::generate::execute(length, numbers, symbols, copy).await,
        Commands::Totp { name, copy } => commands::totp::execute(vault_path, name, copy).await,

        Commands::Import { file, format } => {
            commands::import::execute(vault_path, file, format).await
        }
        Commands::Export { file, format } => {
            commands::export::execute(vault_path, file, format).await
        }

        Commands::Sync { command } => match command {
            None => {
                // Default: sync both ways (pull then push)
                commands::sync::execute(vault_path.clone(), true, false).await?;
                commands::sync::execute(vault_path, false, true).await
            }
            Some(SyncCommands::Push) => commands::sync::execute(vault_path, false, true).await,
            Some(SyncCommands::Pull) => commands::sync::execute(vault_path, true, false).await,
            Some(SyncCommands::Config { url }) => {
                commands::sync_config::execute(vault_path, url).await
            }
            Some(SyncCommands::Status) => commands::sync_status::execute(vault_path).await,
            Some(SyncCommands::Enable { mode, interval }) => {
                commands::sync_enable::execute(vault_path, mode, interval).await
            }
            Some(SyncCommands::Disable) => commands::sync_disable::execute(vault_path).await,
        },

        Commands::Service { command } => match command {
            ServiceCommands::Start {
                port,
                host,
                timeout,
            } => commands::service_start::execute(vault_path, host, port, timeout).await,
            ServiceCommands::Stop => commands::service_stop::execute().await,
            ServiceCommands::Restart {
                port,
                host,
                timeout,
            } => commands::service_restart::execute(vault_path, host, port, timeout).await,
            ServiceCommands::Status => commands::service_status::execute().await,
            ServiceCommands::Install => commands::service_enable::execute().await,
            ServiceCommands::Uninstall => commands::service_disable::execute().await,
            ServiceCommands::Run {
                port,
                host,
                timeout,
            } => commands::service_run::execute(vault_path, host, port, timeout).await,
        },
    };

    match result {
        Ok(_) => {
            println!("{}", "✓ Success".green().bold());
            Ok(())
        }
        Err(e) => {
            eprintln!("{} {}", "✗ Error:".red().bold(), e);
            std::process::exit(1);
        }
    }
}
