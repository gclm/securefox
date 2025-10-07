mod auth;
mod error;
mod handlers;
mod models;
mod state;

use axum::{
    http::{HeaderValue, Method},
    middleware,
    routing::{get, post, put, delete},
    Router,
};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

pub use error::{ApiError, Result};
pub use state::AppState;

pub fn create_app(vault_path: PathBuf, unlock_timeout: Duration) -> Router {
    let state = AppState::new(vault_path, unlock_timeout);

    // CORS configuration - allow all origins for development
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers(Any);

    // Public auth routes (no authentication required)
    let public_auth_routes = Router::new()
        .route("/unlock", post(handlers::auth::unlock))
        .route("/status", get(handlers::auth::status));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        .route("/lock", post(handlers::auth::lock))
        
        // Item CRUD routes
        .route("/items", get(handlers::items::list_items))
        .route("/items", post(handlers::items::create_item))
        .route("/items/:id", get(handlers::items::get_item))
        .route("/items/:id", put(handlers::items::update_item))
        .route("/items/:id", delete(handlers::items::delete_item))
        
        // TOTP routes
        .route("/items/:id/totp", get(handlers::totp::get_totp))
        
        // Generator routes
        .route("/generate/password", post(handlers::generate::generate_password))
        
        // Sync routes
        .route("/sync/push", post(handlers::sync::push))
        .route("/sync/pull", post(handlers::sync::pull))
        
        // Apply auth middleware to protected routes
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::auth_middleware,
        ));

    // Combine public and protected routes
    let api_routes = Router::new()
        .merge(public_auth_routes)
        .merge(protected_routes);

    // Health check route (no auth required)
    let health_routes = Router::new()
        .route("/health", get(handlers::health::health_check));

    // WebSocket route for real-time updates
    let ws_routes = Router::new()
        .route("/ws", get(handlers::websocket::websocket_handler));

    // Combine all routes
    Router::new()
        .nest("/api", api_routes)
        .merge(health_routes)
        .merge(ws_routes)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors),
        )
        .with_state(state)
}

pub async fn run(
    vault_path: PathBuf,
    host: String,
    port: u16,
    unlock_timeout: u64,
) -> Result<()> {
    let app = create_app(vault_path, Duration::from_secs(unlock_timeout));
    
    let addr: SocketAddr = format!("{}:{}", host, port)
        .parse()
        .map_err(|e| ApiError::Internal(format!("Invalid address: {}", e)))?;
    
    tracing::info!("SecureFox API listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to bind: {}", e)))?;
    
    axum::serve(listener, app)
        .await
        .map_err(|e| ApiError::Internal(format!("Server error: {}", e)))?;
    
    Ok(())
}
