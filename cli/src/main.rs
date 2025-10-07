mod commands;
mod utils;
mod sync_daemon;

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

    /// Vault management commands
    Vault {
        #[command(subcommand)]
        command: VaultCommands,
    },

    /// Item management commands
    Item {
        #[command(subcommand)]
        command: ItemCommands,
    },

    /// Data import/export commands
    Data {
        #[command(subcommand)]
        command: DataCommands,
    },

    /// Utility tools
    Tools {
        #[command(subcommand)]
        command: ToolsCommands,
    },

    /// Background service management
    Service {
        #[command(subcommand)]
        command: ServiceCommands,
    },
}

#[derive(Subcommand, Debug)]
enum VaultCommands {
    /// Initialize a new vault
    Init {
        /// Remote git repository URL
        #[arg(short, long)]
        remote: Option<String>,
        /// KDF algorithm to use (pbkdf2 or argon2)
        #[arg(long, default_value = "pbkdf2")]
        kdf: String,
    },

    /// Lock the vault
    Lock,

    /// Unlock the vault
    Unlock {
        /// Remember in keychain
        #[arg(short, long)]
        remember: bool,
    },

    /// Sync with git remote
    Sync {
        #[command(subcommand)]
        command: SyncCommands,
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
        /// Sync mode: manual, auto-pull, push-on-change, full
        #[arg(short, long, default_value = "manual")]
        mode: String,
        
        /// Sync interval in seconds (for auto-pull and full modes)
        #[arg(short, long, default_value = "300")]
        interval: u64,
    },
    
    /// Disable auto-sync
    Disable,
    
    /// Show auto-sync configuration
    Show,
}

#[derive(Subcommand, Debug)]
enum ItemCommands {
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
}

#[derive(Subcommand, Debug)]
enum DataCommands {
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
}

#[derive(Subcommand, Debug)]
enum ToolsCommands {
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
}

#[derive(Subcommand, Debug)]
enum ServiceCommands {
    /// Start background service (API + Tray)
    Start {
        /// Port to listen on
        #[arg(short, long, default_value = "8787")]
        port: u16,

        /// Host to bind to
        #[arg(short = 'H', long, default_value = "127.0.0.1")]
        host: String,

        /// Unlock timeout in seconds
        #[arg(short = 't', long, default_value = "900")]
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
        #[arg(short = 't', long, default_value = "900")]
        timeout: u64,
    },

    /// Show service status
    Status,

    /// Install as system service (launchd on macOS)
    Install,

    /// Uninstall system service
    Uninstall,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Setup logging
    let log_level = if cli.verbose { "debug" } else { "info" };
    tracing_subscriber::fmt()
        .with_env_filter(log_level)
        .init();

    // Get vault path
    let vault_path = cli.vault.or_else(|| {
        dirs::home_dir().map(|h| h.join(".securefox"))
    });

    // Execute command
    let result = match cli.command {
        Commands::Version => {
            print_version_info();
            return Ok(());
        }
        
        Commands::Vault { command } => match command {
            VaultCommands::Init { remote, kdf } => {
                commands::init::execute(vault_path, remote, kdf).await
            }
            VaultCommands::Lock => {
                commands::lock::execute(vault_path).await
            }
            VaultCommands::Unlock { remember } => {
                commands::unlock::execute(vault_path, remember).await
            }
            VaultCommands::Sync { command } => match command {
                SyncCommands::Push => {
                    commands::sync::execute(vault_path, false, true).await
                }
                SyncCommands::Pull => {
                    commands::sync::execute(vault_path, true, false).await
                }
                SyncCommands::Config { url } => {
                    commands::sync_config::execute(vault_path, url).await
                }
                SyncCommands::Status => {
                    commands::sync_status::execute(vault_path).await
                }
                SyncCommands::Enable { mode, interval } => {
                    commands::sync_enable::execute(vault_path, mode, interval).await
                }
                SyncCommands::Disable => {
                    commands::sync_disable::execute(vault_path).await
                }
                SyncCommands::Show => {
                    commands::sync_show::execute(vault_path).await
                }
            },
        },

        Commands::Item { command } => match command {
            ItemCommands::Add {
                name,
                item_type,
                username,
                generate,
                totp,
            } => {
                commands::add::execute(vault_path, name, item_type, username, generate, totp).await
            }
            ItemCommands::List {
                item_type,
                search,
                detailed,
            } => {
                commands::list::execute(vault_path, item_type, search, detailed).await
            }
            ItemCommands::Show { name, copy, totp } => {
                commands::show::execute(vault_path, name, copy, totp).await
            }
            ItemCommands::Edit { name } => {
                commands::edit::execute(vault_path, name).await
            }
            ItemCommands::Remove { name, force } => {
                commands::remove::execute(vault_path, name, force).await
            }
        },

        Commands::Data { command } => match command {
            DataCommands::Import { file, format } => {
                commands::import::execute(vault_path, file, format).await
            }
            DataCommands::Export { file, format } => {
                commands::export::execute(vault_path, file, format).await
            }
        },

        Commands::Tools { command } => match command {
            ToolsCommands::Generate {
                length,
                numbers,
                symbols,
                copy,
            } => {
                commands::generate::execute(length, numbers, symbols, copy).await
            }
            ToolsCommands::Totp { name, copy } => {
                commands::totp::execute(vault_path, name, copy).await
            }
        },

        Commands::Service { command } => match command {
            ServiceCommands::Start { port, host, timeout } => {
                commands::service_start::execute(vault_path, host, port, timeout).await
            }
            ServiceCommands::Stop => {
                commands::service_stop::execute().await
            }
            ServiceCommands::Restart { port, host, timeout } => {
                commands::service_restart::execute(vault_path, host, port, timeout).await
            }
            ServiceCommands::Status => {
                commands::service_status::execute().await
            }
            ServiceCommands::Install => {
                commands::service_install::execute().await
            }
            ServiceCommands::Uninstall => {
                commands::service_uninstall::execute().await
            }
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