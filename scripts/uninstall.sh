#!/bin/bash

# SecureFox uninstallation script

set -e

echo "SecureFox Uninstall Script"
echo "=========================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Unload and remove launchd service (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}Stopping and removing launchd service...${NC}"
    
    # Try to unload the service if it's running
    if launchctl list | grep -q "club.gclmit.securefox.tray"; then
        launchctl unload ~/Library/LaunchAgents/club.gclmit.securefox.tray.plist 2>/dev/null || true
    fi
    
    # Remove the plist file
    rm -f ~/Library/LaunchAgents/club.gclmit.securefox.tray.plist
    
    # Also remove old service names if they exist
    rm -f ~/Library/LaunchAgents/com.securefox.tray.plist
    rm -f ~/Library/LaunchAgents/club.gclmit.securefox.daemon.plist
fi

# Remove binaries
echo -e "${YELLOW}Removing SecureFox binaries...${NC}"
sudo rm -f /usr/local/bin/securefox
sudo rm -f /usr/local/bin/securefox-tray  # Remove old binary if it exists

# Ask about removing vault data
echo -e "${YELLOW}Do you want to remove vault data (~/.securefox)? [y/N]${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${YELLOW}Removing vault data...${NC}"
    rm -rf ~/.securefox
else
    echo -e "${GREEN}Vault data preserved.${NC}"
fi

echo -e "${GREEN}✓ Uninstallation complete!${NC}"
echo ""
echo "Thank you for using SecureFox!"