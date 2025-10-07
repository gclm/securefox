use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusResponse {
    pub locked: bool,
    pub session_valid: bool,
    pub vault_exists: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnlockRequest {
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnlockResponse {
    pub token: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneratePasswordRequest {
    pub length: Option<usize>,
    pub include_numbers: Option<bool>,
    pub include_symbols: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneratePasswordResponse {
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResponse {
    pub success: bool,
    pub message: String,
}

pub struct ApiClient {
    client: Client,
    base_url: String,
    token: Option<String>,
}

impl ApiClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.to_string(),
            token: None,
        }
    }

    pub fn set_token(&mut self, token: String) {
        self.token = Some(token);
    }

    pub async fn status(&self) -> Result<StatusResponse> {
        let response = self.client
            .get(format!("{}/api/status", self.base_url))
            .send()
            .await?
            .json()
            .await?;
        
        Ok(response)
    }

    pub async fn unlock(&self, password: &str) -> Result<UnlockResponse> {
        let request = UnlockRequest {
            password: password.to_string(),
        };

        let response = self.client
            .post(format!("{}/api/unlock", self.base_url))
            .json(&request)
            .send()
            .await?
            .json()
            .await?;
        
        Ok(response)
    }

    pub async fn lock(&self) -> Result<()> {
        let mut request = self.client
            .post(format!("{}/api/lock", self.base_url));

        if let Some(ref token) = self.token {
            request = request.bearer_auth(token);
        }

        request.send().await?;
        Ok(())
    }

    pub async fn generate_password(
        &self,
        options: Option<GeneratePasswordRequest>,
    ) -> Result<GeneratePasswordResponse> {
        let request_body = options.unwrap_or(GeneratePasswordRequest {
            length: Some(20),
            include_numbers: Some(true),
            include_symbols: Some(true),
        });

        let mut request = self.client
            .post(format!("{}/api/generate/password", self.base_url))
            .json(&request_body);

        if let Some(ref token) = self.token {
            request = request.bearer_auth(token);
        }

        let response = request
            .send()
            .await?
            .json()
            .await?;
        
        Ok(response)
    }

    pub async fn sync_push(&self) -> Result<SyncResponse> {
        let mut request = self.client
            .post(format!("{}/api/sync/push", self.base_url));

        if let Some(ref token) = self.token {
            request = request.bearer_auth(token);
        }

        let response = request
            .send()
            .await?
            .json()
            .await?;
        
        Ok(response)
    }

    pub async fn sync_pull(&self) -> Result<SyncResponse> {
        let mut request = self.client
            .post(format!("{}/api/sync/pull", self.base_url));

        if let Some(ref token) = self.token {
            request = request.bearer_auth(token);
        }

        let response = request
            .send()
            .await?
            .json()
            .await?;
        
        Ok(response)
    }
}