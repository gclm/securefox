//! Git synchronization for vault

use git2::{
    Cred, CredentialType, FetchOptions, PushOptions, RemoteCallbacks, Repository, Signature, Status,
};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use crate::errors::{Error, Result};

/// Sync error with retry context
#[derive(Debug)]
pub enum SyncError {
    /// Network error (retriable)
    Network(String),
    /// Authentication error (not retriable without credential change)
    Auth(String),
    /// Merge conflict (requires manual intervention)
    Conflict(String),
    /// Configuration error (no remote, bad config, etc.)
    Config(String),
    /// Other error
    Other(String),
}

impl std::fmt::Display for SyncError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SyncError::Network(msg) => write!(f, "Network error: {}", msg),
            SyncError::Auth(msg) => write!(f, "Authentication error: {}", msg),
            SyncError::Conflict(msg) => write!(f, "Merge conflict: {}", msg),
            SyncError::Config(msg) => write!(f, "Configuration error: {}", msg),
            SyncError::Other(msg) => write!(f, "Error: {}", msg),
        }
    }
}

impl std::error::Error for SyncError {}

impl From<git2::Error> for SyncError {
    fn from(err: git2::Error) -> Self {
        let msg = err.to_string();
        // Classify git2 errors
        if msg.contains("auth")
            || msg.contains("authentication")
            || msg.contains("401")
            || msg.contains("403")
            || msg.contains("permission denied")
        {
            SyncError::Auth(msg)
        } else if msg.contains("conflict") || msg.contains("merge conflict") {
            SyncError::Conflict(msg)
        } else if msg.contains("network")
            || msg.contains("timeout")
            || msg.contains("connection")
            || msg.contains("resolve")
            || msg.contains("unable to receive")
        {
            SyncError::Network(msg)
        } else if msg.contains("not found") || msg.contains("no such") {
            SyncError::Config(msg)
        } else {
            SyncError::Other(msg)
        }
    }
}

/// Result of a sync operation
#[derive(Debug, Default)]
pub struct SyncResult {
    pub pulled: bool,
    pub pushed: bool,
    pub already_up_to_date: bool,
    pub error: Option<String>,
    pub last_sync_time: Option<String>,
}

/// Result of a clone operation
pub struct CloneResult {
    pub success: bool,
    pub vault_path: String,
    pub message: String,
}

/// Pull retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_retries: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: u64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay_ms: 1000,
            max_delay_ms: 10000,
            backoff_multiplier: 2,
        }
    }
}

/// Git sync manager
pub struct GitSync {
    repo_path: PathBuf,
    repo: Repository,
    remote_name: String,
    branch_name: String,
}

impl GitSync {
    /// Initialize or open a git repository
    pub fn init<P: AsRef<Path>>(path: P) -> Result<Self> {
        let repo_path = path.as_ref().to_path_buf();

        let repo = if repo_path.join(".git").exists() {
            Repository::open(&repo_path)?
        } else {
            let repo = Repository::init(&repo_path)?;
            // Create default .gitignore for new repos
            Self::create_default_gitignore(&repo_path)?;
            repo
        };

        let remote_name = env::var("SECUREFOX_REMOTE").unwrap_or_else(|_| "origin".to_string());
        let branch_name = env::var("SECUREFOX_BRANCH").unwrap_or_else(|_| "main".to_string());

        Ok(Self {
            repo_path,
            repo,
            remote_name,
            branch_name,
        })
    }

    /// Create default .gitignore file for vault directory
    fn create_default_gitignore(repo_path: &Path) -> Result<()> {
        let gitignore_path = repo_path.join(".gitignore");

        // Don't overwrite existing .gitignore
        if gitignore_path.exists() {
            return Ok(());
        }

        let gitignore_content = "# SecureFox service files\nservice.err\nservice.pid\nservice.log\n\n# Backups\nbackups/\n\n# System files\n.DS_Store\nThumbs.db\n";

        fs::write(&gitignore_path, gitignore_content)?;
        Ok(())
    }

    /// Set remote URL
    pub fn set_remote(&self, url: &str) -> Result<()> {
        if self.repo.find_remote(&self.remote_name).is_ok() {
            // Remote exists, update URL
            self.repo.remote_set_url(&self.remote_name, url)?;
        } else {
            // Create new remote
            self.repo.remote(&self.remote_name, url)?;
        }
        Ok(())
    }

    /// Get remote URL
    pub fn get_remote(&self) -> Result<Option<String>> {
        match self.repo.find_remote(&self.remote_name) {
            Ok(remote) => Ok(remote.url().map(|s| s.to_string())),
            Err(_) => Ok(None),
        }
    }

    /// Auto commit changes
    pub fn auto_commit(&self, message: &str) -> Result<()> {
        let mut index = self.repo.index()?;

        // Add all changes to index
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
        index.write()?;

        // Check if there are changes to commit
        let tree_id = index.write_tree()?;
        let tree = self.repo.find_tree(tree_id)?;

        let parent_commit = match self.repo.head() {
            Ok(head) => Some(head.peel_to_commit()?),
            Err(_) => None, // First commit
        };

        // Get signature
        let signature = self.get_signature()?;

        // Create commit
        if let Some(parent) = parent_commit {
            // Check if there are actual changes
            if parent.tree_id() == tree_id {
                // No changes
                return Ok(());
            }

            self.repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &[&parent],
            )?;
        } else {
            // Initial commit
            self.repo
                .commit(Some("HEAD"), &signature, &signature, message, &tree, &[])?;
        }

        Ok(())
    }

    /// Push changes to remote
    pub fn push(&self) -> Result<()> {
        // Ensure we have at least one commit
        if self.repo.head().is_err() {
            // No commits yet, create an initial commit
            self.auto_commit("Initial commit")?;
        }

        // Rename branch to configured name if needed
        if let Ok(head) = self.repo.head() {
            if let Some(branch_name) = head.shorthand() {
                if branch_name != self.branch_name {
                    // Rename current branch to configured name
                    let mut branch = self
                        .repo
                        .find_branch(branch_name, git2::BranchType::Local)?;
                    branch.rename(&self.branch_name, false)?;
                }
            }
        }

        let mut remote = self.repo.find_remote(&self.remote_name)?;

        let mut callbacks = RemoteCallbacks::new();
        callbacks
            .credentials(|_url, username, cred_type| self.get_credentials(username, cred_type));

        // Accept unknown SSH host keys (for development)
        callbacks.certificate_check(|_cert, _host| Ok(git2::CertificateCheckStatus::CertificateOk));

        let mut push_options = PushOptions::new();
        push_options.remote_callbacks(callbacks);

        let refspec = format!(
            "refs/heads/{}:refs/heads/{}",
            self.branch_name, self.branch_name
        );
        remote.push(&[&refspec], Some(&mut push_options))?;

        Ok(())
    }

    /// Pull changes from remote (backwards compatible — uses pull_inner internally)
    pub fn pull(&self) -> Result<()> {
        self.pull_inner()
            .map(|_| ())
            .map_err(|e| Error::Other(e.to_string()))
    }

    /// Auto commit and push
    pub fn auto_commit_push(&self, message: &str) -> Result<()> {
        self.auto_commit(message)?;

        if self.get_remote()?.is_some() {
            self.push()?;
        }

        Ok(())
    }

    /// Auto pull and merge
    pub fn auto_pull_merge(&self) -> Result<()> {
        if self.get_remote()?.is_some() {
            self.pull()?;
        }
        Ok(())
    }

    /// Perform a three-way merge (backwards compatible)
    #[allow(dead_code)]
    fn merge(&self, remote_commit: &git2::AnnotatedCommit) -> Result<()> {
        self.merge_inner(remote_commit)
            .map_err(|e| Error::Other(e.to_string()))
    }

    /// Resolve merge conflicts for JSON files
    fn resolve_conflicts(&self, index: &mut git2::Index) -> std::result::Result<(), SyncError> {
        // For vault JSON files, we can implement intelligent merging
        // For now, we'll just take the remote version
        // In a real implementation, we'd merge the JSON structures

        let conflicts: Vec<_> = index
            .conflicts()
            .map_err(SyncError::from)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(SyncError::from)?;

        for conflict in conflicts {
            if let Some(their) = conflict.their {
                index.add(&their).map_err(SyncError::from)?;
            }
        }

        index.write().map_err(SyncError::from)?;
        Ok(())
    }

    /// Get git signature
    fn get_signature(&self) -> Result<Signature<'static>> {
        let name = env::var("GIT_AUTHOR_NAME")
            .or_else(|_| env::var("USER"))
            .unwrap_or_else(|_| "SecureFox".to_string());

        let email = env::var("GIT_AUTHOR_EMAIL")
            .unwrap_or_else(|_| format!("{}@securefox.local", name.to_lowercase()));

        Ok(Signature::now(&name, &email)?)
    }

    /// Get credentials for authentication
    fn get_credentials(
        &self,
        username: Option<&str>,
        cred_type: CredentialType,
    ) -> std::result::Result<Cred, git2::Error> {
        // Try SSH key first
        if cred_type.contains(CredentialType::SSH_KEY) {
            let home = dirs::home_dir()
                .ok_or_else(|| git2::Error::from_str("Could not find home directory"))?;

            let ssh_dir = home.join(".ssh");
            let username = username.unwrap_or("git");

            // Try different key types in order of preference
            let key_types = [
                ("id_ed25519", "id_ed25519.pub"),
                ("id_rsa", "id_rsa.pub"),
                ("id_ecdsa", "id_ecdsa.pub"),
            ];

            for (private, public) in &key_types {
                let private_key = ssh_dir.join(private);
                let public_key = ssh_dir.join(public);

                if private_key.exists() {
                    return Cred::ssh_key(username, Some(&public_key), &private_key, None);
                }
            }

            // If no specific key found, try SSH agent
            return Cred::ssh_key_from_agent(username);
        }

        // Try username/password from environment
        if cred_type.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if let (Ok(user), Ok(pass)) = (env::var("GIT_USERNAME"), env::var("GIT_PASSWORD")) {
                return Cred::userpass_plaintext(&user, &pass);
            }
        }

        // Default credentials
        Cred::default()
    }

    /// Get current status
    pub fn status(&self) -> Result<Vec<(PathBuf, Status)>> {
        let statuses = self.repo.statuses(None)?;
        let mut result = Vec::new();

        for entry in statuses.iter() {
            if let Some(path) = entry.path() {
                result.push((self.repo_path.join(path), entry.status()));
            }
        }

        Ok(result)
    }

    /// Check if there are local changes (uncommitted or unpushed)
    pub fn has_local_changes(&self) -> Result<bool> {
        // Check for uncommitted changes
        let statuses = self.repo.statuses(None)?;
        if !statuses.is_empty() {
            return Ok(true);
        }

        // Check for unpushed commits
        if let Ok(head) = self.repo.head() {
            if let Ok(local_oid) = head
                .target()
                .ok_or_else(|| Error::Other("No HEAD target".to_string()))
            {
                if let Ok(_remote) = self.repo.find_remote(&self.remote_name) {
                    let remote_branch =
                        format!("refs/remotes/{}/{}", self.remote_name, self.branch_name);
                    if let Ok(remote_ref) = self.repo.find_reference(&remote_branch) {
                        if let Some(remote_oid) = remote_ref.target() {
                            if local_oid != remote_oid {
                                // Check if local is ahead
                                if let Ok((ahead, _behind)) =
                                    self.repo.graph_ahead_behind(local_oid, remote_oid)
                                {
                                    if ahead > 0 {
                                        return Ok(true);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(false)
    }

    /// Check if there are remote updates available
    pub fn has_remote_updates(&self) -> Result<bool> {
        // Fetch remote info without merging
        let mut remote = self.repo.find_remote(&self.remote_name)?;

        let mut callbacks = RemoteCallbacks::new();
        callbacks
            .credentials(|_url, username, cred_type| self.get_credentials(username, cred_type));
        callbacks.certificate_check(|_cert, _host| Ok(git2::CertificateCheckStatus::CertificateOk));

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        // Fetch remote references
        remote.fetch(&[&self.branch_name], Some(&mut fetch_options), None)?;

        // Compare local and remote HEAD
        if let Ok(head) = self.repo.head() {
            if let Some(local_oid) = head.target() {
                let remote_branch =
                    format!("refs/remotes/{}/{}", self.remote_name, self.branch_name);
                if let Ok(remote_ref) = self.repo.find_reference(&remote_branch) {
                    if let Some(remote_oid) = remote_ref.target() {
                        if local_oid != remote_oid {
                            // Check if remote is ahead
                            if let Ok((_ahead, behind)) =
                                self.repo.graph_ahead_behind(local_oid, remote_oid)
                            {
                                return Ok(behind > 0);
                            }
                        }
                    }
                }
            }
        }

        Ok(false)
    }

    /// Smart synchronization: pull if remote has updates, push if local has changes
    pub fn smart_sync(&self) -> Result<SyncResult> {
        let mut result = SyncResult::default();

        // First try to pull with retry to handle transient network issues
        match self.pull_with_retry(&RetryConfig::default()) {
            Ok(pulled) => {
                result.pulled = pulled;
                if !pulled {
                    result.already_up_to_date = true;
                }
            }
            Err(e) => {
                // Pull failed — record error but continue to try push if we have local changes
                result.error = Some(format!("Pull failed: {}", e));
            }
        }

        // Then try to push local changes
        if self.has_local_changes().unwrap_or(false) {
            if let Err(e) = self.auto_commit_push("Auto sync") {
                let error_msg = format!("Push failed: {}", e);
                result.error = Some(match result.error {
                    Some(prev) => format!("{}; {}", prev, error_msg),
                    None => error_msg,
                });
            } else {
                result.pushed = true;
            }
        }

        Ok(result)
    }

    /// Pull changes from remote with exponential backoff retry
    ///
    /// Returns `Ok(true)` if remote was pulled (there were updates),
    /// `Ok(false)` if already up to date.
    pub fn pull_with_retry(
        &self,
        retry_config: &RetryConfig,
    ) -> std::result::Result<bool, SyncError> {
        let mut last_error: Option<SyncError> = None;

        for attempt in 0..=retry_config.max_retries {
            if attempt > 0 {
                let delay_ms = std::cmp::min(
                    retry_config.initial_delay_ms
                        * retry_config.backoff_multiplier.pow(attempt - 1),
                    retry_config.max_delay_ms,
                );
                tracing::warn!(
                    "Pull attempt {} failed, retrying in {}ms...",
                    attempt,
                    delay_ms
                );
                thread::sleep(Duration::from_millis(delay_ms));
            }

            match self.pull_inner() {
                Ok(was_updated) => return Ok(was_updated),
                Err(e) => {
                    last_error = Some(e);
                    // Auth errors are not retriable
                    if matches!(last_error, Some(SyncError::Auth(_))) {
                        return Err(last_error.unwrap());
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| SyncError::Other("Unknown error during pull".into())))
    }

    /// Internal pull implementation — returns true if there were remote updates
    fn pull_inner(&self) -> std::result::Result<bool, SyncError> {
        let mut remote = self
            .repo
            .find_remote(&self.remote_name)
            .map_err(SyncError::from)?;

        let mut callbacks = RemoteCallbacks::new();
        callbacks
            .credentials(|_url, username, cred_type| self.get_credentials(username, cred_type));
        callbacks.certificate_check(|_cert, _host| Ok(git2::CertificateCheckStatus::CertificateOk));

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        // Fetch
        remote
            .fetch(&[&self.branch_name], Some(&mut fetch_options), None)
            .map_err(SyncError::from)?;

        // Get remote branch
        let fetch_head = self
            .repo
            .find_reference("FETCH_HEAD")
            .map_err(SyncError::from)?;
        let fetch_commit = self
            .repo
            .reference_to_annotated_commit(&fetch_head)
            .map_err(SyncError::from)?;

        // Perform merge
        let analysis = self
            .repo
            .merge_analysis(&[&fetch_commit])
            .map_err(SyncError::from)?;

        if analysis.0.is_up_to_date() {
            return Ok(false);
        }

        if analysis.0.is_fast_forward() {
            // Fast-forward
            let mut reference = self.repo.find_reference("HEAD").map_err(SyncError::from)?;
            reference
                .set_target(fetch_commit.id(), "Fast-forward")
                .map_err(SyncError::from)?;
            self.repo
                .set_head(&format!("refs/heads/{}", self.branch_name))
                .map_err(SyncError::from)?;
            self.repo
                .checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
                .map_err(SyncError::from)?;
        } else {
            // Need to do a real merge
            self.merge_inner(&fetch_commit)?;
        }

        Ok(true)
    }

    /// Internal merge implementation
    fn merge_inner(
        &self,
        remote_commit: &git2::AnnotatedCommit,
    ) -> std::result::Result<(), SyncError> {
        let local_commit = self
            .repo
            .head()
            .map_err(SyncError::from)?
            .peel_to_commit()
            .map_err(SyncError::from)?;
        let remote_tree = self
            .repo
            .find_commit(remote_commit.id())
            .map_err(SyncError::from)?
            .tree()
            .map_err(SyncError::from)?;
        let local_tree = local_commit.tree().map_err(SyncError::from)?;

        // Find merge base
        let base = self
            .repo
            .merge_base(local_commit.id(), remote_commit.id())
            .map_err(SyncError::from)?;
        let base_tree = self
            .repo
            .find_commit(base)
            .map_err(SyncError::from)?
            .tree()
            .map_err(SyncError::from)?;

        // Perform merge
        let mut index = self
            .repo
            .merge_trees(&base_tree, &local_tree, &remote_tree, None)
            .map_err(SyncError::from)?;

        if index.has_conflicts() {
            self.resolve_conflicts(&mut index)?;
        }

        // Write merged tree
        let tree_id = index.write_tree_to(&self.repo).map_err(SyncError::from)?;
        let tree = self.repo.find_tree(tree_id).map_err(SyncError::from)?;

        // Create merge commit
        let signature = self
            .get_signature()
            .map_err(|e| SyncError::Other(e.to_string()))?;
        let local_commit = self
            .repo
            .head()
            .map_err(SyncError::from)?
            .peel_to_commit()
            .map_err(SyncError::from)?;
        let remote_commit = self
            .repo
            .find_commit(remote_commit.id())
            .map_err(SyncError::from)?;

        self.repo
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                "Merge remote changes",
                &tree,
                &[&local_commit, &remote_commit],
            )
            .map_err(SyncError::from)?;

        Ok(())
    }

    /// Clone a remote vault repository to a new local path.
    ///
    /// This is the primary flow for setting up a vault on a new computer:
    /// 1. Clone the git repo (containing vault.sf)
    /// 2. The vault.sf file is now available for decryption with the master password
    pub fn clone<P: AsRef<Path>>(
        remote_url: &str,
        local_path: P,
    ) -> std::result::Result<CloneResult, SyncError> {
        let local_path = local_path.as_ref();

        // Create parent directory if needed
        if let Some(parent) = local_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| SyncError::Config(format!("Failed to create directory: {}", e)))?;
        }

        tracing::info!(
            "Cloning vault from {} to {}",
            remote_url,
            local_path.display()
        );

        let mut callbacks = RemoteCallbacks::new();
        callbacks
            .credentials(|_url, username, cred_type| Self::static_credentials(username, cred_type));
        callbacks.certificate_check(|_cert, _host| Ok(git2::CertificateCheckStatus::CertificateOk));

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        let mut builder = git2::build::RepoBuilder::new();
        builder.fetch_options(fetch_options);

        let _repo = builder
            .clone(remote_url, local_path)
            .map_err(|e| {
                let err = SyncError::from(e);
                match &err {
                    SyncError::Auth(_) => SyncError::Auth(
                        format!("Failed to authenticate. Ensure SSH keys are in ~/.ssh/ or set GIT_USERNAME/GIT_PASSWORD. Details: {}", err)
                    ),
                    SyncError::Network(_) => SyncError::Network(
                        format!("Failed to connect to remote. Check network and remote URL. Details: {}", err)
                    ),
                    _ => err,
                }
            })?;

        // Verify vault.sf exists
        let vault_file = local_path.join("vault.sf");
        if !vault_file.exists() {
            return Err(SyncError::Config(
                "Remote repository does not contain vault.sf. This may not be a valid SecureFox vault.".into()
            ));
        }

        // Write config file with the remote URL
        let config_manager = crate::config::ConfigManager::with_vault_dir(local_path);
        let _ = config_manager.update_remote_url(Some(remote_url.to_string()));

        Ok(CloneResult {
            success: true,
            vault_path: vault_file.to_string_lossy().to_string(),
            message: "Vault cloned successfully. Use your master password to unlock.".into(),
        })
    }

    /// Static credential helper (doesn't require self reference)
    fn static_credentials(
        username: Option<&str>,
        cred_type: CredentialType,
    ) -> std::result::Result<Cred, git2::Error> {
        // Try SSH key first
        if cred_type.contains(CredentialType::SSH_KEY) {
            let home = dirs::home_dir()
                .ok_or_else(|| git2::Error::from_str("Could not find home directory"))?;

            let ssh_dir = home.join(".ssh");
            let username = username.unwrap_or("git");

            let key_types = [
                ("id_ed25519", "id_ed25519.pub"),
                ("id_rsa", "id_rsa.pub"),
                ("id_ecdsa", "id_ecdsa.pub"),
            ];

            for (private, public) in &key_types {
                let private_key = ssh_dir.join(private);
                let public_key = ssh_dir.join(public);

                if private_key.exists() {
                    return Cred::ssh_key(username, Some(&public_key), &private_key, None);
                }
            }

            return Cred::ssh_key_from_agent(username);
        }

        // Try username/password from environment
        if cred_type.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if let (Ok(user), Ok(pass)) = (env::var("GIT_USERNAME"), env::var("GIT_PASSWORD")) {
                return Cred::userpass_plaintext(&user, &pass);
            }
        }

        Cred::default()
    }
}

/// Result of a sync operation
#[derive(Debug, Default)]
pub struct SmartSyncResult {
    pub pulled: bool,
    pub pushed: bool,
    pub already_up_to_date: bool,
}
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_git_init() {
        let temp_dir = tempdir().unwrap();
        let sync = GitSync::init(temp_dir.path()).unwrap();

        assert!(temp_dir.path().join(".git").exists());
        assert!(sync.get_remote().unwrap().is_none());
    }

    #[test]
    fn test_auto_commit() {
        let temp_dir = tempdir().unwrap();
        let sync = GitSync::init(temp_dir.path()).unwrap();

        // Create a file
        std::fs::write(temp_dir.path().join("test.txt"), "test content").unwrap();

        // Commit
        sync.auto_commit("Test commit").unwrap();

        // Check that commit was created
        let head = sync.repo.head().unwrap();
        let commit = head.peel_to_commit().unwrap();
        assert_eq!(commit.message().unwrap(), "Test commit");
    }
}
