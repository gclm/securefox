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
    use axum::{
        extract::{Path, Query, State},
        http::{Request, StatusCode},
        Json,
    };
    use axum::extract::Extension;
    use chrono::Utc;
    use securefox_core::models::Item;
    use uuid::Uuid;
    use crate::models::{CreateItemRequest, ListItemsQuery, Session, UpdateItemRequest};
    use crate::{ApiError, AppState, Result};

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
        Extension(session): Extension<Session>,
        Json(req): Json<CreateItemRequest>,
    ) -> Result<Json<Item>> {
        let now = Utc::now();
        
        // Build complete Item with generated ID and timestamps
        let item = Item {
            id: Uuid::new_v4().to_string(),
            item_type: req.item_type,
            name: req.name,
            folder_id: req.folder_id,
            favorite: req.favorite.unwrap_or(false),
            notes: req.notes,
            login: req.login,
            card: req.card,
            identity: req.identity,
            secure_note: req.secure_note,
            fields: req.fields,
            reprompt: req.reprompt,
            creation_date: now,
            revision_date: now,
        };
        
        let item_clone = item.clone();
        
        // Save to vault with persistence
        state.update_vault(&session.id, |vault| {
            vault.add_item(item);
            Ok(())
        })?;
        
        Ok(Json(item_clone))
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
        Extension(session): Extension<Session>,
        Path(id): Path<String>,
        Json(req): Json<UpdateItemRequest>,
    ) -> Result<Json<Item>> {
        let updated_item = state.get_vault()
            .ok_or(ApiError::VaultLocked)?
            .items
            .iter()
            .find(|i| i.id == id)
            .ok_or(ApiError::NotFound)?
            .clone();
        
        // Build updated item with new revision date
        let item = Item {
            id: updated_item.id,
            item_type: req.item_type,
            name: req.name,
            folder_id: req.folder_id,
            favorite: req.favorite.unwrap_or(false),
            notes: req.notes,
            login: req.login,
            card: req.card,
            identity: req.identity,
            secure_note: req.secure_note,
            fields: req.fields,
            reprompt: req.reprompt,
            creation_date: updated_item.creation_date,
            revision_date: Utc::now(),
        };
        
        let item_clone = item.clone();
        
        // Update in vault with persistence
        state.update_vault(&session.id, |vault| {
            if let Some(existing) = vault.get_item_mut(&id) {
                *existing = item;
                Ok(())
            } else {
                Err(ApiError::NotFound)
            }
        })?;
        
        Ok(Json(item_clone))
    }

    pub async fn delete_item(
        State(state): State<AppState>,
        Extension(session): Extension<Session>,
        Path(id): Path<String>,
    ) -> Result<()> {
        state.update_vault(&session.id, |vault| {
            vault.remove_item(&id)
                .ok_or(ApiError::NotFound)?;
            Ok(())
        })?;
        
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
            length: req.length.unwrap_or(16),
            numbers: req.include_numbers.unwrap_or(true),
            lowercase_letters: req.include_lowercase.unwrap_or(true),
            uppercase_letters: req.include_uppercase.unwrap_or(true),
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
    use crate::models::VersionResponse;

    pub async fn health_check() -> Json<serde_json::Value> {
        Json(json!({
            "status": "ok",
            "service": "securefox-api"
        }))
    }

    pub async fn version() -> Json<VersionResponse> {
        let git_hash = env!("GIT_HASH");
        let git_dirty = env!("GIT_DIRTY");
        let dirty_marker = if git_dirty == "dirty" { "-dirty" } else { "" };
        
        Json(VersionResponse {
            version: env!("CARGO_PKG_VERSION").to_string(),
            build_time: Some(env!("BUILD_TIME").to_string()),
            git_commit: Some(format!("{}{}", git_hash, dirty_marker)),
        })
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
        
        tracing::info!("Found item for TOTP: name={}, id={}", item.name, item.id);
        tracing::info!("Item login data: {:?}", item.login);
        
        let totp_secret = item.login
            .and_then(|l| l.totp)
            .ok_or(ApiError::BadRequest("Item has no TOTP".to_string()))?;
        
        tracing::info!("TOTP secret from item: {}", totp_secret);
        
        // Parse and validate TOTP secret (handles formatting, whitespace, etc.)
        use securefox_core::totp::{parse_totp_secret, TotpConfig};
        let cleaned_secret = parse_totp_secret(&totp_secret)
            .map_err(|e| ApiError::BadRequest(format!("Invalid TOTP secret: {}", e)))?;
        
        let config = TotpConfig::new(cleaned_secret);
        
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