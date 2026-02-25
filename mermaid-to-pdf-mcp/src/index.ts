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
import { ConversionOptions } from './types.js';

// Silent logger - only log errors to avoid MCP noise
const logger = {
  info: () => {},
  error: (obj: any, msg?: string) => console.error(msg || (obj instanceof Error ? obj.message : String(obj))),
  warn: (obj: any, msg?: string) => console.error(`[warn] ${msg || (obj instanceof Error ? obj.message : String(obj))}`),
  debug: () => {}
};

// Initialize converter (thin CLI wrapper)
const converter = new MermaidConverter(logger);

// Create MCP server
const server = new Server(
  {
    name: 'markdown-mermaid-converter',
    version: '1.0.0',
    description: 'MCP server for converting Markdown with Mermaid diagrams to various formats - optimized for AI integration',
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
    description: 'Convert Markdown with Mermaid to PDF file',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string' },
        options: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            outputPath: { type: 'string' },
            theme: { type: 'string', enum: ['light', 'dark'] },
            pageSize: { type: 'string', enum: ['A4', 'Letter', 'Legal'] },
          }
        }
      },
      required: ['markdown']
    }
  },

  convertMarkdownToPdfData: {
    name: 'convert_markdown_to_pdf_data',
    description: 'Convert small Markdown to PDF base64 (short docs only)',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string' },
        options: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            theme: { type: 'string', enum: ['light', 'dark'] },
            pageSize: { type: 'string', enum: ['A4', 'Letter', 'Legal'] }
          }
        }
      },
      required: ['markdown']
    }
  },

  convertMarkdownFileToFile: {
    name: 'convert_markdown_file_to_pdf',
    description: 'Convert MD file to PDF file',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string' },
        outputPath: { type: 'string' },
        options: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: ['light', 'dark'] },
            pageSize: { type: 'string', enum: ['A4', 'Letter', 'Legal'] }
          }
        }
      },
      required: ['inputPath']
    }
  },
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
    switch (name) {
      case 'convert_markdown_to_pdf': {
        const { markdown, options = {} } = args as any;

        if (!markdown || typeof markdown !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'markdown parameter is required and must be a string'
          );
        }

        // Generate a default output path if not provided
        const title = options.title || 'Document';
        const safeTitle = title.replace(/[^a-zA-Z0-9\-_]/g, '_');
        const defaultPath = `${process.env.HOME}/Desktop/${safeTitle}.pdf`;
        const outputPath = options.outputPath || defaultPath;

        const result = await converter.convertFileToFileFromContent(markdown, outputPath, options as ConversionOptions);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                path: result.outputPath,
                size: result.metadata.fileSize,
                diagrams: result.metadata.diagramCount
              })
            }
          ]
        };
      }

      case 'convert_markdown_to_pdf_data': {
        const { markdown, options = {} } = args as any;

        if (!markdown || typeof markdown !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'markdown parameter is required and must be a string'
          );
        }

        const result = await converter.convertMarkdownToPdf(markdown, options as ConversionOptions);

        const response: any = {
          pdf: result.pdfBase64,
          size: result.metadata.fileSize,
          diagrams: result.metadata.diagramCount
        };

        if (markdown.length > 10000) {
          response.warn = 'Large content - use convert_markdown_to_pdf instead';
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response)
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
                path: result.outputPath,
                size: result.metadata.fileSize,
                diagrams: result.metadata.diagramCount
              })
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
    logger.error(error, `Tool ${name} failed`);

    if (error instanceof McpError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
  }
});

// Cleanup on exit
async function cleanup() {
  try {
    await converter.cleanup();
  } catch (error) {
    logger.error(error, 'Final cleanup failed');
  }

  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error(error, 'Failed to start server');
  process.exit(1);
});
