use anyhow::Result;
use colored::Colorize;
use comfy_table::{modifiers::UTF8_ROUND_CORNERS, presets::UTF8_FULL, Cell, Color, Table};
use securefox_core::models::ItemType;
use std::path::PathBuf;

pub async fn execute(
    vault_path: Option<PathBuf>,
    folder: Option<String>,
    search: Option<String>,
    detailed: bool,
) -> Result<()> {
    let vault_path = vault_path
        .ok_or_else(|| anyhow::anyhow!("Vault path not specified"))?
        .join("vault.sf");

    // Load vault
    let (vault, _) = crate::utils::load_vault(&vault_path)?;

    // Filter items
    let mut items = vault.items.clone();

    // Filter by folder
    if let Some(folder_name) = &folder {
        if let Some(folder) = vault.folders.iter().find(|f| f.name == *folder_name) {
            items.retain(|i| i.folder_id == Some(folder.id.clone()));
        }
    }

    // Filter by search
    if let Some(query) = &search {
        let query_lower = query.to_lowercase();
        items.retain(|i| {
            i.name.to_lowercase().contains(&query_lower)
                || i.notes
                    .as_ref()
                    .map(|n| n.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
                || (i
                    .login
                    .as_ref()
                    .and_then(|l| l.username.as_ref())
                    .map(|u| u.to_lowercase().contains(&query_lower))
                    .unwrap_or(false))
        });
    }

    if items.is_empty() {
        println!("No items found");
        return Ok(());
    }

    // Create table
    let mut table = Table::new();
    table
        .load_preset(UTF8_FULL)
        .apply_modifier(UTF8_ROUND_CORNERS);

    if detailed {
        table.set_header(vec![
            Cell::new("Name").fg(Color::Blue),
            Cell::new("Type").fg(Color::Blue),
            Cell::new("Username").fg(Color::Blue),
            Cell::new("URL").fg(Color::Blue),
            Cell::new("TOTP").fg(Color::Blue),
            Cell::new("Modified").fg(Color::Blue),
        ]);

        for item in items {
            let type_str = match item.item_type {
                ItemType::LOGIN => "Login".green(),
                ItemType::SECURE_NOTE => "Note".yellow(),
                ItemType::CARD => "Card".cyan(),
                ItemType::IDENTITY => "Identity".magenta(),
                _ => "Unknown".red(),
            };

            let username = item
                .login
                .as_ref()
                .and_then(|l| l.username.as_ref())
                .map(|u| u.as_str())
                .unwrap_or("-");

            let url = item
                .login
                .as_ref()
                .and_then(|l| l.uris.as_ref())
                .and_then(|uris| uris.first())
                .map(|u| u.uri.as_str())
                .unwrap_or("-");

            let has_totp = item
                .login
                .as_ref()
                .and_then(|l| l.totp.as_ref())
                .map(|_| "✓".green())
                .unwrap_or_else(|| "-".normal());

            let modified = item.revision_date.format("%Y-%m-%d").to_string();

            table.add_row(vec![
                Cell::new(&item.name),
                Cell::new(type_str),
                Cell::new(username),
                Cell::new(url),
                Cell::new(has_totp),
                Cell::new(modified),
            ]);
        }
    } else {
        table.set_header(vec![
            Cell::new("Name").fg(Color::Blue),
            Cell::new("Type").fg(Color::Blue),
            Cell::new("Username").fg(Color::Blue),
        ]);

        for item in items {
            let type_str = match item.item_type {
                ItemType::LOGIN => "Login",
                ItemType::SECURE_NOTE => "Note",
                ItemType::CARD => "Card",
                ItemType::IDENTITY => "Identity",
                _ => "Unknown",
            };

            let username = item
                .login
                .as_ref()
                .and_then(|l| l.username.as_ref())
                .map(|u| u.as_str())
                .unwrap_or("-");

            table.add_row(vec![
                Cell::new(&item.name),
                Cell::new(type_str),
                Cell::new(username),
            ]);
        }
    }

    println!("{table}");

    Ok(())
}
