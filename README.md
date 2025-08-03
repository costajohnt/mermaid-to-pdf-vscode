# Mermaid to PDF - VSCode Extension

Convert Markdown files with Mermaid diagrams to beautiful PDFs with properly rendered diagram images.

![VSCode Marketplace](https://img.shields.io/badge/VSCode-Extension-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 📄 Convert Markdown files to PDF
- 🎨 Automatically render Mermaid diagrams as images
- 📊 Embed rendered diagrams directly in the PDF
- 🖱️ Right-click context menu integration
- 📁 Works with files in the explorer and active editor

## Usage

### Convert from Editor
1. Open a Markdown file containing Mermaid diagrams
2. Right-click in the editor
3. Select "Convert Markdown to PDF with Mermaid"

### Convert from Explorer
1. Right-click on a Markdown file in the Explorer
2. Select "Convert Markdown to PDF with Mermaid"

### Command Palette
1. Open Command Palette (Ctrl/Cmd + Shift + P)
2. Type "Convert Markdown to PDF with Mermaid"
3. Press Enter

## Example Markdown with Mermaid

```markdown
# Project Documentation

## Architecture Overview

```mermaid
graph TD
    A[Client] -->|Request| B[Load Balancer]
    B --> C[Web Server 1]
    B --> D[Web Server 2]
    C --> E[Database]
    D --> E
```

## Process Flow

```mermaid
sequenceDiagram
    participant User
    participant System
    participant Database
    
    User->>System: Login Request
    System->>Database: Verify Credentials
    Database-->>System: User Data
    System-->>User: Login Success
```
```

## Requirements

- VSCode 1.74.0 or higher
- Node.js installed on your system

## Installation

1. Install from VSCode Marketplace (coming soon)
2. Or install from VSIX file

## Known Issues

- Large Mermaid diagrams may take a few seconds to render
- Some complex Mermaid features might not render perfectly

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT