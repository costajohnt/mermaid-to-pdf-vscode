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

// Simple console logger
const logger = {
  info: (obj: any, msg?: string) => console.log(msg || JSON.stringify(obj)),
  error: (obj: any, msg?: string) => console.error(msg || JSON.stringify(obj)),
  warn: (obj: any, msg?: string) => console.warn(msg || JSON.stringify(obj)),
  debug: (obj: any, msg?: string) => console.debug(msg || JSON.stringify(obj))
};

// Initialize converter
const converter = new MermaidConverter(logger);

// Create MCP server
const server = new Server(
  {
    name: 'mermaid-to-pdf',
    version: '1.0.0',
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
              description: 'Page margins (default: 20mm all sides)'
            }
          }
        }
      },
      required: ['markdown']
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
          }
        }
      },
      required: ['inputPath']
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
      required: ['markdown']
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
      required: ['mermaidCode']
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