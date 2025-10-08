// handlers/auth.rs
pub mod auth_impl {
    use crate::{
        models::{StatusResponse, UnlockRequest, UnlockResponse, VaultSummary},
        ApiError, AppState, Result,
    };
    use axum::{extract::State, Json};

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
        let storage =
            securefox_core::storage::VaultStorage::with_path(state.vault_path.join("vault.sf"));

        Ok(Json(StatusResponse {
            locked: state.is_locked(),
            session_valid: !state.sessions.read().is_empty(),
            vault_exists: storage.exists(),
        }))
    }
}

// Simplified placeholder handlers for other modules
pub mod items_impl {
    use crate::models::{CreateItemRequest, ListItemsQuery, Session, UpdateItemRequest};
    use crate::{ApiError, AppState, Result};
    use axum::extract::Extension;
    use axum::{
        extract::{Path, Query, State},
        Json,
    };
    use chrono::Utc;
    use securefox_core::models::Item;
    use uuid::Uuid;

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
        // Validate required fields
        if req.name.trim().is_empty() {
            return Err(ApiError::BadRequest("Item name is required".to_string()));
        }

        // For login items, validate username and at least one URI
        if req.item_type == securefox_core::models::ItemType::LOGIN {
            if let Some(ref login) = req.login {
                if login.username.is_none()
                    || login
                        .username
                        .as_ref()
                        .map(|u| u.trim().is_empty())
                        .unwrap_or(true)
                {
                    return Err(ApiError::BadRequest(
                        "Username is required for login items".to_string(),
                    ));
                }
                if login.uris.is_none() || login.uris.as_ref().map(|u| u.is_empty()).unwrap_or(true)
                {
                    return Err(ApiError::BadRequest(
                        "At least one URI is required for login items".to_string(),
                    ));
                }
            } else {
                return Err(ApiError::BadRequest(
                    "Login data is required for login items".to_string(),
                ));
            }
        }

        // Check for duplicate credentials (URI + username + password)
        let vault = state.get_vault().ok_or(ApiError::VaultLocked)?;

        if req.item_type == securefox_core::models::ItemType::LOGIN {
            if let Some(ref req_login) = req.login {
                // Extract request username and password for comparison
                let req_username = req_login.username.as_deref();
                let req_password = req_login.password.as_deref();
                let req_uris = req_login.uris.as_ref();

                // Check each existing item for duplicates
                for existing_item in &vault.items {
                    if existing_item.item_type != securefox_core::models::ItemType::LOGIN {
                        continue;
                    }

                    if let Some(ref existing_login) = existing_item.login {
                        // Check if username matches
                        if existing_login.username.as_deref() != req_username {
                            continue;
                        }

                        // Check if any URI matches
                        let has_matching_uri = match (req_uris, &existing_login.uris) {
                            (Some(req_uris), Some(existing_uris)) => {
                                req_uris.iter().any(|req_uri| {
                                    existing_uris
                                        .iter()
                                        .any(|existing_uri| req_uri.uri == existing_uri.uri)
                                })
                            }
                            _ => false,
                        };

                        if !has_matching_uri {
                            continue;
                        }

                        // Found matching URI + username
                        // Check if password also matches
                        if existing_login.password.as_deref() == req_password {
                            // Complete duplicate - return existing item without saving
                            return Ok(Json(existing_item.clone()));
                        }
                        // If password is different, we'll create a new item (not update)
                        // This allows users to have multiple passwords for the same site
                    }
                }
            }
        }

        // No duplicate found - create new item
        let now = Utc::now();
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
        let item = vault
            .items
            .into_iter()
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
        let updated_item = state
            .get_vault()
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
            vault.remove_item(&id).ok_or(ApiError::NotFound)?;
            Ok(())
        })?;

        Ok(())
    }
}

// Other handler implementations
pub mod generate_impl {
    use crate::{
        models::{GeneratePasswordRequest, GeneratePasswordResponse, PasswordStrength},
        AppState, Result,
    };
    use axum::{extract::State, Json};
    use passwords::PasswordGenerator;

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
                }
                .to_string(),
            },
        }))
    }
}

pub mod health_impl {
    use crate::models::VersionResponse;
    use axum::Json;
    use serde_json::json;

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
    use crate::{models::SyncResponse, AppState, Result};
    use axum::{extract::State, Json};

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
    use crate::{models::TotpResponse, ApiError, AppState, Result};
    use axum::{
        extract::{Path, State},
        Json,
    };

    pub async fn get_totp(
        State(state): State<AppState>,
        Path(id): Path<String>,
    ) -> Result<Json<TotpResponse>> {
        let vault = state.get_vault().ok_or(ApiError::VaultLocked)?;
        let item = vault
            .items
            .into_iter()
            .find(|i| i.id == id)
            .ok_or(ApiError::NotFound)?;

        tracing::info!("Found item for TOTP: name={}, id={}", item.name, item.id);
        tracing::info!("Item login data: {:?}", item.login);

        let totp_secret = item
            .login
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
