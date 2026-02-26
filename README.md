[![CI](https://github.com/costajohnt/mermaid-to-pdf-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/costajohnt/mermaid-to-pdf-vscode/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/markdown-mermaid-converter-cli)](https://www.npmjs.com/package/markdown-mermaid-converter-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Markdown Mermaid Converter

Transform your ideas into professional documents with beautiful diagrams - just by asking for them. Convert Markdown with Mermaid diagrams to PDF.

![MCP Server](https://img.shields.io/badge/MCP-Server-purple)
![CLI Tool](https://img.shields.io/badge/CLI-Tool-blue)
![Node.js](https://img.shields.io/badge/node.js-18%2B-brightgreen)

## 🤖 For AI Users

**The magic way**: Just ask your AI to create PDF documents with diagrams. The AI will automatically write beautiful documentation and convert it to PDF for you.

### For Claude Desktop Users

1. **Install the MCP server:**
   ```bash
   npm install -g markdown-mermaid-converter-mcp
   ```

2. **Add to Claude Desktop config** (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "markdown-mermaid-converter": {
         "command": "markdown-mermaid-converter-mcp",
         "args": []
       }
     }
   }
   ```

3. **Restart Claude Desktop**

### For Claude Code Users

If you use Claude Code, you can configure the MCP server using Claude Code's built-in MCP management:

1. **Install the MCP server:**
   ```bash
   npm install -g markdown-mermaid-converter-mcp
   ```

2. **Add the MCP server to Claude Code:**

   **Option A: User scope (available across all projects):**
   ```bash
   claude mcp add --scope user markdown-mermaid-converter markdown-mermaid-converter-mcp
   ```

   **Option B: Project scope (for a specific project, creates `.mcp.json`):**
   ```bash
   # Navigate to your project directory first
   claude mcp add --scope project markdown-mermaid-converter markdown-mermaid-converter-mcp
   ```

   **Option C: Local scope (private to you in current project):**
   ```bash
   # Navigate to your project directory first  
   claude mcp add --scope local markdown-mermaid-converter markdown-mermaid-converter-mcp
   ```

3. **Verify the server is configured:**
   ```bash
   claude mcp list
   ```

**Alternative: Manual Configuration**

You can also create a `.mcp.json` file in your project root:
```json
{
  "mcpServers": {
    "markdown-mermaid-converter": {
      "command": "markdown-mermaid-converter-mcp",
      "args": []
    }
  }
}
```

### How to Use

Simply ask Claude to create PDF documents with visuals. Here are some examples:

**"Create a PDF document that explains how Twitter works with diagrams."**

**"Make a PDF guide for our new employee onboarding process with flowcharts."** 

**"Generate a PDF that documents our API architecture with sequence diagrams."**

**"Create a project timeline PDF with Gantt charts for the Q1 roadmap."**

The AI will automatically:
- Write comprehensive documentation in Markdown
- Add relevant Mermaid diagrams (flowcharts, sequences, ERDs, etc.)
- Convert everything to a professional PDF
- Return the PDF file to you

### What Makes This Special

- **No manual work**: Just describe what you want
- **Professional quality**: High-resolution diagrams, proper formatting
- **Multiple diagram types**: Flowcharts, sequence diagrams, database schemas, timelines
- **Instant results**: From idea to polished PDF in seconds
- **Smart AI guidance**: The AI knows best practices for visual documentation

---

## 🖥️ For Developers (Command Line)

**The direct way**: Convert your existing Markdown files with Mermaid diagrams to PDF.

### Installation

```bash
npm install -g markdown-mermaid-converter-cli
```

### Basic Usage

```bash
# Convert any markdown file to PDF
markdown-mermaid-converter your-document.md

# With custom options
markdown-mermaid-converter document.md -o output.pdf -t dark -p Letter

# JSON output for scripting
markdown-mermaid-converter document.md --json

# Read from stdin
cat document.md | markdown-mermaid-converter -o output.pdf
```

### CLI Options

```bash
Usage: markdown-mermaid-converter <input.md> [options]

Options:
  -o, --output <file>   Output PDF file path (default: <input>.pdf)
  -t, --theme <theme>   light | dark (default: light)
  -p, --page <size>     A4 | Letter | Legal (default: A4)
  --json                Output results as JSON to stdout
  -h, --help            Show this help message
```

### Programmatic Usage

You can use the converter as a library in your own Node.js / TypeScript projects:

```typescript
import { Converter } from 'markdown-mermaid-converter-cli';

const converter = new Converter({
  theme: 'light',       // 'light' | 'dark' (default: 'light')
  pageSize: 'A4',       // 'A4' | 'Letter' | 'Legal' (default: 'A4')
  margins: {            // All margins accept 'mm', 'cm', 'in', or 'px' units
    top: '15mm',
    right: '15mm',
    bottom: '15mm',
    left: '15mm',
  },
});

// Convert a markdown string to a PDF buffer
const { pdfBuffer, diagramCount, fileSize } = await converter.convertString(`
# My Document

\`\`\`mermaid
flowchart LR
  A[Start] --> B[End]
\`\`\`
`);

// Write the buffer to disk
import { writeFile } from 'fs/promises';
await writeFile('output.pdf', pdfBuffer);
console.log(`Generated PDF: ${fileSize} bytes, ${diagramCount} diagrams`);

// Or convert a file directly
const result = await converter.convertFile('input.md', 'output.pdf');
console.log(`Wrote ${result.fileSize} bytes with ${result.diagramCount} diagrams`);
```

#### Constructor Options

| Option     | Type     | Default  | Description                            |
|------------|----------|----------|----------------------------------------|
| `theme`    | `string` | `'light'`| Mermaid theme: `'light'` or `'dark'`   |
| `pageSize` | `string` | `'A4'`  | Page size: `'A4'`, `'Letter'`, `'Legal'`|
| `margins`  | `object` | `'15mm'` each | Top/right/bottom/left with unit (`mm`, `cm`, `in`, `px`) |

#### JSON Output Format

When using the `--json` flag, the CLI outputs a JSON object to stdout:

```json
{
  "outputPath": "/absolute/path/to/output.pdf",
  "fileSize": 52480,
  "diagramCount": 3,
  "processingTimeMs": 1842
}
```

On error, the JSON output contains an `error` field instead:

```json
{
  "error": "Markdown content too large. Maximum size is 10 MB."
}
```

---

## ✨ Features

### What You Get
- 📄 **Professional PDFs**: Clean typography and proper formatting
- 🎨 **Crisp Diagrams**: SVG-first rendering with measured layout
- ⚡ **Fast Performance**: Browser pooling and diagram caching
- 🔧 **Configurable**: Custom themes and page sizes
- 🛡️ **Reliable**: Comprehensive error handling and validation

### Supported Diagram Types
- **Flowcharts**: Process flows, decision trees, workflows
- **Sequence Diagrams**: API interactions, user journeys, system communications
- **Class Diagrams**: Software architecture, object relationships
- **ER Diagrams**: Database schemas, data relationships
- **Gantt Charts**: Project timelines, milestones, schedules
- **State Diagrams**: System states, user interface flows
- **Git Graphs**: Development workflows, branching strategies

---

## 🎯 Perfect For

### Business Users (with AI)
- **Project documentation** with timelines and process flows
- **System overviews** for stakeholders with architecture diagrams
- **Process documentation** with clear visual workflows
- **Training materials** with step-by-step diagrams

### Technical Teams (CLI or AI)
- **API documentation** with sequence diagrams and examples
- **System architecture** documentation with component diagrams
- **Database documentation** with ER diagrams and schemas
- **Development workflows** with git flow diagrams

### Content Creators
- **Technical tutorials** with explanatory diagrams
- **Product specifications** with user flow diagrams
- **Research reports** with data flow visualizations
- **Presentation materials** in PDF format

---

## 🚀 Examples

### With AI (Recommended)
Just ask Claude:

> "Create a PDF that explains our microservices architecture. Include a system overview diagram, database relationships, and API interaction flows."

Claude will create something like this automatically, then convert it to PDF:

```markdown
# Microservices Architecture Guide

## System Overview
Our platform uses a distributed microservices architecture...

```mermaid
flowchart TB
    subgraph "Frontend"
        Web[Web App]
        Mobile[Mobile App]
    end
    
    subgraph "Services"
        Gateway[API Gateway]
        Auth[Auth Service]
        Users[User Service]
        Orders[Order Service]
    end
    
    Web --> Gateway
    Mobile --> Gateway
    Gateway --> Auth
    Gateway --> Users
    Gateway --> Orders
```

## Database Design
The system uses separate databases for each service...

```mermaid
erDiagram
    User ||--o{ Order : places
    User {
        int id
        string email
        string name
    }
    Order {
        int id
        int user_id
        decimal amount
        string status
    }
```
```

### With CLI
Create `architecture.md` with your content, then:
```bash
markdown-mermaid-converter architecture.md -o architecture.pdf -t light
```

---

## 🔧 Requirements

- **Node.js**: 18.x or higher
- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **Memory**: 2GB RAM minimum (4GB recommended)

---

## 🔗 Links

- **Repository**: [https://github.com/costajohnt/markdown-mermaid-converter](https://github.com/costajohnt/markdown-mermaid-converter)
- **Issues**: [GitHub Issues](https://github.com/costajohnt/markdown-mermaid-converter/issues)
- **CLI Package**: [markdown-mermaid-converter-cli](https://www.npmjs.com/package/markdown-mermaid-converter-cli)
- **MCP Package**: [markdown-mermaid-converter-mcp](https://www.npmjs.com/package/markdown-mermaid-converter-mcp)
- **Mermaid Documentation**: [https://mermaid.js.org/](https://mermaid.js.org/)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.