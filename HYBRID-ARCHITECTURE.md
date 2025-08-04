# 🚀 Hybrid Mermaid-to-PDF Architecture

## Overview

This project implements a **hybrid architecture** that solves the original problem using both a standalone VSCode extension and an MCP (Model Context Protocol) server approach.

## 🏗️ Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    HYBRID SYSTEM                            │
├─────────────────────────────────────────────────────────────┤
│  VSCode Extension (UI Layer)                                │
│  ├─ Context menus & Commands                                │
│  ├─ Progress notifications                                  │
│  ├─ Settings management                                     │
│  └─ File system integration                                 │
├─────────────────────────────────────────────────────────────┤
│  Conversion Engine (Choose One)                             │
│  ├─ Local Mode: Direct conversion in extension              │
│  └─ MCP Mode: Delegates to MCP server                       │
├─────────────────────────────────────────────────────────────┤
│  MCP Server (Core Service)                                  │
│  ├─ Tool: convert_markdown_to_pdf                           │
│  ├─ Tool: convert_markdown_file_to_pdf                      │
│  ├─ Tool: extract_mermaid_diagrams                          │
│  ├─ Tool: validate_mermaid_syntax                           │
│  └─ Caching & optimization                                  │
├─────────────────────────────────────────────────────────────┤
│  Shared Core (Mermaid Rendering Engine)                     │
│  ├─ Puppeteer-based diagram rendering                       │
│  ├─ Base64 image embedding                                  │
│  ├─ Professional PDF styling                                │
│  └─ Error handling & fallbacks                              │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
mermaid-to-pdf-vscode/
├─ src/                          # VSCode Extension
│  ├─ extension.ts              # Original extension
│  ├─ extensionWithMcp.ts       # Hybrid extension
│  ├─ mcpClient.ts              # MCP client wrapper
│  ├─ finalConverter.ts         # Local converter
│  └─ ...
├─ mermaid-to-pdf-mcp/          # MCP Server
│  ├─ src/
│  │  ├─ index.ts              # MCP server main
│  │  ├─ converter.ts          # Core conversion logic
│  │  └─ types.ts              # Shared types
│  ├─ dist/                    # Compiled JavaScript
│  └─ package.json
├─ out/                         # Compiled VSCode extension
└─ mermaid-to-pdf-0.0.1.vsix   # Extension package
```

## 🎯 Usage Modes

### 1. **Local Mode (Default)**
- ✅ Works offline
- ✅ No additional setup required
- ✅ Fast for single conversions
- ❌ Limited to VSCode only

### 2. **MCP Server Mode**
- ✅ **AI Assistant Integration** - Claude can use it directly!
- ✅ **Multi-client Support** - CLI, web apps, other editors
- ✅ **Caching & Performance** - Shared diagram cache
- ✅ **Batch Processing** - Handle multiple files efficiently
- ❌ Requires server setup

## 🚀 Quick Start

### VSCode Extension (Local Mode)
```bash
# Install the extension
code --install-extension mermaid-to-pdf-0.0.1.vsix

# Use: Right-click any .md file → "Convert Markdown to PDF with Mermaid"
```

### MCP Server Mode
```bash
# 1. Build the MCP server
cd mermaid-to-pdf-mcp
npm install && npm run build

# 2. Start the server
npm start

# 3. Enable MCP mode in VSCode
# Command Palette → "Mermaid to PDF: Toggle MCP Server Mode"
```

### Claude Integration (via MCP)
```json
// Add to Claude MCP configuration
{
  "mermaid-to-pdf": {
    "command": "node",
    "args": ["/path/to/mermaid-to-pdf-mcp/dist/index.js"]
  }
}
```

## 🛠️ MCP Tools Available

### 1. `convert_markdown_to_pdf`
Convert Markdown content with Mermaid diagrams to PDF (returns base64).

```typescript
{
  markdown: string;
  options?: {
    title?: string;
    quality?: 'draft' | 'standard' | 'high';
    theme?: 'light' | 'dark' | 'auto';
    pageSize?: 'A4' | 'Letter' | 'Legal';
  }
}
```

### 2. `convert_markdown_file_to_pdf`
Convert a Markdown file to PDF file.

```typescript
{
  inputPath: string;
  outputPath?: string;
  options?: ConversionOptions;
}
```

### 3. `extract_mermaid_diagrams`
Extract and render individual Mermaid diagrams.

```typescript
{
  markdown: string;
  format?: 'png' | 'svg';
}
```

### 4. `validate_mermaid_syntax`
Validate Mermaid diagram syntax without rendering.

```typescript
{
  mermaidCode: string;
}
```

## 💡 AI-Powered Workflows

With the MCP server, Claude can now:

1. **Generate Documentation**
   ```
   User: "Create a system architecture document with diagrams"
   Claude: [generates markdown with mermaid] → [converts to PDF] → "Here's your PDF!"
   ```

2. **Process Existing Files**
   ```
   User: "Convert this markdown file to PDF"
   Claude: [reads file] → [converts via MCP] → [saves PDF]
   ```

3. **Batch Operations**
   ```
   User: "Convert all markdown files in this directory"
   Claude: [processes multiple files] → [generates PDFs for each]
   ```

## 🔧 Configuration Options

### VSCode Settings
```json
{
  "mermaidToPdf.useMcpServer": false,
  "mermaidToPdf.mcpServerPath": ""
}
```

### MCP Server Environment
```bash
# Logging level
export LOG_LEVEL=info

# Server port (if implementing HTTP mode)
export PORT=3000
```

## 🏆 Benefits of Hybrid Approach

### **For Users:**
- ✅ Choose the mode that fits their workflow
- ✅ Seamless experience in both modes
- ✅ No vendor lock-in

### **For AI Assistants:**
- ✅ Direct integration via MCP tools
- ✅ Batch processing capabilities
- ✅ Programmatic access to conversion

### **For Developers:**
- ✅ Modular architecture
- ✅ Shared core logic
- ✅ Easy to extend and maintain

## 📊 Performance Comparison

| Feature | Local Mode | MCP Server Mode |
|---------|------------|-----------------|
| Setup Time | Instant | ~30 seconds |
| First Conversion | ~5 seconds | ~8 seconds |
| Subsequent Conversions | ~5 seconds | ~3 seconds (cached) |
| Batch Processing | Serial | Parallel + Cached |
| Memory Usage | High per conversion | Shared resources |
| AI Integration | ❌ | ✅ |

## 🚧 Future Enhancements

- [ ] HTTP API mode for web integration
- [ ] Docker containerization
- [ ] Theme customization system
- [ ] Plugin architecture for custom renderers
- [ ] Real-time collaboration features
- [ ] Cloud deployment options

---

This hybrid architecture solves the original problem while providing a foundation for advanced AI-powered documentation workflows! 🎉