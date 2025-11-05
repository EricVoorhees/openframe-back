#!/bin/bash

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Render MCP Server Setup for Cursor                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if API key is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Render API key required${NC}"
    echo ""
    echo "Usage:"
    echo "  ./setup-render-mcp.sh YOUR_RENDER_API_KEY"
    echo ""
    echo "Don't have an API key yet?"
    echo "  1. Go to: https://dashboard.render.com/u/settings"
    echo "  2. Scroll to 'API Keys'"
    echo "  3. Click 'Create API Key'"
    echo "  4. Copy the key and run this script again"
    exit 1
fi

API_KEY="$1"

echo -e "${YELLOW}📋 API Key:${NC} ${API_KEY:0:20}...${API_KEY: -10}"
echo ""

# Determine config directory based on OS
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows (Git Bash)
    CONFIG_DIR="$USERPROFILE/.cursor"
else
    # Mac/Linux
    CONFIG_DIR="$HOME/.cursor"
fi

CONFIG_FILE="$CONFIG_DIR/mcp.json"

echo -e "${YELLOW}📁 Config location:${NC} $CONFIG_FILE"
echo ""

# Create directory if it doesn't exist
if [ ! -d "$CONFIG_DIR" ]; then
    echo -e "${YELLOW}📦 Creating config directory...${NC}"
    mkdir -p "$CONFIG_DIR"
    echo -e "${GREEN}✓ Directory created${NC}"
else
    echo -e "${GREEN}✓ Config directory exists${NC}"
fi
echo ""

# Check if mcp.json already exists
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠️  mcp.json already exists${NC}"
    echo "   Creating backup: mcp.json.backup"
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
    echo -e "${GREEN}✓ Backup created${NC}"
    echo ""
fi

# Create or update mcp.json
echo -e "${YELLOW}📝 Creating MCP configuration...${NC}"

cat > "$CONFIG_FILE" << EOF
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer $API_KEY"
      }
    }
  }
}
EOF

echo -e "${GREEN}✓ Configuration created${NC}"
echo ""

# Verify file was created
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${GREEN}✓ File verified at: $CONFIG_FILE${NC}"
    echo ""
    
    # Show preview
    echo -e "${YELLOW}📄 Configuration preview:${NC}"
    cat "$CONFIG_FILE" | sed "s/$API_KEY/****HIDDEN****/g"
    echo ""
else
    echo -e "${RED}❌ Failed to create config file${NC}"
    exit 1
fi

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ SUCCESS! Render MCP Server Configured              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}📋 Next Steps:${NC}"
echo ""
echo -e "${YELLOW}1. Restart Cursor${NC}"
echo "   Close and reopen Cursor for changes to take effect"
echo ""
echo -e "${YELLOW}2. Set your workspace${NC}"
echo "   In Cursor, say:"
echo "   → 'Set my Render workspace to [YOUR_WORKSPACE_NAME]'"
echo "   Or: 'Show me my Render workspaces'"
echo ""
echo -e "${YELLOW}3. Start using it!${NC}"
echo "   Try prompts like:"
echo "   → 'List my Render services'"
echo "   → 'Deploy the backend to Render'"
echo "   → 'Show me error logs from the past hour'"
echo ""

echo -e "${BLUE}💡 What you can now do:${NC}"
echo "   ✓ Deploy services directly from chat"
echo "   ✓ Check deployment status"
echo "   ✓ Query logs and metrics"
echo "   ✓ Create databases"
echo "   ✓ Troubleshoot issues"
echo "   ✓ Manage environment variables"
echo ""

echo -e "${GREEN}🎉 I can now manage your Render infrastructure!${NC}"

