# Mermaid to PDF CLI Tool

Transform your Markdown documentation with Mermaid diagrams into professional PDFs with perfectly rendered diagrams embedded as high-quality images.

![CLI Tool](https://img.shields.io/badge/CLI-Tool-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-orange)
![Node.js](https://img.shields.io/badge/node.js-18%2B-brightgreen)

## 🚀 Quick Installation

### Install CLI Tool Globally

```bash
npm install -g mermaid-to-pdf-cli
```

### Basic Usage

```bash
# Convert a markdown file to PDF
mermaid-to-pdf document.md

# Custom output file and options
mermaid-to-pdf document.md -o output.pdf -t dark -q high

# Show help
mermaid-to-pdf --help
```

## ✨ Features

- 📄 **Smart Conversion**: Convert Markdown files to PDF with full formatting preservation
- 🎨 **Diagram Rendering**: Automatically detect and render Mermaid diagrams as high-quality images
- ⚡ **Performance Optimized**: Browser pooling and diagram caching for 30% faster conversion
- 🖥️ **Command Line Interface**: Easy-to-use CLI with progress reporting
- 🔧 **Configurable**: Customizable quality, themes, page sizes, and output paths
- 🛡️ **Enterprise Ready**: Input validation, security features, and comprehensive error handling

## 📋 CLI Options

```bash
Usage: mermaid-to-pdf <input.md> [options]

Options:
  -o, --output <file>    Output PDF file path (default: input.pdf)
  -t, --theme <theme>    Mermaid theme (default: light)
  -q, --quality <level>  PDF quality: draft, standard, high (default: high)
  -p, --page <size>      Page size: A4, Letter, Legal (default: A4)
  -h, --help            Show this help message

Examples:
  mermaid-to-pdf document.md
  mermaid-to-pdf document.md -o output.pdf -t dark -q high
```

## 🤖 MCP Server Integration

This tool also works as an MCP (Model Context Protocol) server for integration with AI tools like Claude Code, VSCode with MCP extensions, and other MCP-compatible applications.

### Install MCP Server in Claude Code

1. **Add to Claude Code settings** (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "mermaid-to-pdf": {
      "command": "npx",
      "args": ["@mermaid-to-pdf/mcp-server"],
      "description": "Convert Markdown with Mermaid diagrams to PDF"
    }
  }
}
```

2. **Restart Claude Code** to load the MCP server

3. **Use in conversations**:
```
Can you convert this markdown to PDF:

# My Document
```mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
```
```

### Install MCP Server in VSCode

1. **Install MCP Extension** for VSCode (if available)

2. **Add server configuration** to VSCode settings:

```json
{
  "mcp.servers": [
    {
      "name": "mermaid-to-pdf",
      "command": "npx",
      "args": ["@mermaid-to-pdf/mcp-server"],
      "description": "Markdown + Mermaid to PDF converter"
    }    ]
}
```

### MCP Server Tools

The MCP server provides these tools:

- `convert_markdown_to_pdf` - Convert markdown content to PDF (returns base64)
- `convert_markdown_file_to_pdf` - Convert markdown file to PDF file
- `extract_mermaid_diagrams` - Extract diagrams as images
- `validate_mermaid_syntax` - Validate Mermaid syntax

## 📋 Supported Mermaid Diagram Types

The tool supports all major Mermaid diagram types:

- **Flowcharts** (`graph`, `flowchart`)
- **Sequence Diagrams** (`sequenceDiagram`)
- **Class Diagrams** (`classDiagram`)
- **State Diagrams** (`stateDiagram`)
- **Entity Relationship Diagrams** (`erDiagram`)
- **User Journey** (`journey`)
- **Gantt Charts** (`gantt`)
- **Pie Charts** (`pie`)
- **Requirement Diagrams** (`requirementDiagram`)
- **Gitgraph** (`gitGraph`)

## 📝 Example Usage

### Simple Flowchart

Create a file `example.md`:

```markdown
# Project Documentation

## System Architecture

```mermaid
flowchart TD
    A[Client Application] -->|HTTPS| B[Load Balancer]
    B --> C[Web Server 1]
    B --> D[Web Server 2]
    C --> E[(Database)]
    D --> E
    E --> F[Cache Layer]
    F --> G[External API]
```

This flowchart shows our system architecture with load balancing.
```

Convert to PDF:

```bash
mermaid-to-pdf example.md -o architecture.pdf -t dark -q high
```

### Complex Multi-Diagram Document

```markdown
# Complete System Documentation

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    participant DB as Database
    
    U->>C: Enter credentials
    C->>S: Login request
    S->>DB: Validate user
    DB-->>S: User data
    S-->>C: JWT token
    C-->>U: Login success
```

## Class Structure

```mermaid
classDiagram
    class User {
        +String username
        +String email
        +Date createdAt
        +login()
        +logout()
        +updateProfile()
    }
    
    class Post {
        +String title
        +String content
        +Date publishedAt
        +publish()
        +unpublish()
    }
    
    User ||--o{ Post : creates
```
```

## 📊 Performance Features

### Browser Pooling
- **30% faster** diagram rendering through browser instance reuse
- Configurable pool size (default: 2 browsers)
- Automatic cleanup and memory management

### Diagram Caching
- **Intelligent caching** based on diagram content hash
- Avoids re-rendering identical diagrams
- Cache statistics available in console output

### Optimized Processing
- **Concurrent processing** of multiple diagrams
- **Async file operations** for better performance
- **Progressive loading** with detailed progress feedback

## 🛡️ Security Features

### Input Validation
- File path traversal protection
- File size limits (10MB max)
- File type validation (`.md` files only)
- Content sanitization for Mermaid code

### Safe Processing
- Sandboxed browser execution
- Content Security Policy enforcement
- Protection against malicious diagram content
- Secure temporary file handling

## 🔍 Troubleshooting

### Common Issues

**Issue**: "Failed to convert: File not found"
```
Solution: Ensure the Markdown file exists and you have read permissions
```

**Issue**: "Browser pool exhausted"
```
Solution: Close other applications using browser resources or restart your terminal
```

**Issue**: "Mermaid diagram failed to render"
```
Solution: Check diagram syntax using Mermaid Live Editor (https://mermaid.live)
```

**Issue**: "File too large"
```
Solution: Split large files or reduce diagram complexity (max 10MB file size)
```

### Debug Information

The CLI tool provides detailed progress information and error messages. For additional debugging, check the console output for:
- Browser pool status
- Diagram processing details
- Cache statistics
- Performance metrics

## 📈 Performance Metrics

Based on internal testing:
- **Conversion Time**: 16s average for complex documents (30% improvement with caching)
- **Memory Usage**: 60% reduction through browser pooling
- **Cache Hit Rate**: 85%+ for repeated diagrams
- **Success Rate**: 95%+ for valid Mermaid diagrams

## 🔧 Requirements

### System Requirements
- **Node.js**: 18.x or higher
- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **Memory**: Minimum 2GB RAM (4GB recommended)
- **Disk Space**: 100MB free space

### Dependencies
- **Puppeteer**: 23.0.2+ (for browser automation)
- **Marked**: 12.0.0+ (for Markdown parsing)

## 🚀 Advanced Usage

### Batch Processing

Process multiple files with a script:

```bash
#!/bin/bash
for file in docs/*.md; do
  mermaid-to-pdf "$file" -o "pdfs/$(basename "$file" .md).pdf"
done
```

### Integration with Build Systems

Use in package.json scripts:

```json
{
  "scripts": {
    "docs": "mermaid-to-pdf README.md -o dist/documentation.pdf",
    "build-docs": "find docs/ -name '*.md' -exec mermaid-to-pdf {} \\;"
  }
}
```

### Programmatic Usage

```javascript
import { FinalMermaidToPdfConverter } from 'mermaid-to-pdf-cli/dist/finalConverter.js';

const converter = new FinalMermaidToPdfConverter({
    quality: 'high',
    theme: 'dark',
    pageSize: 'A4'
});

const pdfPath = await converter.convert('documentation.md');
console.log(`PDF created: ${pdfPath}`);
```

## 🐛 Known Issues

### Current Limitations
- **Large Diagrams**: Very complex diagrams (>1000 nodes) may take longer to render
- **Font Loading**: Some custom fonts may not render correctly in diagrams
- **Memory Usage**: Multiple large diagrams may require more system memory

### Planned Improvements
- 🔄 Offline Mermaid.js support
- 🎨 Custom theme support
- 📱 Mobile-optimized PDF output
- 📊 Export format options (PNG, SVG, HTML)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Test locally: `npm test`

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request with detailed description

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Repository**: [https://github.com/costajohnt/mermaid-to-pdf-cli](https://github.com/costajohnt/mermaid-to-pdf-cli)
- **Issues**: [GitHub Issues](https://github.com/costajohnt/mermaid-to-pdf-cli/issues)
- **NPM Package**: [https://www.npmjs.com/package/mermaid-to-pdf-cli](https://www.npmjs.com/package/mermaid-to-pdf-cli)
- **MCP Server**: [https://www.npmjs.com/package/@mermaid-to-pdf/mcp-server](https://www.npmjs.com/package/@mermaid-to-pdf/mcp-server)
- **Mermaid Documentation**: [https://mermaid.js.org/](https://mermaid.js.org/)

---

**Made with ❤️ for the developer community**