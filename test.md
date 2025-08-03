# Test Document

This is a test of the Mermaid to PDF extension.

## Flow Chart

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
```

## Simple Text

The diagram above should render as an image in the PDF.