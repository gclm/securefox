//! TOTP (Time-based One-Time Password) implementation

use base32::Alphabet;
use totp_rs::{Algorithm, Secret, TOTP};

use crate::errors::{Error, Result};

/// TOTP configuration
pub struct TotpConfig {
    pub secret: String,
    pub issuer: Option<String>,
    pub account_name: Option<String>,
    pub algorithm: Algorithm,
    pub digits: usize,
    pub period: u64,
}

impl TotpConfig {
    /// Create from otpauth:// URI
    pub fn from_uri(uri: &str) -> Result<Self> {
        let totp = TOTP::from_url(uri)
            .map_err(|e| Error::InvalidTotp)?;
        
        Ok(Self {
            secret: totp.get_secret_base32(),
            issuer: totp.issuer,
            account_name: Some(totp.account_name),
            algorithm: totp.algorithm,
            digits: totp.digits,
            period: totp.step,
        })
    }

    /// Create with default settings
    pub fn new(secret: String) -> Self {
        Self {
            secret,
            issuer: None,
            account_name: None,
            algorithm: Algorithm::SHA1,
            digits: 6,
            period: 30,
        }
    }

    /// Generate current TOTP code
    pub fn generate(&self) -> Result<String> {
        let totp = self.to_totp()?;
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| Error::Other(format!("System time error: {}", e)))?
            .as_secs();
        
        Ok(totp.generate(timestamp))
    }

    /// Generate TOTP code with custom timestamp
    pub fn generate_at(&self, timestamp: u64) -> Result<String> {
        let totp = self.to_totp()?;
        Ok(totp.generate(timestamp))
    }

    /// Get remaining seconds until code expires
    pub fn ttl(&self) -> u64 {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        self.period - (timestamp % self.period)
    }

    /// Convert to totp-rs TOTP instance
    fn to_totp(&self) -> Result<TOTP> {
        let secret = Secret::Encoded(self.secret.clone())
            .to_bytes()
            .map_err(|e| {
                eprintln!("[TOTP] Secret::to_bytes() failed for '{}': {:?}", self.secret, e);
                Error::InvalidTotp
            })?;

        eprintln!("[TOTP] Secret decoded successfully, creating TOTP with {} bytes", secret.len());

        // Use new_unchecked to allow shorter secrets (like 10 bytes)
        // Many TOTP secrets in the wild are shorter than the 16-byte minimum of TOTP::new()
        Ok(TOTP {
            algorithm: self.algorithm,
            digits: self.digits,
            skew: 1,
            step: self.period,
            secret,
            issuer: self.issuer.clone(),
            account_name: self.account_name.clone().unwrap_or_default(),
        })
    }

    /// Generate otpauth:// URI
    pub fn to_uri(&self) -> Result<String> {
        let totp = self.to_totp()?;
        Ok(totp.get_url())
    }

    /// Generate QR code as PNG bytes
    pub fn to_qr_png(&self) -> Result<Vec<u8>> {
        let totp = self.to_totp()?;
        totp.get_qr_png()
            .map_err(|e| Error::Other(format!("QR generation failed: {}", e)))
    }
}

/// Parse TOTP secret from various formats
pub fn parse_totp_secret(input: &str) -> Result<String> {
    let input = input.trim();
    
    // Check if it's an otpauth:// URI
    if input.starts_with("otpauth://") {
        let config = TotpConfig::from_uri(input)?;
        return Ok(config.secret);
    }
    
    // Remove spaces and convert to uppercase
    let cleaned: String = input
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_uppercase();
    
    // Validate base32
    if base32::decode(Alphabet::RFC4648 { padding: false }, &cleaned).is_none() {
        return Err(Error::InvalidTotp);
    }
    
    Ok(cleaned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_totp_generation() {
        let config = TotpConfig::new("JBSWY3DPEHPK3PXP".to_string());
        let code = config.generate().unwrap();
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_totp_from_uri() {
        let uri = "otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example";
        let config = TotpConfig::from_uri(uri).unwrap();
        assert_eq!(config.secret, "JBSWY3DPEHPK3PXP");
        assert_eq!(config.issuer, Some("Example".to_string()));
    }

    #[test]
    fn test_ttl() {
        let config = TotpConfig::new("JBSWY3DPEHPK3PXP".to_string());
        let ttl = config.ttl();
        assert!(ttl > 0 && ttl <= 30);
    }

    #[test]
    fn test_parse_secret() {
        assert_eq!(
            parse_totp_secret("jbswy3dp ehpk3pxp").unwrap(),
            "JBSWY3DPEHPK3PXP"
        );
        
        assert_eq!(
            parse_totp_secret("JBSWY3DPEHPK3PXP").unwrap(),
            "JBSWY3DPEHPK3PXP"
        );
    }

    #[test]
    fn test_user_totp_key() {
        let secret = "UVOCZBWWKFWAKOLM";
        
        // Test parse
        match parse_totp_secret(secret) {
            Ok(cleaned) => {
                println!("Parsed secret: {}", cleaned);
                
                // Test generation
                let config = TotpConfig::new(cleaned);
                match config.generate() {
                    Ok(code) => println!("Generated code: {}", code),
                    Err(e) => println!("Generate error: {:?}", e),
                }
            }
            Err(e) => println!("Parse error: {:?}", e),
        }
    }
}
