# Complex Test Document

This document tests various features of the CLI tool.

## Multiple Diagrams

### Flowchart
```mermaid
flowchart TD
    A[Start CLI Test] --> B{Parse Arguments}
    B -->|Valid| C[Initialize Converter]
    B -->|Invalid| D[Show Help]
    C --> E[Process Markdown]
    E --> F{Contains Mermaid?}
    F -->|Yes| G[Render Diagrams]
    F -->|No| H[Skip Diagrams]
    G --> I[Generate PDF]
    H --> I
    I --> J[Success\!]
    D --> K[Exit]
```

### Sequence Diagram
```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Converter
    participant Puppeteer
    
    User->>CLI: mermaid-to-pdf file.md
    CLI->>Converter: process(file.md)
    Converter->>Puppeteer: launch browser
    Puppeteer-->>Converter: browser ready
    Converter->>Puppeteer: render diagrams
    Puppeteer-->>Converter: diagram images
    Converter->>Puppeteer: generate PDF
    Puppeteer-->>Converter: PDF data
    Converter-->>CLI: PDF created
    CLI-->>User: Success message
```

### Class Diagram
```mermaid
classDiagram
    class CLITool {
        +parseArgs()
        +showHelp()
        +main()
    }
    
    class MermaidConverter {
        +convert(markdown)
        +processImages()
        +generatePDF()
    }
    
    class BrowserPool {
        +getInstance()
        +getBrowser()
        +cleanup()
    }
    
    CLITool --> MermaidConverter
    MermaidConverter --> BrowserPool
```

## Code Examples

### TypeScript
```typescript
interface ConversionOptions {
    quality: 'draft' | 'standard' | 'high';
    theme: 'light' | 'dark';
    pageSize: 'A4' | 'Letter' | 'Legal';
}

class MermaidToPdfCli {
    async convert(file: string, options: ConversionOptions): Promise<string> {
        console.log(`Converting ${file}...`);
        return 'success';
    }
}
```

### JavaScript
```javascript
function testCLI() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('Please provide a markdown file');
        return;
    }
    
    console.log(`Processing: ${args[0]}`);
}
```

## Features Tested

| Feature | Status | Notes |
|---------|--------|-------|
| Basic Markdown | ✅ | Headers, text, lists |
| Code Blocks | ✅ | Syntax highlighting |
| Mermaid Diagrams | ✅ | Multiple diagram types |
| Custom Output | ✅ | -o flag working |
| Theme Support | ✅ | -t flag working |
| Quality Settings | ✅ | -q flag working |

## Summary

This CLI tool successfully:
- Parses markdown files
- Renders Mermaid diagrams
- Generates high-quality PDFs
- Supports customization options
- Provides progress feedback

**CLI is production ready\! 🎉**
EOF < /dev/null