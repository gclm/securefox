# SecureFox

A local-first password manager with Git synchronization and browser extension UI.

## Features

- 🔐 **Zero-knowledge encryption** - Your master password never leaves your device
- 🔄 **Git-based sync** - Use any Git repository for synchronization  
- 🦊 **Browser extension** - Modern UI built with React and WXT
- 🖥️ **System tray** - Quick access from your menu bar
- 🔑 **TOTP support** - Built-in 2FA code generation
- 📥 **Bitwarden compatible** - Import your existing vault

## Architecture

- **Core**: Rust library for encryption and data management
- **CLI**: Command-line interface and daemon
- **API**: HTTP server for browser extension communication  
- **Tray**: System tray application
- **Extension**: Browser extension (Chrome/Firefox)

## Quick Start

### Build from source

```bash
# Build all Rust components
cargo build --release

# Build browser extension
cd extension
npm install
npm run build
```

### Install

```bash
# Install CLI
cargo install --path cli

# Start daemon
securefox serve

# Or install as system service (macOS)
cp club.gclmit.securefox.daemon.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/club.gclmit.securefox.daemon.plist
```

## Security

SecureFox uses industry-standard encryption:
- **KDF**: Argon2id
- **Encryption**: AES-256-GCM-SIV
- **TOTP**: HMAC-SHA1/SHA256 (RFC 6238)

## License

MIT OR Apache-2.0