//! Configuration file management for sync settings
//!
//! Manages ~/.securefox/config file for storing sync-related configuration
//! that doesn't need encryption

use std::fs;
use std::path::{Path, PathBuf};

use crate::errors::{Error, Result};
use crate::models::SyncConfigFile;

/// Default config directory name
const CONFIG_DIR_NAME: &str = ".securefox";

/// Default config file name
const CONFIG_FILE_NAME: &str = "config";

/// Config file manager
pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    /// Create a new config manager with default path (~/.securefox/config)
    pub fn new() -> Result<Self> {
        let home = dirs::home_dir()
            .ok_or_else(|| Error::Other("Could not determine home directory".to_string()))?;
        let config_dir = home.join(CONFIG_DIR_NAME);
        Ok(Self {
            config_path: config_dir.join(CONFIG_FILE_NAME),
        })
    }

    /// Create a config manager with custom path
    pub fn with_path<P: AsRef<Path>>(path: P) -> Self {
        Self {
            config_path: path.as_ref().to_path_buf(),
        }
    }

    /// Get the config file path
    pub fn path(&self) -> &Path {
        &self.config_path
    }

    /// Check if config file exists
    pub fn exists(&self) -> bool {
        self.config_path.exists()
    }

    /// Ensure the config directory exists
    fn ensure_directory(&self) -> Result<()> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        Ok(())
    }

    /// Save config file
    pub fn save(&self, config: &SyncConfigFile) -> Result<()> {
        self.ensure_directory()?;
        let contents = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_path, contents)?;
        Ok(())
    }

    /// Load config file
    pub fn load(&self) -> Result<SyncConfigFile> {
        if !self.exists() {
            // Return default empty config if file doesn't exist
            return Ok(SyncConfigFile::default());
        }

        let contents = fs::read_to_string(&self.config_path)?;
        let config: SyncConfigFile = serde_json::from_str(&contents)?;
        Ok(config)
    }

    /// Update remote URL
    pub fn update_remote_url(&self, url: Option<String>) -> Result<()> {
        let mut config = self.load()?;
        config.remote_url = url;
        self.save(&config)
    }

    /// Update sync config
    pub fn update_sync_config(&self, sync_config: Option<crate::models::SyncConfig>) -> Result<()> {
        let mut config = self.load()?;
        config.sync_config = sync_config;
        self.save(&config)
    }
}

impl Default for ConfigManager {
    fn default() -> Self {
        Self::new().expect("Failed to create default ConfigManager")
    }
}
