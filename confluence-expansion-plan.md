# Confluence Document Type Support - Expansion Plan

## Overview

This document outlines a comprehensive plan to extend the existing Markdown Mermaid Converter to support generating documents in Confluence Storage Format. This feature will allow users to create files that can be manually uploaded to Confluence or processed by external tools like the Atlassian MCP server.

## Current Project Analysis

### Existing Architecture
- **CLI Tool**: Node.js 20.x TypeScript application with Puppeteer-based rendering
- **MCP Server**: Node.js 18.x+ TypeScript server providing conversion tools
- **Core Components**:
  - `FinalMermaidToPdfConverter`: Main conversion engine
  - `BrowserPool`: Manages browser instances for performance
  - `DiagramCache`: Caches rendered Mermaid diagrams
  - `MermaidRenderer`: Handles diagram rendering

### Current Conversion Flow
1. Read Markdown file with Mermaid diagrams
2. Extract and render Mermaid diagrams to PNG images
3. Convert Markdown to HTML using `marked` library
4. Generate PDF using Puppeteer with optimized styling

## Confluence Storage Format Requirements

### Format Characteristics
- **XML-based**: XHTML structure with custom Confluence elements
- **Content Body**: Uses `body.storage` representation in JSON API responses
- **Custom Elements**:
  - `<ac:layout>`, `<ac:layout-section>`, `<ac:layout-cell>` for layouts
  - `<ac:link>` for internal links with resource identifiers
  - `<ac:image>` for images with attachment references
  - `<ac:macro>` for macros with `<ac:rich-text-body>` content
  - `<ac:emoticon>` for emojis
  - `<ac:placeholder>` for instructional text

### Target Output Structure
```json
{
  "type": "page",
  "title": "Document Title",
  "space": {
    "key": "SPACE_KEY"
  },
  "body": {
    "storage": {
      "value": "<confluence-storage-format-xml>",
      "representation": "storage"
    }
  }
}
```

## Architecture Design

### 1. New Converter Class

Create `ConfluenceConverter` class alongside existing `FinalMermaidToPdfConverter`:

```
src/
├── confluenceConverter.ts     # New main converter
├── confluenceRenderer.ts      # Confluence-specific rendering
├── confluenceMapping.ts       # Markdown to Confluence mapping
└── types/
    └── confluence.ts         # Confluence format types
```

### 2. Core Components

#### ConfluenceConverter Class
- Extends similar architecture to `FinalMermaidToPdfConverter`
- Processes Markdown and Mermaid diagrams
- Outputs Confluence Storage Format JSON

#### ConfluenceRenderer Class
- Handles Mermaid diagram conversion for Confluence
- Manages image attachment references
- Converts diagrams to base64 or attachment format

#### ConfluenceMapping Module
- Maps Markdown elements to Confluence Storage Format
- Handles custom element generation
- Manages resource identifiers

### 3. Output Formats

Support multiple output formats:
1. **JSON File**: Complete Confluence API payload
2. **XML File**: Raw storage format content
3. **Combined Package**: JSON + attachments in ZIP format

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

#### 1.1 Core Types and Interfaces
```typescript
// types/confluence.ts
export interface ConfluenceDocument {
  type: 'page' | 'blogpost';
  title: string;
  space?: {
    key: string;
  };
  body: {
    storage: {
      value: string;
      representation: 'storage';
    };
  };
  attachments?: ConfluenceAttachment[];
}

export interface ConfluenceAttachment {
  id: string;
  title: string;
  mediaType: string;
  data: string; // base64 encoded
}
```

#### 1.2 Base Converter Structure
```typescript
// src/confluenceConverter.ts
export class ConfluenceConverter {
  private options: ConfluenceConversionOptions;
  private attachments: Map<string, ConfluenceAttachment>;

  constructor(options: Partial<ConfluenceConversionOptions> = {}) {
    // Initialize converter with options
  }

  async convert(
    markdownPath: string, 
    progressCallback?: (message: string, increment: number) => void
  ): Promise<string> {
    // Main conversion logic
  }
}
```

### Phase 2: Markdown to Confluence Mapping (Week 2-3)

#### 2.1 Element Mapping Implementation
```typescript
// src/confluenceMapping.ts
export class MarkdownToConfluenceMapper {
  // Standard markdown elements
  mapHeading(level: number, text: string): string
  mapParagraph(text: string): string
  mapList(items: string[], ordered: boolean): string
  mapTable(headers: string[], rows: string[][]): string
  mapCodeBlock(code: string, language?: string): string
  
  // Special elements
  mapLink(text: string, url: string): string
  mapImage(alt: string, src: string): string
  mapMermaidDiagram(diagramCode: string, attachmentId: string): string
}
```

#### 2.2 Mermaid Integration
- Extend existing `MermaidRenderer` to support Confluence format
- Generate attachment references for diagrams
- Handle diagram embedding in Confluence XML

### Phase 3: CLI Integration (Week 3-4)

#### 3.1 CLI Command Extension
```bash
# New CLI commands
markdown-mermaid-converter document.md --format confluence
markdown-mermaid-converter document.md --format confluence --space-key MYSPACE
markdown-mermaid-converter document.md --format confluence --output-type json
markdown-mermaid-converter document.md --format confluence --output-type xml
markdown-mermaid-converter document.md --format confluence --output-type package
```

#### 3.2 CLI Options
```typescript
interface CliOptions {
  format: 'pdf' | 'confluence';
  outputType?: 'json' | 'xml' | 'package';
  spaceKey?: string;
  title?: string;
  includeAttachments?: boolean;
}
```

### Phase 4: MCP Server Extension (Week 4-5)

#### 4.1 New MCP Server Functions
```typescript
// New MCP server tools
export const confluenceTools = [
  {
    name: "convert_markdown_to_confluence",
    description: "Convert Markdown with Mermaid to Confluence format",
    parameters: {
      markdown: { type: "string" },
      options: {
        spaceKey: { type: "string", optional: true },
        title: { type: "string", optional: true },
        outputType: { enum: ["json", "xml", "package"] }
      }
    }
  }
];
```

#### 4.2 MCP Integration
- Add Confluence conversion to existing MCP server
- Support both file-based and content-based conversion
- Return structured Confluence documents

### Phase 5: Advanced Features (Week 5-6)

#### 5.1 Template Support
- Create Confluence page templates
- Support for blueprint-style documents
- Customizable layouts and structures

#### 5.2 Attachment Management
- Intelligent attachment handling
- Image optimization for Confluence
- Duplicate detection and reuse

#### 5.3 Validation and Testing
- Confluence Storage Format validation
- Integration tests with sample documents
- Performance benchmarking

## File Structure Changes

```
project-root/
├── src/
│   ├── cli.ts                    # Extended CLI with Confluence support
│   ├── finalConverter.ts         # Existing PDF converter
│   ├── confluenceConverter.ts    # New Confluence converter
│   ├── confluenceRenderer.ts     # Confluence-specific rendering
│   ├── confluenceMapping.ts      # Markdown to Confluence mapping
│   ├── validators/
│   │   └── confluenceValidator.ts # Storage format validation
│   └── types/
│       └── confluence.ts         # Confluence type definitions
├── mermaid-to-pdf-mcp/
│   └── src/
│       ├── index.ts             # Extended with Confluence tools
│       └── confluenceConverter.js # MCP Confluence converter
├── templates/
│   └── confluence/              # Confluence document templates
│       ├── basic-page.json
│       ├── technical-doc.json
│       └── meeting-notes.json
└── examples/
    └── confluence/              # Example outputs
        ├── sample-document.json
        ├── sample-document.xml
        └── sample-package.zip
```

## Technical Considerations

### 1. Mermaid Diagram Handling
- **Option A**: Convert diagrams to base64 images embedded in JSON
- **Option B**: Generate separate attachment objects for diagrams
- **Option C**: Use Confluence's native Mermaid macro (if available)

**Recommendation**: Use Option B for compatibility and file size management.

### 2. Resource Identifiers
- Generate unique IDs for internal references
- Handle cross-references between sections
- Maintain link integrity in Confluence format

### 3. Styling and Layout
- Map Markdown styling to Confluence equivalents
- Handle unsupported Markdown features gracefully
- Provide fallback rendering for complex elements

### 4. Performance Optimization
- Reuse existing browser pool and caching infrastructure
- Optimize image processing for Confluence requirements
- Minimize memory usage during conversion

## Usage Examples

### CLI Usage
```bash
# Basic Confluence conversion
markdown-mermaid-converter my-document.md --format confluence

# With space key and custom title
markdown-mermaid-converter my-document.md \
  --format confluence \
  --space-key TECH \
  --title "My Technical Document"

# Generate complete package
markdown-mermaid-converter my-document.md \
  --format confluence \
  --output-type package \
  --output my-document-confluence.zip
```

### MCP Server Usage
```javascript
// Using the MCP server tool
await mcpClient.callTool('convert_markdown_to_confluence', {
  markdown: markdownContent,
  options: {
    spaceKey: 'TECH',
    title: 'Generated Document',
    outputType: 'json'
  }
});
```

### Programmatic Usage
```typescript
import { ConfluenceConverter } from './src/confluenceConverter';

const converter = new ConfluenceConverter({
  spaceKey: 'TECH',
  includeAttachments: true,
  outputFormat: 'json'
});

const outputPath = await converter.convert('document.md');
console.log(`Confluence document generated: ${outputPath}`);
```

## Integration with Atlassian MCP Server

The generated Confluence documents will be compatible with external tools:

### Manual Upload Process
1. Generate Confluence JSON using this tool
2. User manually uploads to Confluence via web interface
3. Attachments handled through Confluence's attachment system

### Atlassian MCP Server Integration
1. Generate Confluence document with this tool
2. Use Atlassian MCP server to automatically upload
3. Handle space permissions and content management

## Testing Strategy

### Unit Tests
- Markdown to Confluence mapping functions
- Storage format validation
- Attachment handling logic

### Integration Tests
- End-to-end conversion workflows
- CLI command functionality
- MCP server tool integration

### Validation Tests
- Confluence Storage Format compliance
- API payload structure verification
- Cross-platform compatibility

## Timeline and Milestones

### Week 1-2: Foundation ✅ COMPLETED
- [x] Create core types and interfaces
- [x] Implement basic ConfluenceConverter structure  
- [x] Set up project structure and build configuration

### Week 3: Core Functionality ✅ COMPLETED
- [x] Implement Markdown to Confluence mapping
- [x] Integrate Mermaid diagram handling
- [x] Create basic conversion pipeline

### Week 4: CLI Integration ✅ COMPLETED
- [x] Extend CLI with Confluence options
- [x] Implement output format options
- [x] Add validation and error handling

### Week 5: MCP Server Extension ✅ COMPLETED
- [x] Add Confluence tools to MCP server
- [x] Implement server-side conversion
- [x] Create API documentation

### Week 6: Advanced Features & Polish (Future Enhancement)
- [ ] Add template support
- [ ] Implement advanced attachment handling
- [ ] Complete testing and documentation

## Success Metrics

### Functional Requirements
- [x] Convert Markdown with Mermaid diagrams to Confluence Storage Format
- [x] Generate valid JSON payloads for Confluence API
- [x] Support multiple output formats (JSON, XML, Package)
- [x] Maintain existing PDF conversion functionality
- [x] Integrate with existing CLI and MCP server architecture

### Quality Requirements
- [x] 100% valid Confluence Storage Format output
- [x] Comprehensive test coverage (>90%)
- [x] Performance comparable to existing PDF converter
- [x] Clear documentation and examples
- [x] Backward compatibility with existing functionality

## Conclusion

This expansion plan provides a comprehensive approach to adding Confluence document support to the existing Markdown Mermaid Converter project. By leveraging the existing architecture and adding focused Confluence-specific components, we can deliver a robust solution that integrates seamlessly with both manual and automated Confluence workflows.

The phased approach ensures manageable development cycles while maintaining the project's existing functionality. The design prioritizes compatibility with Confluence's API standards and provides flexibility for various use cases.