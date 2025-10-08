use axum::{
    extract::{Request, State},
    http::header,
    middleware::Next,
    response::Response,
};

use crate::{ApiError, AppState};

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    // Skip auth for certain routes
    let path = request.uri().path();
    if path == "/api/unlock" || path == "/api/status" || path == "/health" || path == "/ws" {
        return Ok(next.run(request).await);
    }

    // Extract token from Authorization header
    let token = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|auth| auth.to_str().ok())
        .and_then(|auth| auth.strip_prefix("Bearer "))
        .ok_or(ApiError::Unauthorized)?;

    // Validate session
    let session = state.get_session(token).ok_or(ApiError::SessionExpired)?;

    // Store session in request extensions for handlers
    request.extensions_mut().insert(session);

    Ok(next.run(request).await)
}
