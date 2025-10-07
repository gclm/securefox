use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, ApiError>;

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("Unauthorized")]
    Unauthorized,

    #[error("Not found")]
    NotFound,

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Vault locked")]
    VaultLocked,

    #[error("Invalid password")]
    InvalidPassword,

    #[error("Session expired")]
    SessionExpired,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized"),
            ApiError::NotFound => (StatusCode::NOT_FOUND, "Not found"),
            ApiError::BadRequest(_) => (StatusCode::BAD_REQUEST, "Bad request"),
            ApiError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal error"),
            ApiError::VaultLocked => (StatusCode::FORBIDDEN, "Vault is locked"),
            ApiError::InvalidPassword => (StatusCode::UNAUTHORIZED, "Invalid password"),
            ApiError::SessionExpired => (StatusCode::UNAUTHORIZED, "Session expired"),
        };

        let body = Json(json!({
            "error": error_message,
            "message": self.to_string(),
        }));

        (status, body).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        ApiError::Internal(err.to_string())
    }
}

impl From<securefox_core::Error> for ApiError {
    fn from(err: securefox_core::Error) -> Self {
        use securefox_core::Error;
        match err {
            Error::InvalidPassword => ApiError::InvalidPassword,
            Error::VaultNotFound => ApiError::NotFound,
            Error::ItemNotFound(_) => ApiError::NotFound,
            _ => ApiError::Internal(err.to_string()),
        }
    }
}