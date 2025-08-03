# @mermaid-converter/core

Core library for converting Markdown with Mermaid diagrams to various formats.

## Features

- **Plugin-based Architecture**: Extensible system for output formats and diagram types
- **Built-in PDF Generation**: High-quality PDF output with embedded diagrams
- **Mermaid Support**: Full support for Mermaid diagram rendering
- **Performance Optimized**: Browser pooling and intelligent caching
- **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install @mermaid-converter/core
```

## Quick Start

```typescript
import { createConverter, PDFGenerator, MermaidRenderer } from '@mermaid-converter/core';

// Create converter with built-in plugins
const converter = createConverter();
converter.registerGenerator(new PDFGenerator());
converter.registerRenderer(new MermaidRenderer());

// Convert markdown with diagrams to PDF
const result = await converter.convert({
  content: `
# My Document

Here's a diagram:

\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`
  `,
  format: 'pdf'
});

// Result contains the PDF buffer
console.log('Generated PDF:', result.data.length, 'bytes');
```

## API Reference

### Core Classes

#### `MarkdownMermaidConverter`

Main converter class that orchestrates the conversion process.

```typescript
const converter = new MarkdownMermaidConverter(config);

// Register plugins
converter.registerGenerator(new PDFGenerator());
converter.registerRenderer(new MermaidRenderer());

// Convert content
const result = await converter.convert({
  content: '# Test',
  format: 'pdf',
  options: { theme: 'dark' }
});
```

#### `MarkdownParser`

Parses markdown content and extracts diagrams.

```typescript
const parser = new MarkdownParser();
const parsed = await parser.parse(markdownContent);
```

#### `CacheManager`

Manages caching of rendered diagrams for performance.

```typescript
const cache = new CacheManager({
  enabled: true,
  maxSize: 100, // MB
  ttl: 3600 // seconds
});
```

### Built-in Plugins

#### PDF Generator

Generates high-quality PDF files with embedded diagrams.

```typescript
const pdfGenerator = new PDFGenerator();
converter.registerGenerator(pdfGenerator);

// Generate with options
const result = await converter.convert({
  content: markdown,
  format: 'pdf',
  options: {
    theme: 'dark',
    pageSize: 'A4',
    quality: 'high'
  }
});
```

#### Mermaid Renderer

Renders Mermaid diagrams to images.

```typescript
const mermaidRenderer = new MermaidRenderer();
converter.registerRenderer(mermaidRenderer);
```

## Configuration

```typescript
const config = {
  generators: new Map(),
  renderers: new Map(),
  cache: {
    enabled: true,
    maxSize: 100, // MB
    ttl: 3600,    // seconds
    directory: './cache'
  },
  performance: {
    maxConcurrency: 3
  }
};

const converter = new MarkdownMermaidConverter(config);
```

## Events

The converter emits events during processing:

```typescript
converter.onEvent((event) => {
  switch (event.type) {
    case 'start':
      console.log('Conversion started');
      break;
    case 'progress':
      console.log('Progress:', event.data.message);
      break;
    case 'diagram_rendered':
      console.log('Diagram rendered:', event.data.diagramId);
      break;
    case 'complete':
      console.log('Conversion complete');
      break;
    case 'error':
      console.error('Error:', event.data.error);
      break;
  }
});
```

## Creating Custom Plugins

### Custom Output Generator

```typescript
import { OutputGenerator } from '@mermaid-converter/core';

class CustomGenerator implements OutputGenerator {
  format = 'custom';
  name = 'Custom Generator';
  description = 'Custom output format';

  async generate(content, diagrams, options) {
    // Implement your custom generation logic
    return {
      format: 'custom',
      data: Buffer.from('custom output'),
      mimeType: 'application/custom'
    };
  }
}

converter.registerGenerator(new CustomGenerator());
```

### Custom Diagram Renderer

```typescript
import { DiagramRenderer } from '@mermaid-converter/core';

class CustomRenderer implements DiagramRenderer {
  supportedTypes = ['custom-diagram'];

  async render(diagram, options) {
    // Implement your custom rendering logic
    return {
      info: diagram,
      imageData: Buffer.from('image data'),
      format: 'png',
      dimensions: { width: 800, height: 600 },
      dataUrl: 'data:image/png;base64,...'
    };
  }

  async validate(code, type) {
    return { valid: true, errors: [], warnings: [] };
  }
}

converter.registerRenderer(new CustomRenderer());
```

## Requirements

- Node.js 16+
- Modern browser support (uses Puppeteer)

## License

MIT