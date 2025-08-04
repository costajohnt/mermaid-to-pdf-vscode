# Test Document

This is a test document to verify the VSCode extension still works correctly.

## Simple Diagram

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> A
    C --> E[End]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant VSCode
    participant Extension
    
    User->>VSCode: Open .md file
    User->>Extension: Convert to PDF
    Extension->>Extension: Parse markdown
    Extension->>Extension: Render diagrams
    Extension-->>User: PDF generated!
```

## Conclusion

If you can convert this document to PDF successfully, everything is working correctly!