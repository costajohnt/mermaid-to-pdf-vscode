#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { MermaidConverter } from './converter.js';
import { ConversionOptions, ConversionResult } from './types.js';

// Simple console logger - all output goes to stderr to avoid breaking MCP JSON-RPC on stdout
const logger = {
  info: (obj: any, msg?: string) => console.error(msg || JSON.stringify(obj)),
  error: (obj: any, msg?: string) => console.error(msg || JSON.stringify(obj)),
  warn: (obj: any, msg?: string) => console.error(msg || JSON.stringify(obj)),
  debug: (obj: any, msg?: string) => console.error(msg || JSON.stringify(obj))
};

// Initialize converter
const converter = new MermaidConverter(logger);

// Create MCP server
const server = new Server(
  {
    name: 'mermaid-to-pdf',
    version: '1.0.7',
    description: 'MCP server for converting Markdown documents with Mermaid diagrams to professional PDFs',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const TOOLS = {
  convertMarkdownToPdf: {
    name: 'convert_markdown_to_pdf',
    description: 'Convert Markdown content with Mermaid diagrams to PDF. Returns base64 encoded PDF.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: {
          type: 'string',
          description: 'The Markdown content to convert'
        },
        options: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Document title (default: "Converted Document")'
            },
            quality: {
              type: 'string',
              enum: ['draft', 'standard', 'high'],
              description: 'PDF quality level (default: "standard")'
            },
            theme: {
              type: 'string',
              enum: ['light', 'dark', 'auto'],
              description: 'Theme for rendering (default: "light")'
            },
            pageSize: {
              type: 'string',
              enum: ['A4', 'Letter', 'Legal'],
              description: 'Page size (default: "A4")'
            },
            margins: {
              type: 'object',
              properties: {
                top: { type: 'string' },
                right: { type: 'string' },
                bottom: { type: 'string' },
                left: { type: 'string' }
              },
              additionalProperties: false,
              description: 'Page margins (default: 20mm all sides)'
            }
          },
          additionalProperties: false
        }
      },
      required: ['markdown'],
      additionalProperties: false
    }
  },
  
  convertMarkdownFileToFile: {
    name: 'convert_markdown_file_to_pdf',
    description: 'Convert a Markdown file to PDF file. Reads from input path and writes to output path.',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: {
          type: 'string',
          description: 'Path to the Markdown file to convert'
        },
        outputPath: {
          type: 'string',
          description: 'Path where the PDF should be saved (optional, defaults to same name with .pdf)'
        },
        options: {
          type: 'object',
          properties: {
            quality: {
              type: 'string',
              enum: ['draft', 'standard', 'high']
            },
            theme: {
              type: 'string',
              enum: ['light', 'dark', 'auto']
            },
            pageSize: {
              type: 'string',
              enum: ['A4', 'Letter', 'Legal']
            }
          },
          additionalProperties: false
        }
      },
      required: ['inputPath'],
      additionalProperties: false
    }
  },

  extractMermaidDiagrams: {
    name: 'extract_mermaid_diagrams',
    description: 'Extract all Mermaid diagrams from Markdown content and render them as images',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: {
          type: 'string',
          description: 'The Markdown content to extract diagrams from'
        },
        format: {
          type: 'string',
          enum: ['png', 'svg'],
          description: 'Output format for diagrams (default: "png")'
        }
      },
      required: ['markdown'],
      additionalProperties: false
    }
  },

  validateMermaidSyntax: {
    name: 'validate_mermaid_syntax',
    description: 'Validate Mermaid diagram syntax without rendering',
    inputSchema: {
      type: 'object',
      properties: {
        mermaidCode: {
          type: 'string',
          description: 'The Mermaid diagram code to validate'
        }
      },
      required: ['mermaidCode'],
      additionalProperties: false
    }
  },

  getCustomInstructions: {
    name: 'get_custom_instructions',
    description: 'Get custom instructions for LLMs on how to effectively use this MCP server for creating documentation with diagrams',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  }
};

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.values(TOOLS)
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    logger.info({ tool: name, args }, 'Processing tool request');

    switch (name) {
      case 'convert_markdown_to_pdf': {
        const { markdown, options = {} } = args as any;
        
        if (!markdown || typeof markdown !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'markdown parameter is required and must be a string'
          );
        }

        const result = await converter.convertMarkdownToPdf(markdown, options as ConversionOptions);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                pdfBase64: result.pdfBase64,
                metadata: result.metadata
              }, null, 2)
            }
          ]
        };
      }

      case 'convert_markdown_file_to_pdf': {
        const { inputPath, outputPath, options = {} } = args as any;
        
        if (!inputPath || typeof inputPath !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'inputPath parameter is required and must be a string'
          );
        }

        const result = await converter.convertFileToFile(inputPath, outputPath, options as ConversionOptions);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                outputPath: result.outputPath,
                metadata: result.metadata
              }, null, 2)
            }
          ]
        };
      }

      case 'extract_mermaid_diagrams': {
        const { markdown, format = 'png' } = args as any;
        
        if (!markdown || typeof markdown !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'markdown parameter is required and must be a string'
          );
        }

        const diagrams = await converter.extractMermaidDiagrams(markdown, format);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                diagrams: diagrams.map(d => ({
                  index: d.index,
                  code: d.code,
                  imageBase64: d.imageBase64,
                  format: d.format
                }))
              }, null, 2)
            }
          ]
        };
      }

      case 'validate_mermaid_syntax': {
        const { mermaidCode } = args as any;
        
        if (!mermaidCode || typeof mermaidCode !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'mermaidCode parameter is required and must be a string'
          );
        }

        const validation = await converter.validateMermaidSyntax(mermaidCode);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(validation, null, 2)
            }
          ]
        };
      }

      case 'get_custom_instructions': {
        const instructions = {
          role: 'mermaid-pdf-assistant',
          instructions: `# Custom Instructions for Mermaid to PDF MCP Server

## Overview
You are now connected to a Mermaid to PDF MCP server that can convert Markdown documents with Mermaid diagrams into professional PDFs. This is especially powerful for creating technical documentation, system designs, process flows, and any content that benefits from visual diagrams.

## When to Use This Server
**IMPORTANT**: When a user asks for documentation, reports, or any content that would benefit from diagrams and they want it as a PDF, follow this workflow:

1. **First, create the content in Markdown format** with appropriate Mermaid diagrams
2. **Then use the MCP server** to convert it to PDF

## Recommended Workflow for Document Creation

### Step 1: Create Rich Markdown Content
When users request documentation (especially technical docs, process flows, system designs, etc.), create comprehensive Markdown that includes:

- **Flowcharts** for processes and decision trees
- **Sequence diagrams** for system interactions  
- **Class diagrams** for software architecture
- **Entity relationship diagrams** for database designs
- **Gantt charts** for project timelines
- **State diagrams** for system states
- **Network diagrams** for infrastructure

### Step 2: Use Mermaid Diagrams Generously
Include relevant Mermaid diagrams throughout your content. Popular diagram types:

\`\`\`mermaid
flowchart TD
    A[User Request] --> B{Analysis}
    B --> |Technical| C[Create Technical Docs]
    B --> |Process| D[Create Process Flow]
    C --> E[Add Architecture Diagrams]
    D --> F[Add Process Diagrams]
    E --> G[Convert to PDF]
    F --> G
\`\`\`

### Step 3: Convert to Professional PDF
After creating the Markdown content, use the \`convert_markdown_to_pdf\` tool to generate a professional PDF.

## Best Practices

### Content Creation
- **Start with structure**: Use proper heading hierarchy (# ## ### ####)
- **Add context**: Include brief explanations before each diagram
- **Use consistent styling**: Maintain consistent formatting throughout
- **Include examples**: Add code snippets, examples, or sample data where relevant

### Diagram Selection Guide
- **Flowcharts**: Decision processes, workflows, algorithms
- **Sequence diagrams**: API interactions, user journeys, system communications
- **Class diagrams**: Software architecture, object relationships
- **ER diagrams**: Database schema, data relationships
- **Gantt charts**: Project timelines, milestones
- **Pie charts**: Data distribution, percentages
- **State diagrams**: System states, user interface flows

### PDF Options
- **Quality**: Use 'high' for final documents, 'standard' for drafts
- **Theme**: 'light' for professional docs, 'dark' for developer-focused content
- **Page size**: 'A4' for international, 'Letter' for US audiences

## Example Usage Scenarios

### Scenario 1: Technical Documentation
User: "Create documentation for our new API"
Your response: Create comprehensive Markdown with:
- API overview and architecture diagram
- Sequence diagrams for key endpoints
- Flowcharts for authentication process
- Code examples and responses
- Then convert to PDF

### Scenario 2: Process Documentation  
User: "Document our customer onboarding process"
Your response: Create Markdown with:
- Process flowchart from sign-up to activation
- Swimlane diagrams showing different team responsibilities
- State diagram for customer status transitions
- Then convert to PDF

### Scenario 3: System Design
User: "Help me design a microservices architecture"
Your response: Create Markdown with:
- System architecture diagrams
- Service interaction sequence diagrams
- Database ER diagrams
- Deployment flowcharts
- Then convert to PDF

## Tool Usage Patterns

1. **convert_markdown_to_pdf**: Main tool for creating final PDF documents
2. **validate_mermaid_syntax**: Use this first if you're unsure about diagram syntax
3. **extract_mermaid_diagrams**: Useful for getting individual diagram images
4. **convert_markdown_file_to_pdf**: When working with existing markdown files

## Quality Tips
- Always validate complex Mermaid syntax before conversion
- Use descriptive alt text and captions for diagrams
- Include a table of contents for longer documents
- Add page breaks with \`<div style="page-break-after: always;"></div>\` where needed
- Test with 'draft' quality first, then use 'high' for final version

Remember: The goal is to create professional, visual documentation that would be difficult to achieve with plain text alone. Diagrams should enhance understanding, not just decorate the content.`,
          examples: [
            {
              scenario: "User asks for API documentation",
              action: "Create Markdown with API flowcharts, sequence diagrams, and examples, then convert to PDF"
            },
            {
              scenario: "User wants system architecture design", 
              action: "Create Markdown with architecture diagrams, component interactions, and data flow, then convert to PDF"
            },
            {
              scenario: "User needs process documentation",
              action: "Create Markdown with process flowcharts, decision trees, and role assignments, then convert to PDF"
            }
          ]
        };
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(instructions, null, 2)
            }
          ]
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    logger.error({ error, tool: name }, 'Tool execution failed');
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Cleanup on exit
async function cleanup() {
  logger.info('Cleaning up...');
  await converter.cleanup();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Start the server
async function main() {
  logger.info('Starting Mermaid to PDF MCP server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  logger.info('MCP server is running');
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start server');
  process.exit(1);
});