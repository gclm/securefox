use anyhow::Result;
use club_gclmit_securefox_core::models::{SyncConfig, SyncMode};
use club_gclmit_securefox_core::VaultStorage;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};

#[cfg(feature = "git")]
use club_gclmit_securefox_core::git_sync::GitSync;

/// Sync daemon for automatic vault synchronization
pub struct SyncDaemon {
    vault_path: PathBuf,
    config: Arc<RwLock<Option<SyncConfig>>>,
}

impl SyncDaemon {
    /// Create a new sync daemon
    pub fn new(vault_path: PathBuf) -> Self {
        Self {
            vault_path,
            config: Arc::new(RwLock::new(None)),
        }
    }
    
    /// Load sync configuration from vault
    pub async fn load_config(&self, password: &str) -> Result<()> {
        let storage = VaultStorage::with_path(self.vault_path.join("vault.sf"));
        
        if storage.exists() {
            let vault = storage.load(password)?;
            let mut config = self.config.write().await;
            *config = vault.sync_config.clone();
        }
        
        Ok(())
    }
    
    /// Start the sync daemon
    pub async fn start(&self) {
        let config_clone = self.config.clone();
        let vault_path = self.vault_path.clone();
        
        tokio::spawn(async move {
            loop {
                // Get current configuration
                let (enabled, mode_opt) = {
                    let config = config_clone.read().await;
                    if let Some(sync_config) = config.as_ref() {
                        (
                            sync_config.enabled && sync_config.mode.is_auto_pull(),
                            Some(sync_config.mode.clone()),
                        )
                    } else {
                        (false, None)
                    }
                };
                
                if enabled {
                    if let Some(mode) = mode_opt {
                        if let Some(interval_secs) = mode.interval_seconds() {
                            // Wait for interval
                            let mut ticker = interval(Duration::from_secs(interval_secs));
                            ticker.tick().await; // First tick completes immediately
                            ticker.tick().await; // Wait for actual interval
                            
                            // Perform sync
                            let _ = Self::perform_sync(&vault_path, &mode).await;
                            
                            continue;
                        }
                    }
                }
                
                // If not configured or disabled, check again in 30 seconds
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
    }
    
    /// Perform synchronization based on mode
    #[cfg(feature = "git")]
    async fn perform_sync(vault_path: &PathBuf, mode: &SyncMode) -> Result<()> {
        let git_sync = GitSync::init(vault_path)?;
        
        match mode {
            SyncMode::AutoPull { .. } => {
                // Only pull
                if git_sync.has_remote_updates()? {
                    git_sync.pull()?;
                    tracing::info!("Auto-sync: Pulled remote changes");
                }
            }
            SyncMode::Full { .. } => {
                // Pull and push
                let result = git_sync.smart_sync()?;
                if result.pulled {
                    tracing::info!("Auto-sync: Pulled remote changes");
                }
                if result.pushed {
                    tracing::info!("Auto-sync: Pushed local changes");
                }
            }
            _ => {}
        }
        
        Ok(())
    }
    
    #[cfg(not(feature = "git"))]
    async fn perform_sync(_vault_path: &PathBuf, _mode: &SyncMode) -> Result<()> {
        Ok(())
    }
    
    /// Update sync configuration
    pub async fn update_config(&self, config: Option<SyncConfig>) {
        let mut guard = self.config.write().await;
        *guard = config;
    }
}
