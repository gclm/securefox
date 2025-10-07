#!/bin/bash

# SecureFox installation script

set -e

echo "SecureFox Installation Script"
echo "=============================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Build the project
echo -e "${YELLOW}Building SecureFox...${NC}"
cargo build --release

# Install CLI
echo -e "${YELLOW}Installing SecureFox CLI...${NC}"
sudo cp target/release/securefox /usr/local/bin/
sudo chmod +x /usr/local/bin/securefox

# Install tray application (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}Installing SecureFox Tray...${NC}"
    sudo cp target/release/securefox-tray /usr/local/bin/
    sudo chmod +x /usr/local/bin/securefox-tray
    
    # Install launchd service
    echo -e "${YELLOW}Installing launchd service...${NC}"
    cp club.gclmit.securefox.daemon.plist ~/Library/LaunchAgents/
    
    echo -e "${YELLOW}Starting SecureFox daemon...${NC}"
    launchctl load ~/Library/LaunchAgents/club.gclmit.securefox.daemon.plist
fi

# Create vault directory
echo -e "${YELLOW}Creating vault directory...${NC}"
mkdir -p ~/.securefox

echo -e "${GREEN}✓ Installation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Initialize your vault: securefox init"
echo "2. Start the API server: securefox serve"
echo "3. Run the tray app: securefox-tray"
echo ""
echo "The daemon will start automatically on login."