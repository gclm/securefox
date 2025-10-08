//! Git synchronization for vault

use git2::{
    Cred, CredentialType, FetchOptions, PushOptions, RemoteCallbacks, Repository,
    Signature, Status,
};
use std::env;
use std::path::{Path, PathBuf};

use crate::errors::{Error, Result};

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
            Repository::init(&repo_path)?
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

    /// Pull changes from remote
    pub fn pull(&self) -> Result<()> {
        let mut remote = self.repo.find_remote(&self.remote_name)?;

        let mut callbacks = RemoteCallbacks::new();
        callbacks
            .credentials(|_url, username, cred_type| self.get_credentials(username, cred_type));

        // Accept unknown SSH host keys (for development)
        callbacks.certificate_check(|_cert, _host| Ok(git2::CertificateCheckStatus::CertificateOk));

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        // Fetch
        remote.fetch(&[&self.branch_name], Some(&mut fetch_options), None)?;

        // Get remote branch
        let fetch_head = self.repo.find_reference("FETCH_HEAD")?;
        let fetch_commit = self.repo.reference_to_annotated_commit(&fetch_head)?;

        // Perform merge
        let analysis = self.repo.merge_analysis(&[&fetch_commit])?;

        if analysis.0.is_up_to_date() {
            // Already up to date
            return Ok(());
        }

        if analysis.0.is_fast_forward() {
            // Fast-forward
            let mut reference = self.repo.find_reference("HEAD")?;
            reference.set_target(fetch_commit.id(), "Fast-forward")?;
            self.repo
                .set_head(&format!("refs/heads/{}", self.branch_name))?;
            self.repo
                .checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        } else {
            // Need to do a real merge
            self.merge(&fetch_commit)?;
        }

        Ok(())
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

    /// Perform a three-way merge
    fn merge(&self, remote_commit: &git2::AnnotatedCommit) -> Result<()> {
        let local_commit = self.repo.head()?.peel_to_commit()?;
        let remote_tree = self.repo.find_commit(remote_commit.id())?.tree()?;
        let local_tree = local_commit.tree()?;

        // Find merge base
        let base = self
            .repo
            .merge_base(local_commit.id(), remote_commit.id())?;
        let base_tree = self.repo.find_commit(base)?.tree()?;

        // Perform merge
        let mut index = self
            .repo
            .merge_trees(&base_tree, &local_tree, &remote_tree, None)?;

        if index.has_conflicts() {
            // Handle conflicts - for JSON vault files, we can implement custom resolution
            self.resolve_conflicts(&mut index)?;
        }

        // Write merged tree
        let tree_id = index.write_tree_to(&self.repo)?;
        let tree = self.repo.find_tree(tree_id)?;

        // Create merge commit
        let signature = self.get_signature()?;
        let local_commit = self.repo.head()?.peel_to_commit()?;
        let remote_commit = self.repo.find_commit(remote_commit.id())?;

        self.repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "Merge remote changes",
            &tree,
            &[&local_commit, &remote_commit],
        )?;

        Ok(())
    }

    /// Resolve merge conflicts for JSON files
    fn resolve_conflicts(&self, index: &mut git2::Index) -> Result<()> {
        // For vault JSON files, we can implement intelligent merging
        // For now, we'll just take the remote version
        // In a real implementation, we'd merge the JSON structures

        let conflicts: Vec<_> = index
            .conflicts()?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        for conflict in conflicts {
            if let Some(their) = conflict.their {
                index.add(&their)?;
            }
        }

        index.write()?;
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
    pub fn smart_sync(&self) -> Result<SmartSyncResult> {
        let mut result = SmartSyncResult::default();

        // Check and pull remote updates
        if self.has_remote_updates()? {
            self.pull()?;
            result.pulled = true;
        } else {
            result.already_up_to_date = true;
        }

        // Check and push local changes
        if self.has_local_changes()? {
            self.auto_commit("Auto sync")?;
            self.push()?;
            result.pushed = true;
        }

        Ok(result)
    }
}

/// Result of a smart sync operation
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
