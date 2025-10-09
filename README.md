# 🦊 SecureFox

<div align="center">

[![CI](https://github.com/gclm/securefox/workflows/CI/badge.svg)](https://github.com/gclm/securefox/actions)
[![Release](https://github.com/gclm/securefox/workflows/Release/badge.svg)](https://github.com/gclm/securefox/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A secure, local-first password manager with Git synchronization and modern browser extension**

English | [简体中文](README.zh-CN.md)

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Architecture](#-architecture) • [Security](#-security) • [Development](#-development)

</div>

---

## 🌟 Features

### 🔐 Security First
- **Zero-knowledge encryption** - Your master password never leaves your device
- **Industry-standard cryptography** - AES-256-GCM-SIV with Argon2id/PBKDF2
- **Local-first design** - All data stays on your machine
- **End-to-end encrypted sync** - Optional Git-based synchronization

### 🎯 User Experience
- **🦊 Modern Browser Extension** - Beautiful UI built with React, TypeScript, and Tailwind CSS
- **🖥️ Command-line Interface** - Full-featured CLI for power users
- **🔄 Git-based Sync** - Use any Git repository (GitHub, GitLab, self-hosted)
- **🔑 TOTP Support** - Built-in 2FA code generation (RFC 6238 compliant)
- **📥 Bitwarden Import** - Easy migration from Bitwarden
- **🚀 Fast & Lightweight** - Written in Rust for optimal performance

### 🛠️ Developer Friendly
- **RESTful API** - HTTP server for browser extension communication
- **Cross-platform** - Works on macOS, Linux, and Windows
- **Extensible** - Modular architecture with clear separation of concerns
- **Well-tested** - Comprehensive test coverage with CI/CD

---

## 📦 Installation

### Pre-built Binaries

Download the latest release for your platform from [GitHub Releases](https://github.com/gclm/securefox/releases):

**macOS:**
```bash
# Intel (x86_64)
curl -L https://github.com/gclm/securefox/releases/latest/download/securefox-x86_64-apple-darwin.tar.gz | tar xz
sudo mv securefox /usr/local/bin/

# Apple Silicon (aarch64)
curl -L https://github.com/gclm/securefox/releases/latest/download/securefox-aarch64-apple-darwin.tar.gz | tar xz
sudo mv securefox /usr/local/bin/
```

**Linux:**
```bash
# x86_64
curl -L https://github.com/gclm/securefox/releases/latest/download/securefox-x86_64-unknown-linux-gnu.tar.gz | tar xz
sudo mv securefox /usr/local/bin/

# ARM64
curl -L https://github.com/gclm/securefox/releases/latest/download/securefox-aarch64-unknown-linux-gnu.tar.gz | tar xz
sudo mv securefox /usr/local/bin/
```

**Windows:**
Download `securefox-x86_64-pc-windows-msvc.zip` from releases and extract to your desired location.

### Browser Extension

1. Download the extension from [GitHub Releases](https://github.com/gclm/securefox/releases)
   - **Chrome/Edge**: `securefox-extension-chrome.zip`
   - **Firefox**: `securefox-extension-firefox.zip`

2. Install in your browser:
   - **Chrome/Edge**: Navigate to `chrome://extensions/`, enable "Developer mode", and load the unpacked extension
   - **Firefox**: Navigate to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select the extension

### Build from Source

**Prerequisites:**
- Rust 1.70+ (`rustup` recommended)
- Node.js 20+ and pnpm
- Git

```bash
# Clone repository
git clone https://github.com/gclm/securefox.git
cd securefox

# Build CLI and API server
cargo build --release --all-features

# Build browser extension
cd extension
pnpm install
pnpm build        # For Chrome
pnpm build:firefox # For Firefox

# Install CLI
cargo install --path cli
```

---

## 🚀 Usage

### Quick Start

```bash
# Initialize a new vault
securefox init

# Add a new login
securefox add github.com --username user@example.com

# List all items
securefox list

# Show item details
securefox show github.com

# Generate strong password
securefox generate --length 32 --symbols

# Start API server for browser extension
securefox serve
```

### Command Reference

#### Vault Management
```bash
# Initialize new vault
securefox init [--vault <path>] [--kdf argon2|pbkdf2]

# Unlock vault (starts session)
securefox unlock [--remember]

# Lock vault (ends session)
securefox lock

# Sync with Git remote
securefox sync [--pull] [--push]
```

#### Item Operations
```bash
# Add new item
securefox add <name> [--username <user>] [--generate] [--totp <secret>]

# Show item details
securefox show <name> [--copy] [--totp]

# Edit existing item
securefox edit <name>

# Remove item
securefox remove <name> [--force]

# List all items
securefox list [--folder <name>] [--search <term>] [--detailed]
```

#### Tools
```bash
# Generate password
securefox generate [--length <n>] [--numbers] [--symbols] [--copy]

# Generate TOTP code
securefox totp <item> [--copy]

# Import from Bitwarden
securefox import <file> --format bitwarden

# Export vault
securefox export <file> --format json
```

#### Service Management (macOS)
```bash
# Install as system service
securefox service enable

# Check service status
securefox service status

# Start service
securefox service start

# Stop service
securefox service stop

# Uninstall service
securefox service disable
```

### Configuration

Create `~/.securefox/config.toml`:

```toml
[vault]
path = "~/.securefox"
kdf = "argon2"  # or "pbkdf2"

[api]
host = "127.0.0.1"
port = 8787
timeout = 300  # seconds

[sync]
enabled = true
remote = "git@github.com:username/securefox-vault.git"
auto_pull = true
auto_push = false
interval = 300  # seconds
```

---

## 🏗️ Architecture

SecureFox is built with a modular architecture:

```
securefox/
├── core/           # Core library (encryption, vault management)
│   ├── crypto/     # Cryptographic primitives
│   ├── models/     # Data models
│   ├── storage/    # Vault storage
│   ├── importers/  # Import from other password managers
│   ├── git_sync/   # Git synchronization
│   └── totp/       # TOTP generation
├── cli/            # Command-line interface
│   ├── commands/   # CLI commands
│   └── utils/      # Helper utilities
├── api/            # HTTP API server
│   ├── routes/     # API endpoints
│   └── middleware/ # Request handling
└── extension/      # Browser extension
    ├── entrypoints/ # Extension entry points
    ├── components/  # React components
    ├── hooks/       # React hooks
    └── store/       # State management
```

### Technology Stack

**Backend (Rust):**
- `aes-gcm-siv` - Authenticated encryption
- `argon2` / `pbkdf2` - Key derivation
- `tokio` - Async runtime
- `axum` - Web framework
- `git2` - Git integration (optional)
- `totp-lite` - TOTP generation

**Frontend (TypeScript/React):**
- `React 19` - UI framework
- `WXT` - Browser extension framework
- `TanStack Query` - Data fetching
- `Zustand` - State management
- `Tailwind CSS` - Styling
- `Radix UI` - Accessible components

---

## 🔒 Security

### Encryption

SecureFox uses industry-standard cryptography:

| Component | Algorithm | Purpose |
|-----------|-----------|------|
| **Key Derivation** | Argon2id or PBKDF2-HMAC-SHA256 | Derive encryption key from master password |
| **Encryption** | AES-256-GCM-SIV | Encrypt vault data with authenticated encryption |
| **TOTP** | HMAC-SHA1/SHA256 | Generate time-based one-time passwords |
| **Random** | OS CSPRNG | Generate secure random values |

### Threat Model

**What SecureFox protects against:**
- ✅ Data breaches (encrypted at rest)
- ✅ Network sniffing (E2E encrypted sync)
- ✅ Malicious Git servers (E2E encrypted)
- ✅ Brute force attacks (Argon2id KDF)
- ✅ Memory dumps (secure memory wiping)

**What SecureFox does NOT protect against:**
- ❌ Keyloggers (use 2FA and trusted devices)
- ❌ Compromised master password (choose strong password)
- ❌ Physical access to unlocked device
- ❌ Browser/OS vulnerabilities

### Best Practices

1. **Use a strong master password** (12+ characters, mixed case, numbers, symbols)
2. **Enable Argon2id KDF** for maximum security (slightly slower)
3. **Use Git with SSH keys** for secure synchronization
4. **Lock vault when not in use** (auto-lock after timeout)
5. **Keep backups** (encrypted vault can be backed up safely)
6. **Review Git history** before syncing from untrusted sources

---

## 🧪 Development

### Prerequisites

- Rust 1.70+ with `rustup`
- Node.js 20+ and pnpm
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/gclm/securefox.git
cd securefox

# Install dependencies
cargo build
cd extension && pnpm install

# Run tests
cargo test --all-features
cargo clippy --all-targets --all-features -- -D warnings
cargo fmt --all -- --check
```

### Project Structure

```
├── core/           # Core library (shared)
├── cli/            # CLI binary
├── api/            # API server
├── extension/      # Browser extension
├── docs/           # Documentation
├── .github/        # CI/CD workflows
└── issues/         # Project tracking
```

### Running Development Environment

**Terminal 1 - API Server:**
```bash
cargo run --bin securefox -- serve --host 127.0.0.1 --port 8787
```

**Terminal 2 - Browser Extension (Chrome):**
```bash
cd extension
pnpm dev
```

**Terminal 3 - Browser Extension (Firefox):**
```bash
cd extension
pnpm dev:firefox
```

### Running Tests

```bash
# Unit tests
cargo test

# Integration tests
cargo test --all-features

# Test with coverage
cargo tarpaulin --all-features --workspace --out Html

# Benchmark tests
cargo bench
```

### Code Quality

```bash
# Format code
cargo fmt --all

# Run linter
cargo clippy --all-targets --all-features -- -D warnings

# Check for security issues
cargo audit

# Update dependencies
cargo update
```

### Building Release

```bash
# Build optimized binaries
cargo build --release --all-features

# Build for specific target
cargo build --release --target x86_64-apple-darwin

# Build extension
cd extension
pnpm build
pnpm zip
```

---

## 📚 Documentation

- [User Guide](docs/USER_GUIDE.md) - Comprehensive usage guide
- [API Documentation](docs/API.md) - REST API reference
- [Development Guide](docs/DEVELOPMENT.md) - Contributing guide
- [Security Policy](SECURITY.md) - Security and vulnerability reporting
- [Changelog](CHANGELOG.md) - Release history

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

### Ways to Contribute

- 🐛 Report bugs and request features via [Issues](https://github.com/gclm/securefox/issues)
- 💻 Submit pull requests with bug fixes or new features
- 📖 Improve documentation
- 🌍 Translate to other languages
- ⭐ Star the project if you find it useful

### Development Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Bitwarden](https://bitwarden.com/) - Inspiration and import format
- [Rust Crypto](https://github.com/RustCrypto) - Cryptographic primitives
- [WXT](https://wxt.dev/) - Browser extension framework
- [Radix UI](https://www.radix-ui.com/) - Accessible UI components

---

## 📧 Contact

- **Author**: GCLM
- **Email**: gclmit@163.com
- **GitHub**: [@gclm](https://github.com/gclm)
- **Repository**: [github.com/gclm/securefox](https://github.com/gclm/securefox)

---

<div align="center">

**⭐ Star this project if you find it useful! ⭐**

Made with ❤️ and 🦀 by GCLM

</div>
