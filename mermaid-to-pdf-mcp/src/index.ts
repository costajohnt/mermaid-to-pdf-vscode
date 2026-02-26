#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { MermaidConverter, type Logger } from './converter.js';
import { homedir } from 'os';
import path from 'path';
import { validateOptions, validatePath } from './validation.js';

/**
 * Sanitize error messages before returning them to MCP clients.
 * Replaces absolute file paths with just the filename to avoid
 * leaking server-side directory structure.
 */
function sanitizeErrorMessage(message: string): string {
  // Match absolute paths: Unix (/...) and Windows (C:\...)
  // Captures sequences starting with / or drive letter that contain
  // path separators and end at a word boundary or whitespace.
  return message.replace(
    /(?:[A-Za-z]:\\|\/)[^\s:,"']+/g,
    (match) => {
      // Extract the basename (last path component)
      const basename = match.split(/[/\\]/).filter(Boolean).pop();
      return basename || '<path>';
    },
  );
}

// Re-export validation functions and sanitizeErrorMessage for backward compatibility and testing
export { validateOptions, validatePath, sanitizeErrorMessage };

// Silent logger — only log errors/warnings to stderr to avoid MCP protocol noise.
// Enable debug/info with MCP_DEBUG=1.
const DEBUG = !!process.env.MCP_DEBUG;
const logger: Logger = {
  info: DEBUG ? (_obj: unknown, msg?: string) => console.error(`[info] ${msg || String(_obj)}`) : () => {},
  error: (obj: unknown, msg?: string) => {
    const detail = obj instanceof Error ? obj.message : String(obj);
    console.error(msg ? `${msg}: ${detail}` : detail);
  },
  warn: (obj: unknown, msg?: string) => {
    const detail = obj instanceof Error ? obj.message : String(obj);
    console.error(msg ? `[warn] ${msg}: ${detail}` : `[warn] ${detail}`);
  },
  debug: DEBUG ? (_obj: unknown, msg?: string) => console.error(`[debug] ${msg || String(_obj)}`) : () => {},
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
        const { markdown, options: rawOpts = {} } = args as any;

        if (!markdown || typeof markdown !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'markdown parameter is required and must be a string'
          );
        }

        if (rawOpts.outputPath !== null && rawOpts.outputPath !== undefined && typeof rawOpts.outputPath !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'outputPath must be a string when provided'
          );
        }

        const validatedOpts = validateOptions(rawOpts);

        // Generate a default output path if not provided
        const title = rawOpts.title || 'Document';
        const safeTitle = title.replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 200);
        const defaultPath = path.join(homedir(), 'Desktop', `${safeTitle}.pdf`);
        const outputPath = rawOpts.outputPath
          ? validatePath(rawOpts.outputPath, 'outputPath')
          : validatePath(defaultPath, 'outputPath');

        const result = await converter.convertFileToFileFromContent(markdown, outputPath, validatedOpts);

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
        const { markdown, options: rawOpts = {} } = args as any;

        if (!markdown || typeof markdown !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'markdown parameter is required and must be a string'
          );
        }

        const validatedOpts = validateOptions(rawOpts);
        const result = await converter.convertMarkdownToPdf(markdown, validatedOpts);

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
        const { inputPath, outputPath, options: rawOpts = {} } = args as any;

        if (!inputPath || typeof inputPath !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'inputPath parameter is required and must be a string'
          );
        }

        if (outputPath !== null && outputPath !== undefined && typeof outputPath !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'outputPath must be a string when provided'
          );
        }

        const validatedInputPath = validatePath(inputPath, 'inputPath');
        const validatedOutputPath = outputPath !== null && outputPath !== undefined
          ? validatePath(outputPath, 'outputPath')
          : undefined;

        const validatedOpts = validateOptions(rawOpts);
        const result = await converter.convertFileToFile(validatedInputPath, validatedOutputPath, validatedOpts);

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
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${sanitizeErrorMessage(errorMessage)}`);
  }
});

// Cleanup on signal (do NOT register on 'exit' -- async work cannot complete in that handler)
let isCleaningUp = false;

async function cleanup() {
  if (isCleaningUp) { return; }
  isCleaningUp = true;
  try {
    await converter.cleanup();
  } catch (error) {
    logger.error(error, 'Final cleanup failed');
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error(error, 'Failed to start server');
  process.exit(1);
});
