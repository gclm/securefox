use anyhow::Result;
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use securefox_core::{importers::{bitwarden::BitwardenImporter, Importer}, storage::VaultStorage};
use std::path::PathBuf;

pub async fn execute(
    vault_path: Option<PathBuf>,
    file: PathBuf,
    format: String,
) -> Result<()> {
    let vault_path = vault_path
        .ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?
        .join("vault.sf");
    
    println!("{} from {}", 
        "Importing".cyan().bold(), 
        file.display()
    );
    
    // Read import file
    let data = std::fs::read_to_string(&file)?;
    
    // Import based on format
    let imported_vault = match format.as_str() {
        "bitwarden" => {
            let importer = BitwardenImporter::new();
            importer.import(&data)?
        }
        _ => return Err(anyhow::anyhow!("Unsupported import format: {}", format)),
    };
    
    let item_count = imported_vault.items.len();
    let folder_count = imported_vault.folders.len();
    
    println!("Found {} items and {} folders to import", 
        item_count.to_string().green().bold(),
        folder_count.to_string().green().bold()
    );
    
    // Load existing vault or create new one
    let storage = VaultStorage::with_path(&vault_path);
    let (mut vault, password) = if storage.exists() {
        println!("Merging with existing vault...");
        crate::utils::load_vault(&vault_path)?
    } else {
        println!("Creating new vault...");
        use dialoguer::Password;
        let password = Password::new()
            .with_prompt("Enter master password for new vault")
            .with_confirmation("Confirm master password", "Passwords do not match")
            .interact()?;
        (securefox_core::models::Vault::new(), password)
    };
    
    // Import with progress bar
    let pb = ProgressBar::new((item_count + folder_count) as u64);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} {msg}")
            .unwrap()
            .progress_chars("#>-"),
    );
    
    // Import folders
    for folder in imported_vault.folders {
        pb.set_message(format!("Importing folder: {}", folder.name));
        if !vault.folders.iter().any(|f| f.id == folder.id) {
            vault.folders.push(folder);
        }
        pb.inc(1);
    }
    
    // Import items
    for item in imported_vault.items {
        pb.set_message(format!("Importing: {}", item.name));
        if !vault.items.iter().any(|i| i.id == item.id) {
            vault.add_item(item);
        }
        pb.inc(1);
    }
    
    pb.finish_with_message("Import complete");
    
    // Save vault
    storage.save(&vault, &password)?;
    
    // Git sync
    #[cfg(feature = "git")]
    {
        use securefox_core::git_sync::GitSync;
        if let Some(parent) = vault_path.parent() {
            let sync = GitSync::init(parent)?;
            sync.auto_commit_push(&format!("Imported {} items from {}", item_count, format))?;
        }
    }
    
    println!("{} Successfully imported {} items", 
        "✓".green().bold(),
        item_count
    );
    
    Ok(())
}
