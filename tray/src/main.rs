use anyhow::Result;
use muda::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use std::sync::Arc;
use tao::{
    event::{Event, StartCause, WindowEvent},
    event_loop::{ControlFlow, EventLoop, EventLoopBuilder},
    window::WindowBuilder,
};
use tray_icon::{
    menu::{AboutMetadata, MenuEvent, MenuItemBuilder},
    TrayIcon, TrayIconBuilder,
};

mod api_client;
mod icons;

use api_client::ApiClient;

#[derive(Clone)]
struct AppState {
    api_client: Arc<ApiClient>,
    locked: bool,
}

fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    // Create event loop
    let event_loop = EventLoopBuilder::new().build();
    
    // Load tray icon
    let icon = icons::get_tray_icon()?;

    // Create menu
    let tray_menu = create_tray_menu();

    // Create system tray
    let mut tray_icon = TrayIconBuilder::new()
        .with_menu(Box::new(tray_menu))
        .with_tooltip("SecureFox")
        .with_icon(icon)
        .build()?;

    // Create API client
    let api_client = Arc::new(ApiClient::new("http://127.0.0.1:8787"));
    
    let mut app_state = AppState {
        api_client: api_client.clone(),
        locked: true,
    };

    // Check initial status
    let api_client_clone = api_client.clone();
    tokio::spawn(async move {
        if let Ok(status) = api_client_clone.status().await {
            tracing::info!("API Status: locked={}, vault_exists={}", 
                status.locked, status.vault_exists);
        }
    });

    // Run event loop
    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        // Handle menu events
        if let Ok(event) = MenuEvent::receiver().try_recv() {
            handle_menu_event(event, &mut app_state, &mut tray_icon);
        }

        match event {
            Event::NewEvents(StartCause::Init) => {
                tracing::info!("SecureFox tray started");
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                *control_flow = ControlFlow::Exit;
            }
            _ => {}
        }
    });
}

fn create_tray_menu() -> Menu {
    let menu = Menu::new();
    
    // Unlock/Lock
    let unlock_item = MenuItemBuilder::new()
        .text("Unlock Vault")
        .id(1)
        .build();
    
    let lock_item = MenuItemBuilder::new()
        .text("Lock Vault")
        .id(2)
        .enabled(false)
        .build();
    
    menu.append(&unlock_item).unwrap();
    menu.append(&lock_item).unwrap();
    menu.append(&PredefinedMenuItem::separator()).unwrap();
    
    // Quick access
    let quick_menu = Submenu::new("Quick Access", true);
    quick_menu.append(&MenuItemBuilder::new()
        .text("Open Extension")
        .id(10)
        .build()).unwrap();
    quick_menu.append(&MenuItemBuilder::new()
        .text("Generate Password")
        .id(11)
        .build()).unwrap();
    
    menu.append(&quick_menu).unwrap();
    menu.append(&PredefinedMenuItem::separator()).unwrap();
    
    // Sync
    let sync_item = MenuItemBuilder::new()
        .text("Sync Now")
        .id(20)
        .enabled(false)
        .build();
    
    menu.append(&sync_item).unwrap();
    menu.append(&PredefinedMenuItem::separator()).unwrap();
    
    // Settings and About
    let settings_item = MenuItemBuilder::new()
        .text("Settings...")
        .id(30)
        .build();
    
    menu.append(&settings_item).unwrap();
    
    menu.append(&PredefinedMenuItem::about(
        None,
        Some(AboutMetadata {
            name: Some("SecureFox".to_string()),
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            ..Default::default()
        }),
    )).unwrap();
    
    menu.append(&PredefinedMenuItem::separator()).unwrap();
    
    // Quit
    let quit_item = MenuItemBuilder::new()
        .text("Quit SecureFox")
        .id(99)
        .accelerator("Cmd+Q")
        .build();
    
    menu.append(&quit_item).unwrap();
    
    menu
}

fn handle_menu_event(event: MenuEvent, state: &mut AppState, tray_icon: &mut TrayIcon) {
    match event.id {
        1 => {
            // Unlock vault
            tracing::info!("Unlock requested");
            unlock_vault(state, tray_icon);
        }
        2 => {
            // Lock vault
            tracing::info!("Lock requested");
            lock_vault(state, tray_icon);
        }
        10 => {
            // Open extension
            open_extension();
        }
        11 => {
            // Generate password
            generate_password(state);
        }
        20 => {
            // Sync
            sync_vault(state);
        }
        30 => {
            // Settings
            open_settings();
        }
        99 => {
            // Quit
            std::process::exit(0);
        }
        _ => {}
    }
}

fn unlock_vault(state: &mut AppState, tray_icon: &mut TrayIcon) {
    // In a real implementation, would show password dialog
    let api_client = state.api_client.clone();
    
    tokio::spawn(async move {
        // For demo, using hardcoded password
        match api_client.unlock("password").await {
            Ok(response) => {
                tracing::info!("Vault unlocked, token: {}", response.token);
                // Store token for future requests
            }
            Err(e) => {
                tracing::error!("Failed to unlock: {}", e);
            }
        }
    });
    
    state.locked = false;
    update_menu_state(tray_icon, state.locked);
}

fn lock_vault(state: &mut AppState, tray_icon: &mut TrayIcon) {
    let api_client = state.api_client.clone();
    
    tokio::spawn(async move {
        if let Err(e) = api_client.lock().await {
            tracing::error!("Failed to lock: {}", e);
        }
    });
    
    state.locked = true;
    update_menu_state(tray_icon, state.locked);
}

fn update_menu_state(tray_icon: &mut TrayIcon, locked: bool) {
    // Update icon based on lock state
    let icon = if locked {
        icons::get_locked_icon()
    } else {
        icons::get_unlocked_icon()
    }.unwrap_or_else(|_| icons::get_tray_icon().unwrap());
    
    tray_icon.set_icon(Some(icon)).ok();
}

fn open_extension() {
    // Open browser with extension
    if let Err(e) = open::that("chrome://extensions/") {
        tracing::error!("Failed to open browser: {}", e);
    }
}

fn generate_password(state: &AppState) {
    let api_client = state.api_client.clone();
    
    tokio::spawn(async move {
        match api_client.generate_password(None).await {
            Ok(response) => {
                tracing::info!("Generated password: {}", response.password);
                // Copy to clipboard
                if let Ok(mut ctx) = clipboard::ClipboardProvider::new() {
                    let _ = ctx.set_contents(response.password);
                }
            }
            Err(e) => {
                tracing::error!("Failed to generate password: {}", e);
            }
        }
    });
}

fn sync_vault(state: &AppState) {
    let api_client = state.api_client.clone();
    
    tokio::spawn(async move {
        match api_client.sync_push().await {
            Ok(_) => tracing::info!("Sync completed"),
            Err(e) => tracing::error!("Sync failed: {}", e),
        }
    });
}

fn open_settings() {
    tracing::info!("Opening settings...");
    // In real implementation, would open settings window
}