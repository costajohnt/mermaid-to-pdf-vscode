# 📦 npm Publication Instructions

## ✅ Pre-Publication Status

All packages are now ready for publication to npm:

**Package Status:**
- ✅ `@mermaid-converter/core` - Build successful, tests passing
- ✅ `@mermaid-converter/cli` - Build successful, CLI commands verified
- ✅ `@mermaid-converter/mcp-server` - Build successful, MCP integration tested

**Preparation Complete:**
- ✅ All packages have proper versioning (1.0.0)
- ✅ Dependencies updated to use npm packages (not local file references)
- ✅ README files updated with comprehensive documentation
- ✅ LICENSE files added to all packages
- ✅ Repository and homepage links configured
- ✅ Files section configured to include only necessary files
- ✅ All packages build successfully

## 🚀 Publication Steps

### Step 1: Authenticate with npm

```bash
# Login to npm (if not already logged in)
npm login

# Verify you're logged in
npm whoami
```

### Step 2: Publish Core Library First (Required by Others)

```bash
cd /Users/johncosta/dev/mermaid-to-pdf-vscode/packages/core

# Publish as beta first for safety
npm publish --tag beta --access public

# Verify publication
npm view @mermaid-converter/core

# If everything looks good, add latest tag
npm dist-tag add @mermaid-converter/core@1.0.0 latest
```

### Step 3: Publish CLI Tool

```bash
cd /Users/johncosta/dev/mermaid-to-pdf-vscode/packages/cli

# Publish as beta
npm publish --tag beta --access public

# Test global installation
npm install -g @mermaid-converter/cli@beta
mermaid-converter --version
mermaid-converter --help

# If working correctly, add latest tag
npm dist-tag add @mermaid-converter/cli@1.0.0 latest
```

### Step 4: Publish MCP Server

```bash
cd /Users/johncosta/dev/mermaid-to-pdf-vscode/packages/mcp-server

# Publish as beta
npm publish --tag beta --access public

# Verify publication
npm view @mermaid-converter/mcp-server

# Add latest tag
npm dist-tag add @mermaid-converter/mcp-server@1.0.0 latest
```

## 🧪 Post-Publication Testing

### Test 1: Fresh Installation

```bash
# Create a test directory
mkdir /tmp/mermaid-test && cd /tmp/mermaid-test

# Install CLI globally
npm install -g @mermaid-converter/cli

# Test basic functionality
echo "# Test\n\n\`\`\`mermaid\ngraph TD\n  A --> B\n\`\`\`" > test.md
mermaid-converter convert test.md -f pdf
```

### Test 2: Core Library Usage

```bash
# Install as dependency
npm init -y
npm install @mermaid-converter/core

# Create test script
cat > test.js << 'EOF'
import { createConverter, PDFGenerator, MermaidRenderer } from '@mermaid-converter/core';

const converter = createConverter();
converter.registerGenerator(new PDFGenerator());
converter.registerRenderer(new MermaidRenderer());

const markdown = `# Test Document

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`
`;

converter.convert({
  content: markdown,
  format: 'pdf'
}).then(result => {
  console.log('Conversion successful!', result.data.length, 'bytes');
}).catch(error => {
  console.error('Conversion failed:', error);
});
EOF

# Run test
node test.js
```

### Test 3: MCP Server Installation

```bash
# Install MCP server
npm install @mermaid-converter/mcp-server

# Verify files are accessible
ls node_modules/@mermaid-converter/mcp-server/
```

## 📢 GitHub Release

After npm publication succeeds:

```bash
# Tag the release
git tag v1.0.0
git push origin v1.0.0

# Create GitHub release
# 1. Go to https://github.com/costajohnt/mermaid-to-pdf-vscode/releases
# 2. Click "Create a new release"
# 3. Select tag v1.0.0
# 4. Title: "Mermaid Converter v1.0.0 - Production Release"
# 5. Add release notes (see template below)
```

### Release Notes Template

```markdown
# 🎉 Mermaid Converter v1.0.0

We're excited to announce the first production release of Mermaid Converter!

## ✨ Features

- 📄 **PDF Generation** - High-quality PDF output with embedded Mermaid diagrams
- 🎯 **Google Slides Integration** - Convert markdown to presentations
- 📊 **CLI Tool** - Full-featured command-line interface
- 🤖 **MCP Server** - Claude Desktop integration
- 🎨 **6 Professional Templates** - Ready-to-use designs
- 🚀 **Fast & Efficient** - Browser pooling and caching

## 📦 Installation

```bash
# Install CLI globally
npm install -g @mermaid-converter/cli

# Use as library
npm install @mermaid-converter/core
```

## 🚀 Quick Start

```bash
# Convert to PDF
mermaid-converter convert document.md -f pdf

# Convert to Google Slides
mermaid-converter convert presentation.md -f google-slides

# Watch mode
mermaid-converter watch docs/ -f pdf
```

## 📚 Documentation

- [CLI Usage Guide](./docs/CLI_USAGE.md)
- [Google Slides Setup](./docs/GOOGLE_SLIDES_AUTH.md)
- [API Reference](./packages/core/README.md)

## 🙏 Thanks

Special thanks to all beta testers and contributors!

## 🔗 Links

- npm: [@mermaid-converter/cli](https://www.npmjs.com/package/@mermaid-converter/cli)
- npm: [@mermaid-converter/core](https://www.npmjs.com/package/@mermaid-converter/core)
- Documentation: [GitHub Wiki](https://github.com/costajohnt/mermaid-to-pdf-vscode/wiki)
```

## 📊 Success Metrics Tracking

### npm Download Tracking

```bash
# Check download stats after 24 hours
npm-stat @mermaid-converter/cli
npm-stat @mermaid-converter/core
npm-stat @mermaid-converter/mcp-server

# Or use npm website
# https://www.npmjs.com/package/@mermaid-converter/cli
```

### GitHub Metrics

- Watch star count on repository
- Monitor issues for bug reports
- Track fork count for community interest

## 🚨 Rollback Plan

If critical issues are discovered:

```bash
# Deprecate problematic version
npm deprecate @mermaid-converter/cli@1.0.0 "Critical bug found, use 1.0.1"

# Publish patch version
cd packages/cli
npm version patch
npm publish

# Update latest tag
npm dist-tag add @mermaid-converter/cli@1.0.1 latest
```

## 🎯 Next Steps After Publication

1. **Announce on Social Media**
   - Twitter/X announcement with examples
   - LinkedIn post about the project
   - Dev.to article about the journey

2. **Community Engagement**
   - Submit to Awesome lists
   - Share in relevant Discord/Slack communities
   - Reddit posts in r/programming, r/node

3. **Monitor Feedback**
   - Watch GitHub issues
   - Respond to npm package questions
   - Collect feature requests

## ✅ Final Checklist Before Publishing

- [ ] You are logged into npm (`npm whoami`)
- [ ] All tests are passing
- [ ] Documentation is accurate and complete
- [ ] Version numbers are correct (1.0.0)
- [ ] You have time to monitor for issues after publication
- [ ] Release notes are prepared

## 🚀 Ready to Publish!

The packages are fully prepared and tested. When you're ready:

1. Start with the core library
2. Then publish the CLI
3. Finally publish the MCP server
4. Create GitHub release
5. Announce to the world!

Good luck with the launch! 🎉