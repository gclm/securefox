# SecureFox Development Guide

## Quick Start

### First Time Setup

```bash
# Clone and build
git clone <your-repo>
cd securefox

# Build and install
make install
```

### Daily Development

```bash
# Quick update after code changes
make update

# Or for rapid iteration (skip service stop)
make dev
```

## Makefile Commands

### Build Commands

| Command | Description |
|---------|-------------|
| `make build` | Build debug version |
| `make release` | Build optimized release version |
| `make check` | Check code without building |
| `make test` | Run tests |
| `make fmt` | Format code |

### Installation Commands

| Command | Description |
|---------|-------------|
| `make install` | Build and install to `/usr/local/bin` (requires sudo) |
| `make uninstall` | Remove from `/usr/local/bin` |
| `make update` | **Update local installation** (stops service, builds, installs) |
| `make upgrade` | Alias for `update` |

### Development Commands

| Command | Description |
|---------|-------------|
| `make dev` | Quick development update (skip service stop) |
| `make version` | Show installed version info |
| `make clean` | Clean build artifacts |
| `make run` | Run from source in debug mode |

## Typical Workflows

### 1. Initial Installation

```bash
make install
```

This will:
- Build the release version
- Copy to `/usr/local/bin/securefox`
- Set executable permissions

### 2. Update After Code Changes

```bash
# Full update (recommended)
make update
```

This will:
- Build the release version
- Stop running service (if any)
- Install new binary
- Show version info
- Remind you to restart service

Or for rapid iteration:

```bash
# Quick update (for rapid development)
make dev
```

This skips the service stop step for faster updates.

### 3. Testing Changes

```bash
# Option 1: Run from source (debug mode)
make run

# Option 2: Build and test
make build
./target/debug/securefox version

# Option 3: Full release test
make release
./target/release/securefox version
```

### 4. Service Management

After updating:

```bash
# Restart the service
securefox service restart

# Or stop and start
securefox service stop
securefox service start

# Check status
securefox service status
```

## Common Tasks

### Format and Check Before Commit

```bash
make fmt
make check
make test
```

### Clean and Rebuild

```bash
make clean
make install
```

### Verify Installation

```bash
make version
# or
securefox version
```

## Service Installation

The `securefox service install` command will:
1. Automatically copy the binary to `/usr/local/bin`
2. Create launchd plist for auto-start
3. No need to run `make install` separately!

```bash
# Build first
make release

# Then install as service (includes binary installation)
./target/release/securefox service install
```

## Directory Structure

```
securefox/
├── Makefile          # Build and installation commands
├── core/             # Core library
├── api/              # API server
├── cli/              # CLI application
└── target/
    ├── debug/        # Debug builds
    └── release/      # Release builds
```

## Tips

1. **Use `make update` for most development work** - It handles everything for you
2. **Use `make dev` for rapid iteration** - Faster but doesn't stop service
3. **Always run `make fmt` before committing** - Keep code formatted
4. **Use `securefox version` to verify updates** - Check git hash and build time

## Troubleshooting

### Command not found after install

```bash
# Check if installed
ls -la /usr/local/bin/securefox

# Check PATH
echo $PATH | grep /usr/local/bin
```

### Service won't stop

```bash
# Force stop
killall securefox

# Or check PID and kill
cat ~/.securefox/service.pid
kill <PID>
```

### Need to reinstall everything

```bash
make uninstall
make clean
make install
```
