# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

SecureFox is a **local-first password manager** with zero-knowledge encryption, Git synchronization, and a browser extension UI. The codebase is split between:
- **Rust workspace**: Core encryption library, HTTP API server, and CLI daemon
- **Browser extension**: WXT + React extension for Chrome/Firefox

## Common Development Commands

### Rust Components (Core, API, CLI)

```bash
# Build and install (production)
make install                  # Build release + install to /usr/local/bin (requires sudo)

# Development workflow
make update                   # Full update: build + stop service + install + show version
make dev                      # Quick dev update (skip service stop for faster iteration)

# Build variants
make build                    # Debug build
make release                  # Release build (optimized)
make run                      # Run from source in debug mode

# Code quality
make fmt                      # Format all Rust code
make check                    # Check code without building
make test                     # Run all tests

# Utilities
make version                  # Show installed version
make clean                    # Clean build artifacts
make uninstall                # Remove from /usr/local/bin
```

### Browser Extension

```bash
cd extension

# Development
npm install                   # Or pnpm install
npm run dev                   # Start dev server for Chrome
npm run dev:firefox           # Start dev server for Firefox

# Build
npm run build                 # Build for Chrome
npm run build:firefox         # Build for Firefox
npm run zip                   # Package for Chrome
npm run zip:firefox           # Package for Firefox

# Type checking
npm run compile               # TypeScript type check (no emit)
```

### Service Management

```bash
# After updating the binary
securefox service restart     # Restart daemon
securefox service stop        # Stop daemon
securefox service start       # Start daemon
securefox service status      # Check status
```

### Testing Individual Components

```bash
# Test specific Rust workspace member
cargo test -p securefox-core
cargo test -p cli
cargo test -p api

# Run specific test
cargo test test_name -- --nocapture
```

## Architecture Overview

### System Architecture

**4-Layer Design:**
1. **User Interface Layer**
   - Browser Extension (WXT + React + Zustand + TanStack Query)
   - System Tray (Rust `tray-icon` + `tao`)

2. **Service Layer**
   - HTTP API (Axum server on `localhost:8787`)
   - CLI Daemon (`securefox serve`)

3. **Core Layer** (`core/` crate)
   - Encryption Engine (AES-256-GCM-SIV)
   - Data Model (Bitwarden-compatible vault format)
   - TOTP Engine (RFC 6238)
   - Git Sync (git2-rs)

4. **Storage Layer**
   - Encrypted Vault: `~/.securefox/vault.sf`
   - System Keychain (macOS Keychain / Windows Credential Manager)
   - Git Remote Repository

### Key Flows

**Unlock Flow:**
- User enters master password → Argon2id key derivation → Decrypt vault → Create session JWT token (15min expiry) → Store token in extension storage

**Autofill Flow:**
- Content script detects login form → Query API for matching entries by domain → Display credential picker → Fill username/password → If TOTP exists, fetch and fill code

**Git Sync Flow:**
- Watch for vault changes → Auto-commit on modification → Pull with 3-way merge for conflicts → Push to remote

**Bitwarden Import:**
- Parse exported JSON → Map schema (folders/items/login/card/identity/totp) → Validate → Write to vault → Commit and push

### Data Model

**Vault Structure** (Bitwarden-compatible):
- `folders[]`: Folder hierarchy
- `items[]`: Login/SecureNote/Card/Identity items
  - `login.totp`: TOTP secret in `otpauth://totp/...` format
  - `login.uris[]`: Associated URLs with match types
  - `fields[]`: Custom fields (Text/Hidden/Boolean)

**Encryption Format:**
```json
{
  "version": "1.0",
  "kdf": "argon2id",
  "kdf_params": {
    "memory": 65536,
    "iterations": 3,
    "parallelism": 4
  },
  "salt": "base64_encoded_salt",
  "nonce": "base64_encoded_nonce",
  "encrypted_data": "base64_encoded_ciphertext"
}
```

### Technology Stack

**Rust:**
- Encryption: `argon2`, `aes-gcm-siv`, `zeroize`
- TOTP: `totp-rs`, `qrcode`, `base32`
- Git: `git2`
- API: `axum`, `tower`, `tokio`
- System integration: `keyring`, `tray-icon`

**Extension:**
- Framework: `wxt` (0.20.6) + React 19
- State: `zustand`
- API: `axios` + `@tanstack/react-query`
- UI: Radix UI + Tailwind CSS

### Security Properties

- **Zero-knowledge**: Master password never leaves device; all encryption/decryption client-side
- **KDF**: Argon2id (64MB memory, 3 iterations, 4 parallelism)
- **Encryption**: AES-256-GCM-SIV (authenticated encryption with replay protection)
- **Transport**: HTTP API binds to `localhost` only
- **Session**: JWT tokens expire in 15 minutes; configurable auto-lock

### Directory Layout

```
~/.securefox/
├── vault.sf           # Encrypted vault
├── config.toml        # User configuration
├── backups/           # Auto-backups (last 10 versions)
├── .git/              # Git repository
└── logs/              # Service logs
```

## Development Tips

1. **Typical workflow**: Make Rust changes → `make update` → `securefox service restart`
2. **Rapid iteration**: Use `make dev` to skip service stop (faster but may cause conflicts)
3. **Format before commit**: Always run `make fmt` before committing Rust code
4. **Service installation**: `securefox service install` handles both binary installation and launchd/systemd setup
5. **Extension hot reload**: `npm run dev` auto-reloads on changes

## Performance Targets

- Daemon startup: < 500ms
- Unlock time: < 1s (including Argon2id KDF)
- API response: < 50ms (P99)
- Memory footprint: Daemon < 20MB, Tray < 10MB, Extension < 50MB
- Vault capacity: 10,000+ entries
