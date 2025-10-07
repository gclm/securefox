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

# Install launchd service for tray (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}Installing launchd service for tray...${NC}"
    
    # Create launchd plist
    cat > ~/Library/LaunchAgents/club.gclmit.securefox.tray.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>club.gclmit.securefox.tray</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/securefox</string>
        <string>tray</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
EOF
    
    echo -e "${YELLOW}Loading tray service...${NC}"
    launchctl load ~/Library/LaunchAgents/club.gclmit.securefox.tray.plist
fi

# Create vault directory
echo -e "${YELLOW}Creating vault directory...${NC}"
mkdir -p ~/.securefox

echo -e "${GREEN}✓ Installation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Initialize your vault: securefox init"
echo "2. Start the API server: securefox serve"
echo "3. Run the tray app: securefox tray"
echo ""
echo "The tray app will start automatically on login."
