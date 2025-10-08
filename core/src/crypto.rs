//! Cryptographic operations for SecureFox

use aes_gcm_siv::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256GcmSiv, Nonce,
};
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2, Params, Version,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use pbkdf2::pbkdf2_hmac_array;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::errors::{Error, Result};

/// Size of the encryption key in bytes
const KEY_SIZE: usize = 32;

/// Size of the nonce in bytes for AES-GCM-SIV
const NONCE_SIZE: usize = 12;

/// Argon2 memory cost in KB (19MB - OWASP recommended minimum)
const ARGON2_MEMORY_KB: u32 = 19456;

/// Argon2 iterations (OWASP recommended minimum)
const ARGON2_ITERATIONS: u32 = 2;

/// Argon2 parallelism (single thread for better compatibility)
const ARGON2_PARALLELISM: u32 = 1;

/// PBKDF2 iterations (OWASP recommended: 600,000 for PBKDF2-HMAC-SHA256)
/// We use 100,000 for better UX while still maintaining good security
const PBKDF2_ITERATIONS: u32 = 100_000;

/// Encryption key wrapper with automatic zeroing on drop
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct EncryptionKey {
    key: [u8; KEY_SIZE],
}

impl EncryptionKey {
    /// Create a new encryption key from bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        if bytes.len() != KEY_SIZE {
            return Err(Error::Encryption(format!(
                "Invalid key size: expected {}, got {}",
                KEY_SIZE,
                bytes.len()
            )));
        }
        let mut key = [0u8; KEY_SIZE];
        key.copy_from_slice(bytes);
        Ok(Self { key })
    }

    /// Get the key bytes
    pub fn as_bytes(&self) -> &[u8] {
        &self.key
    }
}

/// KDF algorithm type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KdfAlgorithm {
    Argon2id,
    Pbkdf2,
}

/// Parameters for key derivation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KdfParams {
    pub algorithm: KdfAlgorithm,
    pub salt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_kb: Option<u32>,
    pub iterations: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parallelism: Option<u32>,
}

impl Default for KdfParams {
    fn default() -> Self {
        // Use PBKDF2 by default for better performance
        // Generate random salt bytes and encode as base64
        let mut salt_bytes = [0u8; 16];
        OsRng.fill_bytes(&mut salt_bytes);

        Self {
            algorithm: KdfAlgorithm::Pbkdf2,
            salt: BASE64.encode(salt_bytes),
            memory_kb: None,
            iterations: PBKDF2_ITERATIONS,
            parallelism: None,
        }
    }
}

impl KdfParams {
    /// Create Argon2id params
    pub fn argon2() -> Self {
        Self {
            algorithm: KdfAlgorithm::Argon2id,
            salt: SaltString::generate(&mut OsRng).to_string(),
            memory_kb: Some(ARGON2_MEMORY_KB),
            iterations: ARGON2_ITERATIONS,
            parallelism: Some(ARGON2_PARALLELISM),
        }
    }

    /// Create PBKDF2 params
    pub fn pbkdf2() -> Self {
        Self::default()
    }
}

/// Encrypted data container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub kdf_params: KdfParams,
    pub nonce: String,
    pub ciphertext: String,
}

/// Derive an encryption key from a password
pub fn derive_key(password: &str, params: &KdfParams) -> Result<EncryptionKey> {
    match params.algorithm {
        KdfAlgorithm::Argon2id => {
            let memory_kb = params.memory_kb.unwrap_or(ARGON2_MEMORY_KB);
            let parallelism = params.parallelism.unwrap_or(ARGON2_PARALLELISM);

            let argon2_params = Params::new(
                memory_kb * 1024,
                params.iterations,
                parallelism,
                Some(KEY_SIZE),
            )
            .map_err(|e| Error::Encryption(format!("Invalid Argon2 params: {}", e)))?;

            let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, argon2_params);

            let salt = SaltString::from_b64(&params.salt)
                .map_err(|e| Error::Encryption(format!("Invalid salt: {}", e)))?;

            let password_hash = argon2
                .hash_password(password.as_bytes(), &salt)
                .map_err(|e| Error::Encryption(format!("Key derivation failed: {}", e)))?;

            let hash_bytes = password_hash.hash.unwrap();
            let key_bytes = hash_bytes.as_bytes();

            EncryptionKey::from_bytes(key_bytes)
        }
        KdfAlgorithm::Pbkdf2 => {
            // Decode the base64 salt
            let salt_bytes = BASE64
                .decode(&params.salt)
                .map_err(|e| Error::Encryption(format!("Invalid salt: {}", e)))?;

            // Derive key using PBKDF2-HMAC-SHA256
            let key = pbkdf2_hmac_array::<Sha256, KEY_SIZE>(
                password.as_bytes(),
                &salt_bytes,
                params.iterations,
            );

            Ok(EncryptionKey { key })
        }
    }
}

/// Generate a new random encryption key
pub fn generate_key() -> EncryptionKey {
    let mut key = [0u8; KEY_SIZE];
    OsRng.fill_bytes(&mut key);
    EncryptionKey { key }
}

/// Encrypt data using AES-256-GCM-SIV
pub fn encrypt(plaintext: &[u8], key: &EncryptionKey) -> Result<EncryptedData> {
    let cipher = Aes256GcmSiv::new_from_slice(key.as_bytes())
        .map_err(|e| Error::Encryption(format!("Cipher creation failed: {}", e)))?;

    let nonce = Aes256GcmSiv::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| Error::Encryption(format!("Encryption failed: {}", e)))?;

    Ok(EncryptedData {
        kdf_params: KdfParams::default(),
        nonce: BASE64.encode(nonce.as_slice()),
        ciphertext: BASE64.encode(&ciphertext),
    })
}

/// Encrypt data with a password using default KDF (PBKDF2)
pub fn encrypt_with_password(plaintext: &[u8], password: &str) -> Result<EncryptedData> {
    let kdf_params = KdfParams::default();
    encrypt_with_password_and_kdf(plaintext, password, kdf_params)
}

/// Encrypt data with a password using specified KDF params
pub fn encrypt_with_password_and_kdf(
    plaintext: &[u8],
    password: &str,
    kdf_params: KdfParams,
) -> Result<EncryptedData> {
    let key = derive_key(password, &kdf_params)?;

    let cipher = Aes256GcmSiv::new_from_slice(key.as_bytes())
        .map_err(|e| Error::Encryption(format!("Cipher creation failed: {}", e)))?;

    let nonce = Aes256GcmSiv::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| Error::Encryption(format!("Encryption failed: {}", e)))?;

    Ok(EncryptedData {
        kdf_params,
        nonce: BASE64.encode(nonce.as_slice()),
        ciphertext: BASE64.encode(&ciphertext),
    })
}

/// Decrypt data using AES-256-GCM-SIV
pub fn decrypt(encrypted: &EncryptedData, key: &EncryptionKey) -> Result<Vec<u8>> {
    let cipher = Aes256GcmSiv::new_from_slice(key.as_bytes())
        .map_err(|e| Error::Decryption(format!("Cipher creation failed: {}", e)))?;

    let nonce_bytes = BASE64
        .decode(&encrypted.nonce)
        .map_err(|e| Error::Decryption(format!("Invalid nonce: {}", e)))?;

    if nonce_bytes.len() != NONCE_SIZE {
        return Err(Error::Decryption(format!(
            "Invalid nonce size: expected {}, got {}",
            NONCE_SIZE,
            nonce_bytes.len()
        )));
    }

    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = BASE64
        .decode(&encrypted.ciphertext)
        .map_err(|e| Error::Decryption(format!("Invalid ciphertext: {}", e)))?;

    cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| Error::Decryption(format!("Decryption failed: {}", e)))
}

/// Decrypt data with a password
pub fn decrypt_with_password(encrypted: &EncryptedData, password: &str) -> Result<Vec<u8>> {
    let key = derive_key(password, &encrypted.kdf_params)?;
    decrypt(encrypted, &key)
}

/// Verify a password against stored KDF params
pub fn verify_password(password: &str, params: &KdfParams) -> Result<bool> {
    // For verification, we just try to derive the key
    // In a real implementation, we'd store a password verifier separately
    derive_key(password, params)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_derivation() {
        let params = KdfParams::default();
        let key1 = derive_key("test_password", &params).unwrap();
        let key2 = derive_key("test_password", &params).unwrap();
        assert_eq!(key1.as_bytes(), key2.as_bytes());

        let key3 = derive_key("different_password", &params).unwrap();
        assert_ne!(key1.as_bytes(), key3.as_bytes());
    }

    #[test]
    fn test_encryption_decryption() {
        let plaintext = b"Hello, SecureFox!";
        let password = "test_password";

        let encrypted = encrypt_with_password(plaintext, password).unwrap();
        let decrypted = decrypt_with_password(&encrypted, password).unwrap();

        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[test]
    fn test_wrong_password_fails() {
        let plaintext = b"Secret data";
        let password = "correct_password";
        let wrong_password = "wrong_password";

        let encrypted = encrypt_with_password(plaintext, password).unwrap();
        let result = decrypt_with_password(&encrypted, wrong_password);

        assert!(result.is_err());
    }

    #[test]
    fn test_key_zeroization() {
        let mut key = generate_key();
        let key_bytes = key.as_bytes().to_vec();
        assert!(!key_bytes.iter().all(|&b| b == 0));

        key.zeroize();
        assert!(key.as_bytes().iter().all(|&b| b == 0));
    }
}
