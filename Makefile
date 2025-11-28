.PHONY: build release install uninstall clean help check test fmt update upgrade version dev

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

# Default target
help:
	@echo "$(CYAN)SecureFox - Build & Install$(NC)"
	@echo ""
	@echo "$(GREEN)Build Commands:$(NC)"
	@echo "  build     - Build debug version"
	@echo "  release   - Build release version (optimized)"
	@echo "  check     - Check code without building"
	@echo "  test      - Run tests"
	@echo "  fmt       - Format code"
	@echo ""
	@echo "$(GREEN)Installation:$(NC)"
	@echo "  install   - Build and install to /usr/local/bin (requires sudo)"
	@echo "  uninstall - Remove from /usr/local/bin (requires sudo)"
	@echo "  update    - Update local installation (build + install)"
	@echo "  upgrade   - Same as update"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  dev       - Quick build and install for development"
	@echo "  version   - Show installed version info"
	@echo "  clean     - Clean build artifacts"
	@echo "  run       - Run from source (debug mode)"
	@echo ""

# Build debug version
build:
	@echo "$(CYAN)Building debug version...$(NC)"
	cargo build
	@echo "$(GREEN)✓ Debug build complete$(NC)"

# Build release version
release:
	@echo "$(CYAN)Building release version...$(NC)"
	cargo build --release
	@echo "$(GREEN)✓ Release build complete$(NC)"

# Check code
check:
	@echo "$(CYAN)Checking code...$(NC)"
	cargo check --all-targets
	@echo "$(GREEN)✓ Check complete$(NC)"

# Run tests
test:
	@echo "$(CYAN)Running tests...$(NC)"
	cargo test
	@echo "$(GREEN)✓ Tests complete$(NC)"

# Format code
fmt:
	@echo "$(CYAN)Formatting code...$(NC)"
	cargo fmt --all
	@echo "$(GREEN)✓ Code formatted$(NC)"

# Install to system path
install: release
	@echo ""
	@echo "$(CYAN)Installing securefox to /usr/local/bin...$(NC)"
	@sudo cp target/release/securefox /usr/local/bin/securefox
	@sudo chmod +x /usr/local/bin/securefox
	@echo ""
	@echo "$(GREEN)✓ Installed successfully!$(NC)"
	@echo "  Binary: /usr/local/bin/securefox"
	@echo ""
	@echo "Verify installation:"
	@echo "  securefox version"

# Uninstall from system path
uninstall:
	@echo "$(YELLOW)Uninstalling securefox...$(NC)"
	@sudo rm -f /usr/local/bin/securefox
	@echo "$(GREEN)✓ Uninstalled successfully!$(NC)"

# Update local installation (one-command update)
update: release
	@echo ""
	@echo "$(CYAN)Updating local securefox installation...$(NC)"
	@# Check if securefox is installed
	@if [ -f /usr/local/bin/securefox ]; then \
		echo "$(YELLOW)Checking if service is running...$(NC)"; \
		if launchctl list | grep -q club.gclmit.securefox; then \
			echo "$(YELLOW)Stopping launchd service...$(NC)"; \
			launchctl bootout gui/$$(id -u) ~/Library/LaunchAgents/club.gclmit.securefox.plist 2>/dev/null || \
			launchctl unload ~/Library/LaunchAgents/club.gclmit.securefox.plist 2>/dev/null || true; \
			sleep 1; \
		else \
			echo "$(YELLOW)Stopping manual service (if any)...$(NC)"; \
			securefox service stop 2>/dev/null || true; \
			sleep 1; \
		fi; \
	fi
	@echo "$(CYAN)Installing new version...$(NC)"
	@sudo cp target/release/securefox /usr/local/bin/securefox
	@sudo chmod +x /usr/local/bin/securefox
	@echo ""
	@echo "$(GREEN)✓ Update completed!$(NC)"
	@echo ""
	@securefox version
	@echo ""
	@# Auto-restart launchd service if plist exists
	@if [ -f ~/Library/LaunchAgents/club.gclmit.securefox.plist ]; then \
		echo "$(CYAN)Restarting launchd service...$(NC)"; \
		launchctl bootstrap gui/$$(id -u) ~/Library/LaunchAgents/club.gclmit.securefox.plist 2>/dev/null || \
		launchctl load ~/Library/LaunchAgents/club.gclmit.securefox.plist 2>/dev/null || true; \
		echo "$(GREEN)✓ Service restarted$(NC)"; \
		echo ""; \
		echo "Check service status:"; \
		echo "  securefox service status"; \
	else \
		echo "To restart service:"; \
		echo "  securefox service start"; \
	fi

# Alias for update
upgrade: update

# Quick development update (skip service stop)
dev: release
	@echo "$(CYAN)Quick development update...$(NC)"
	@sudo cp target/release/securefox /usr/local/bin/securefox
	@sudo chmod +x /usr/local/bin/securefox
	@echo "$(GREEN)✓ Updated!$(NC)"

# Show version
version:
	@if [ -f /usr/local/bin/securefox ]; then \
		securefox version; \
	else \
		echo "$(YELLOW)securefox is not installed. Run 'make install' first.$(NC)"; \
	fi

# Clean build artifacts
clean:
	@echo "$(CYAN)Cleaning build artifacts...$(NC)"
	@cargo clean
	@echo "$(GREEN)✓ Cleaned$(NC)"

# Run from source (debug)
run:
	@cargo run --
