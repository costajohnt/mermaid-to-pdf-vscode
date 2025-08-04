#!/bin/bash

# Mermaid Converter npm Publication Script
# Run this after logging in with: npm login

set -e  # Exit on error

echo "🚀 Starting Mermaid Converter publication process..."
echo ""

# Step 1: Publish Core Library
echo "📦 Publishing @mermaid-converter/core..."
cd /Users/johncosta/dev/mermaid-to-pdf-vscode/packages/core
npm publish --tag beta --access public
echo "✅ Core library published successfully!"
echo ""

# Wait a moment for npm to propagate
echo "⏳ Waiting for npm propagation..."
sleep 5

# Step 2: Publish CLI Tool
echo "📦 Publishing @mermaid-converter/cli..."
cd /Users/johncosta/dev/mermaid-to-pdf-vscode/packages/cli
npm publish --tag beta --access public
echo "✅ CLI tool published successfully!"
echo ""

# Step 3: Publish MCP Server
echo "📦 Publishing @mermaid-converter/mcp-server..."
cd /Users/johncosta/dev/mermaid-to-pdf-vscode/packages/mcp-server
npm publish --tag beta --access public
echo "✅ MCP server published successfully!"
echo ""

# Step 4: Test CLI installation
echo "🧪 Testing global CLI installation..."
npm install -g @mermaid-converter/cli@beta
mermaid-converter --version
echo "✅ CLI installation test passed!"
echo ""

# Step 5: Show next steps
echo "🎉 All packages published successfully as beta!"
echo ""
echo "📋 Next steps:"
echo "1. Test the packages thoroughly"
echo "2. If everything works, promote to latest:"
echo "   npm dist-tag add @mermaid-converter/core@1.0.0 latest"
echo "   npm dist-tag add @mermaid-converter/cli@1.0.0 latest"
echo "   npm dist-tag add @mermaid-converter/mcp-server@1.0.0 latest"
echo ""
echo "3. Create GitHub release:"
echo "   git tag v1.0.0"
echo "   git push origin v1.0.0"
echo ""
echo "📊 View your packages:"
echo "   https://www.npmjs.com/package/@mermaid-converter/core"
echo "   https://www.npmjs.com/package/@mermaid-converter/cli"
echo "   https://www.npmjs.com/package/@mermaid-converter/mcp-server"