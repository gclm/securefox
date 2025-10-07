pub mod auth;
pub mod generate;
pub mod health;
pub mod items;
pub mod sync;
pub mod totp;
pub mod websocket;

// handlers/auth.rs
pub mod auth_impl {
    use axum::{extract::State, Json};
    use crate::{
        models::{StatusResponse, UnlockRequest, UnlockResponse, VaultSummary},
        ApiError, AppState, Result,
    };

    pub async fn unlock(
        State(state): State<AppState>,
        Json(req): Json<UnlockRequest>,
    ) -> Result<Json<UnlockResponse>> {
        let session = state.unlock(req.password)?;
        
        let vault = state.get_vault().ok_or(ApiError::VaultLocked)?;
        
        Ok(Json(UnlockResponse {
            token: session.id,
            expires_at: session.expires_at,
            vault_summary: VaultSummary {
                item_count: vault.items.len(),
                folder_count: vault.folders.len(),
                last_sync: Some(vault.sync_time),
            },
        }))
    }

    pub async fn lock(State(state): State<AppState>) -> Result<Json<StatusResponse>> {
        state.lock(None);
        Ok(Json(StatusResponse {
            locked: true,
            session_valid: false,
            vault_exists: true,
        }))
    }

    pub async fn status(State(state): State<AppState>) -> Result<Json<StatusResponse>> {
        let storage = securefox_core::storage::VaultStorage::with_path(
            state.vault_path.join("vault.sf")
        );
        
        Ok(Json(StatusResponse {
            locked: state.is_locked(),
            session_valid: !state.sessions.read().is_empty(),
            vault_exists: storage.exists(),
        }))
    }
}

// Simplified placeholder handlers for other modules
pub mod items_impl {
    use axum::{extract::{Path, Query, State}, Json};
    use securefox_core::models::Item;
    use crate::{models::ListItemsQuery, ApiError, AppState, Result};

    pub async fn list_items(
        State(state): State<AppState>,
        Query(query): Query<ListItemsQuery>,
    ) -> Result<Json<Vec<Item>>> {
        let vault = state.get_vault().ok_or(ApiError::VaultLocked)?;
        
        let mut items = vault.items;
        
        // Apply filters
        if let Some(search) = query.search {
            let search_lower = search.to_lowercase();
            items.retain(|i| i.name.to_lowercase().contains(&search_lower));
        }
        
        Ok(Json(items))
    }

    pub async fn create_item(
        State(state): State<AppState>,
        Json(item): Json<Item>,
    ) -> Result<Json<Item>> {
        // Simplified - would need session from request extensions
        Ok(Json(item))
    }

    pub async fn get_item(
        State(state): State<AppState>,
        Path(id): Path<String>,
    ) -> Result<Json<Item>> {
        let vault = state.get_vault().ok_or(ApiError::VaultLocked)?;
        let item = vault.items.into_iter()
            .find(|i| i.id == id)
            .ok_or(ApiError::NotFound)?;
        Ok(Json(item))
    }

    pub async fn update_item(
        State(state): State<AppState>,
        Path(id): Path<String>,
        Json(item): Json<Item>,
    ) -> Result<Json<Item>> {
        Ok(Json(item))
    }

    pub async fn delete_item(
        State(state): State<AppState>,
        Path(id): Path<String>,
    ) -> Result<()> {
        Ok(())
    }
}

// Other handler implementations
pub mod generate_impl {
    use axum::{extract::State, Json};
    use passwords::PasswordGenerator;
    use crate::{
        models::{GeneratePasswordRequest, GeneratePasswordResponse, PasswordStrength},
        AppState, Result,
    };

    pub async fn generate_password(
        State(_state): State<AppState>,
        Json(req): Json<GeneratePasswordRequest>,
    ) -> Result<Json<GeneratePasswordResponse>> {
        let pg = PasswordGenerator {
            length: req.length.unwrap_or(20),
            numbers: req.include_numbers.unwrap_or(true),
            lowercase_letters: true,
            uppercase_letters: true,
            symbols: req.include_symbols.unwrap_or(true),
            spaces: false,
            exclude_similar_characters: req.exclude_similar.unwrap_or(true),
            strict: true,
        };
        
        let password = pg.generate_one().unwrap();
        let score = if password.len() >= 16 { 5 } else { 3 };
        
        Ok(Json(GeneratePasswordResponse {
            password,
            strength: PasswordStrength {
                score,
                label: match score {
                    5 => "Very Strong",
                    4 => "Strong",
                    3 => "Good",
                    2 => "Fair",
                    1 => "Weak",
                    _ => "Very Weak",
                }.to_string(),
            },
        }))
    }
}

pub mod health_impl {
    use axum::Json;
    use serde_json::json;

    pub async fn health_check() -> Json<serde_json::Value> {
        Json(json!({
            "status": "ok",
            "service": "securefox-api"
        }))
    }
}

// Re-export implementations
pub use auth_impl as auth;
pub use generate_impl as generate;
pub use health_impl as health;
pub use items_impl as items;

// Placeholder exports for missing modules
pub mod sync {
    use axum::{extract::State, Json};
    use crate::{models::SyncResponse, AppState, Result};

    pub async fn push(State(_state): State<AppState>) -> Result<Json<SyncResponse>> {
        Ok(Json(SyncResponse {
            success: true,
            message: "Sync completed".to_string(),
            items_synced: 0,
        }))
    }

    pub async fn pull(State(_state): State<AppState>) -> Result<Json<SyncResponse>> {
        Ok(Json(SyncResponse {
            success: true,
            message: "Pull completed".to_string(),
            items_synced: 0,
        }))
    }
}

pub mod totp {
    use axum::{extract::{Path, State}, Json};
    use crate::{models::TotpResponse, ApiError, AppState, Result};

    pub async fn get_totp(
        State(state): State<AppState>,
        Path(id): Path<String>,
    ) -> Result<Json<TotpResponse>> {
        let vault = state.get_vault().ok_or(ApiError::VaultLocked)?;
        let item = vault.items.into_iter()
            .find(|i| i.id == id)
            .ok_or(ApiError::NotFound)?;
        
        let totp_secret = item.login
            .and_then(|l| l.totp)
            .ok_or(ApiError::BadRequest("Item has no TOTP".to_string()))?;
        
        use securefox_core::totp::TotpConfig;
        let config = TotpConfig::new(totp_secret);
        
        Ok(Json(TotpResponse {
            code: config.generate()?,
            ttl: config.ttl(),
        }))
    }
}

pub mod websocket {
    use axum::extract::ws::{WebSocket, WebSocketUpgrade};
    use axum::response::Response;

    pub async fn websocket_handler(ws: WebSocketUpgrade) -> Response {
        ws.on_upgrade(handle_socket)
    }

    async fn handle_socket(mut socket: WebSocket) {
        // Placeholder WebSocket handler
        while let Some(msg) = socket.recv().await {
            if msg.is_err() {
                break;
            }
        }
    }
}