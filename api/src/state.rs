use parking_lot::RwLock;
use securefox_core::{models::Vault, storage::VaultStorage};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::Arc,
    time::Duration,
};

use crate::models::Session;

#[derive(Clone)]
pub struct AppState {
    pub vault_path: PathBuf,
    pub vault: Arc<RwLock<Option<Vault>>>,
    pub sessions: Arc<RwLock<HashMap<String, Session>>>,
    pub unlock_timeout: Duration,
}

impl AppState {
    pub fn new(vault_path: PathBuf, unlock_timeout: Duration) -> Self {
        Self {
            vault_path,
            vault: Arc::new(RwLock::new(None)),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            unlock_timeout,
        }
    }

    pub fn unlock(&self, password: String) -> crate::Result<Session> {
        let storage = VaultStorage::with_path(self.vault_path.join("vault.sf"));
        
        // Load and decrypt vault
        let vault = storage.load(&password)?;
        
        // Store vault in memory
        *self.vault.write() = Some(vault);
        
        // Create session
        let session = Session::new(password, self.unlock_timeout);
        let token = session.id.clone();
        
        // Store session
        self.sessions.write().insert(token.clone(), session.clone());
        
        Ok(session)
    }

    pub fn lock(&self, token: Option<&str>) {
        if let Some(token) = token {
            self.sessions.write().remove(token);
        }
        
        // Clear vault from memory
        *self.vault.write() = None;
    }

    pub fn get_session(&self, token: &str) -> Option<Session> {
        let mut sessions = self.sessions.write();
        
        if let Some(session) = sessions.get_mut(token) {
            if session.is_expired() {
                sessions.remove(token);
                return None;
            }
            
            // Refresh session on access
            session.refresh(self.unlock_timeout);
            Some(session.clone())
        } else {
            None
        }
    }

    pub fn is_locked(&self) -> bool {
        self.vault.read().is_none()
    }

    pub fn get_vault(&self) -> Option<Vault> {
        self.vault.read().clone()
    }

    pub fn update_vault<F>(&self, token: &str, f: F) -> crate::Result<()>
    where
        F: FnOnce(&mut Vault) -> crate::Result<()>,
    {
        let session = self.get_session(token)
            .ok_or(crate::ApiError::SessionExpired)?;
        
        let mut vault_guard = self.vault.write();
        let vault = vault_guard
            .as_mut()
            .ok_or(crate::ApiError::VaultLocked)?;
        
        // Apply the update
        f(vault)?;
        
        // Save to disk
        let storage = VaultStorage::with_path(self.vault_path.join("vault.sf"));
        storage.save(vault, &session.master_password)?;
        
        // Git sync if configured
        #[cfg(feature = "git")]
        {
            use securefox_core::git_sync::GitSync;
            if let Ok(sync) = GitSync::init(&self.vault_path) {
                let _ = sync.auto_commit_push("API vault update");
            }
        }
        
        Ok(())
    }

    pub fn cleanup_expired_sessions(&self) {
        let mut sessions = self.sessions.write();
        sessions.retain(|_, session| !session.is_expired());
    }
}