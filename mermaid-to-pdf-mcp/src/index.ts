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
import { createHash } from 'crypto';
// Import simplified Confluence converter
import { SimplifiedConfluenceConverter } from './confluenceConverter.js';

// Silent logger - only log errors to avoid MCP noise
const logger = {
  info: () => {},
  error: (obj: any, msg?: string) => console.error(msg || (obj instanceof Error ? obj.message : String(obj))),
  warn: () => {},
  debug: () => {}
};

// Simple response cache (5 minute TTL)
const responseCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Operation timeouts
const OPERATION_TIMEOUTS = {
  validation: 10 * 1000,    // 10 seconds for syntax validation
  extraction: 30 * 1000,    // 30 seconds for diagram extraction
  conversion: 60 * 1000,    // 60 seconds for PDF conversion
};

// Timeout wrapper for operations
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// Progress tracking for long operations
class OperationProgress {
  private startTime = Date.now();
  
  constructor(private operation: string) {}
  
  getElapsed(): number {
    return Date.now() - this.startTime;
  }
  
  log(step: string): void {
    // Silent progress tracking - no actual logging to avoid noise
    // This could be expanded later for debugging if needed
  }
}

function getCacheKey(method: string, args: any): string {
  return createHash('sha256')
    .update(method)
    .update(JSON.stringify(args))
    .digest('hex').substring(0, 16);
}

function getCachedResponse(key: string): any | null {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  responseCache.delete(key);
  return null;
}

function setCachedResponse(key: string, data: any): void {
  responseCache.set(key, { data, timestamp: Date.now() });
  
  // Clean old entries
  if (responseCache.size > 100) {
    const cutoff = Date.now() - CACHE_TTL;
    for (const [k, v] of responseCache.entries()) {
      if (v.timestamp < cutoff) {
        responseCache.delete(k);
      }
    }
  }
}

// Initialize converter with enhanced resource management
const converter = new MermaidConverter(logger);

// Browser pool management
let isCleaningUp = false;
const BROWSER_IDLE_TIMEOUT = 30 * 1000; // 30 seconds
let browserIdleTimer: NodeJS.Timeout | null = null;

// Schedule browser cleanup after idle period
function scheduleBrowserCleanup() {
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
  }
  
  browserIdleTimer = setTimeout(async () => {
    if (!isCleaningUp) {
      isCleaningUp = true;
      try {
        await converter.cleanup();
      } catch (error) {
        logger.error(error, 'Browser cleanup failed');
      } finally {
        isCleaningUp = false;
      }
    }
  }, BROWSER_IDLE_TIMEOUT);
}

// Cancel browser cleanup if new operation starts
function cancelBrowserCleanup() {
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
    browserIdleTimer = null;
  }
}

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
            quality: { type: 'string', enum: ['draft', 'standard', 'high'] },
            theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
            pageSize: { type: 'string', enum: ['A4', 'Letter', 'Legal'] },
            margins: {
              type: 'object',
              properties: {
                top: { type: 'string' },
                right: { type: 'string' },
                bottom: { type: 'string' },
                left: { type: 'string' }
              }
            }
          }
        }
      },
      required: ['markdown']
    }
  },

  convertMarkdownToConfluence: {
    name: 'convert_markdown_to_confluence',
    description: 'Convert Markdown with Mermaid to Confluence Storage Format',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string' },
        options: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            spaceKey: { type: 'string' },
            outputPath: { type: 'string' },
            outputFormat: { type: 'string', enum: ['json', 'xml', 'package'] },
            includeAttachments: { type: 'boolean' },
            diagramFormat: { type: 'string', enum: ['base64', 'attachment'] }
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
            quality: { type: 'string', enum: ['draft', 'standard', 'high'] },
            theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
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
            quality: { type: 'string', enum: ['draft', 'standard', 'high'] },
            theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
            pageSize: { type: 'string', enum: ['A4', 'Letter', 'Legal'] }
          }
        }
      },
      required: ['inputPath']
    }
  },

  extractMermaidDiagrams: {
    name: 'extract_mermaid_diagrams',
    description: 'Extract Mermaid diagrams as images',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string' },
        format: { type: 'string', enum: ['png', 'svg'] }
      },
      required: ['markdown']
    }
  },

  validateMermaidSyntax: {
    name: 'validate_mermaid_syntax',
    description: 'Validate Mermaid syntax',
    inputSchema: {
      type: 'object',
      properties: {
        mermaidCode: { type: 'string' }
      },
      required: ['mermaidCode']
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

  // Check cache for non-file operations
  const cacheableOps = ['validate_mermaid_syntax', 'extract_mermaid_diagrams'];
  if (cacheableOps.includes(name)) {
    const cacheKey = getCacheKey(name, args);
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }
  }

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

        // Use the file-to-file converter to save directly to disk with timeout
        const progress = new OperationProgress('PDF conversion');
        progress.log('Starting conversion');
        
        cancelBrowserCleanup(); // Keep browser alive during operation
        
        const result = await withTimeout(
          converter.convertFileToFileFromContent(markdown, outputPath, options as ConversionOptions),
          OPERATION_TIMEOUTS.conversion,
          'PDF conversion'
        );
        
        progress.log(`Completed in ${progress.getElapsed()}ms`);
        scheduleBrowserCleanup(); // Schedule cleanup after idle period
        
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


        const result = await withTimeout(
          converter.convertMarkdownToPdf(markdown, options as ConversionOptions),
          OPERATION_TIMEOUTS.conversion,
          'PDF conversion'
        );
        
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

      case 'convert_markdown_to_confluence': {
        const { markdown, options = {} } = args as any;
        
        if (!markdown || typeof markdown !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'markdown parameter is required and must be a string'
          );
        }

        // Create simplified Confluence converter
        const confluenceConverter = new SimplifiedConfluenceConverter({
          spaceKey: options.spaceKey,
          title: options.title,
          outputFormat: options.outputFormat || 'json',
          includeAttachments: options.includeAttachments !== false,
          diagramFormat: options.diagramFormat || 'attachment'
        });

        const progress = new OperationProgress('Confluence conversion');
        progress.log('Starting conversion');
        
        // Convert using the simplified Confluence converter with access to the main converter for diagram rendering
        const result = await withTimeout(
          confluenceConverter.convertMarkdown(markdown, converter),
          OPERATION_TIMEOUTS.conversion,
          'Confluence conversion'
        );
        
        progress.log(`Completed in ${progress.getElapsed()}ms`);
        
        // Prepare output content
        const outputContent = JSON.stringify({
          document: result.document,
          attachments: result.attachments,
          warnings: result.warnings
        });

        return {
          content: [
            {
              type: 'text',
              text: outputContent
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

        const result = await withTimeout(
          converter.convertFileToFile(inputPath, outputPath, options as ConversionOptions),
          OPERATION_TIMEOUTS.conversion,
          'File conversion'
        );
        
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

      case 'extract_mermaid_diagrams': {
        const { markdown, format = 'png' } = args as any;
        
        if (!markdown || typeof markdown !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'markdown parameter is required and must be a string'
          );
        }

        cancelBrowserCleanup(); // Keep browser alive during operation
        
        const diagrams = await withTimeout(
          converter.extractMermaidDiagrams(markdown, format),
          OPERATION_TIMEOUTS.extraction,
          'Diagram extraction'
        );
        
        scheduleBrowserCleanup(); // Schedule cleanup after idle period
        
        const response = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: diagrams.length,
                diagrams: diagrams.map(d => ({
                  i: d.index,
                  img: d.imageBase64,
                  fmt: d.format
                }))
              })
            }
          ]
        };
        
        // Cache extraction results
        const cacheKey = getCacheKey(name, args);
        setCachedResponse(cacheKey, response);
        
        return response;
      }

      case 'validate_mermaid_syntax': {
        const { mermaidCode } = args as any;
        
        if (!mermaidCode || typeof mermaidCode !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'mermaidCode parameter is required and must be a string'
          );
        }

        cancelBrowserCleanup(); // Keep browser alive during operation
        
        const validation = await withTimeout(
          converter.validateMermaidSyntax(mermaidCode),
          OPERATION_TIMEOUTS.validation,
          'Syntax validation'
        );
        
        scheduleBrowserCleanup(); // Schedule cleanup after idle period
        
        const response = {
          content: [
            {
              type: 'text',
              text: JSON.stringify(validation)
            }
          ]
        };
        
        // Cache validation results
        const cacheKey = getCacheKey(name, args);
        setCachedResponse(cacheKey, response);
        
        return response;
      }


      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    // Ensure browser cleanup is scheduled even on errors
    scheduleBrowserCleanup();
    
    logger.error(error, `Tool ${name} failed`);
    
    if (error instanceof McpError) {
      throw error;
    }
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : String(error);
    let errorCode = ErrorCode.InternalError;
    let userMessage = `Tool execution failed: ${errorMessage}`;
    
    // Handle timeout errors specifically
    if (errorMessage.includes('timed out')) {
      errorCode = ErrorCode.InternalError;
      userMessage = `Operation timed out. This usually indicates the system is under heavy load or the operation is too complex. Please try again or simplify your request.`;
    }
    
    // Handle browser/Puppeteer errors
    if (errorMessage.includes('browser') || errorMessage.includes('page') || errorMessage.includes('Protocol error')) {
      userMessage = `Browser operation failed. This may be due to system resources or browser initialization issues. Please try again.`;
    }
    
    throw new McpError(errorCode, userMessage);
  }
});

// Cleanup on exit
async function cleanup() {
  isCleaningUp = true;
  
  // Cancel any pending browser cleanup timer
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
    browserIdleTimer = null;
  }
  
  try {
    await converter.cleanup();
  } catch (error) {
    logger.error(error, 'Final cleanup failed');
  }
  
  // Clear response cache
  responseCache.clear();
  
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