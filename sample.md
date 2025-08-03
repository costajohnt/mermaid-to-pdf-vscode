# Sample Document with Mermaid Diagrams

This document demonstrates the conversion of Markdown with Mermaid diagrams to PDF.

## Flow Chart Example

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]  
```

## Sequence Diagram Example

```mermaid
sequenceDiagram
    participant User
    participant VSCode
    participant Extension
    participant Puppeteer
    
    User->>VSCode: Right-click on .md file
    VSCode->>Extension: Execute command
    Extension->>Extension: Parse Markdown
    Extension->>Puppeteer: Render Mermaid diagramss
    Puppeteer-->>Extension: Return images
    Extension->>Puppeteer: Convert to PDF
    Puppeteer-->>Extension: PDF created
    Extension-->>User: Show success message
```

## Class Diagram Example

```mermaid
classDiagram
    class MermaidToPdfConverter {
        +convert(markdownPath) Promise
        +processMermaidDiagrams(content) Promise
        +markdownToHtml(markdown) string
        +htmlToPdf(html) Promise
    }
    
    class Extension {
        +activate(context) void
        +deactivate() void
    }
    
    Extension --> MermaidToPdfConverter
```

## Regular Markdown Content

This extension also handles regular Markdown content:

- **Bold text**
- *Italic text*
- `Code snippets`

### Code Block Example

```javascript
function hello() {
    console.log("Hello, World!");
}
```

### Table Example

| Feature | Status |
|---------|--------|
| Markdown to HTML | ✅ |
| Mermaid to Image | ✅ |
| HTML to PDF | ✅ |
| VSCode Integration | ✅ |

## Conclusion

This demonstrates how the extension converts Markdown files with embedded Mermaid diagrams into PDFs with the diagrams rendered as images.