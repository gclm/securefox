mod commands;
mod utils;
#[cfg(target_os = "macos")]
mod tray_api_client;
#[cfg(target_os = "macos")]
mod tray_icons;

use anyhow::Result;
use clap::{Parser, Subcommand};
use colored::Colorize;
use std::path::PathBuf;

/// SecureFox - Local-first password manager
#[derive(Parser, Debug)]
#[command(name = "securefox")]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
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
    /// Initialize a new vault
    Init {
        /// Remote git repository URL
        #[arg(short, long)]
        remote: Option<String>,
        /// KDF algorithm to use (pbkdf2 or argon2)
        #[arg(long, default_value = "pbkdf2")]
        kdf: String,
    },
    /// Start the system tray application
    #[cfg(target_os = "macos")]
    Tray,

    /// Add a new item to the vault
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

    /// List items in the vault
    List {
        /// Filter by folder
        #[arg(short, long)]
        folder: Option<String>,

        /// Search query
        #[arg(short, long)]
        search: Option<String>,

        /// Show full details
        #[arg(short = 'd', long)]
        detailed: bool,
    },

    /// Edit an existing item
    Edit {
        /// Item ID or name
        item: String,
    },

    /// Remove an item from the vault
    Remove {
        /// Item ID or name
        item: String,

        /// Force removal without confirmation
        #[arg(short, long)]
        force: bool,
    },

    /// Show an item's details
    Show {
        /// Item ID or name
        item: String,

        /// Copy password to clipboard
        #[arg(short, long)]
        copy: bool,

        /// Show TOTP code
        #[arg(short = 't', long)]
        totp: bool,
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

    /// Sync with git remote
    Sync {
        /// Pull changes from remote
        #[arg(long)]
        pull: bool,

        /// Push changes to remote
        #[arg(long)]
        push: bool,
    },

    /// Generate a password
    Generate {
        /// Password length
        #[arg(short, long, default_value = "20")]
        length: usize,

        /// Include numbers
        #[arg(short = 'n', long, default_value = "true")]
        numbers: bool,

        /// Include symbols
        #[arg(short = 's', long, default_value = "true")]
        symbols: bool,

        /// Copy to clipboard
        #[arg(short, long)]
        copy: bool,
    },

    /// Start the HTTP API server
    #[cfg(feature = "serve")]
    Serve {
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

    /// Lock the vault
    Lock,

    /// Unlock the vault
    Unlock {
        /// Remember in keychain
        #[arg(short, long)]
        remember: bool,
    },

    /// Get TOTP code for an item
    Totp {
        /// Item ID or name
        item: String,

        /// Copy to clipboard
        #[arg(short, long)]
        copy: bool,
    },
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
        Commands::Init { remote, kdf } => {
            commands::init::execute(vault_path, remote, kdf).await
        }
        Commands::Add {
            name,
            item_type,
            username,
            generate,
            totp,
        } => {
            commands::add::execute(vault_path, name, item_type, username, generate, totp).await
        }
        Commands::List {
            folder,
            search,
            detailed,
        } => {
            commands::list::execute(vault_path, folder, search, detailed).await
        }
        Commands::Edit { item } => {
            commands::edit::execute(vault_path, item).await
        }
        Commands::Remove { item, force } => {
            commands::remove::execute(vault_path, item, force).await
        }
        Commands::Show { item, copy, totp } => {
            commands::show::execute(vault_path, item, copy, totp).await
        }
        Commands::Import { file, format } => {
            commands::import::execute(vault_path, file, format).await
        }
        Commands::Export { file, format } => {
            commands::export::execute(vault_path, file, format).await
        }
        Commands::Sync { pull, push } => {
            commands::sync::execute(vault_path, pull, push).await
        }
        Commands::Generate {
            length,
            numbers,
            symbols,
            copy,
        } => {
            commands::generate::execute(length, numbers, symbols, copy).await
        }
        #[cfg(feature = "serve")]
        Commands::Serve { port, host, timeout } => {
            commands::serve::execute(vault_path, host, port, timeout).await
        }
        Commands::Lock => {
            commands::lock::execute(vault_path).await
        }
        Commands::Unlock { remember } => {
            commands::unlock::execute(vault_path, remember).await
        }
        Commands::Totp { item, copy } => {
            commands::totp::execute(vault_path, item, copy).await
        }
        #[cfg(target_os = "macos")]
        Commands::Tray => {
            commands::tray::execute().await
        }
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