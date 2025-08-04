#!/usr/bin/env node

/**
 * Enhanced MCP Server for Mermaid Converter
 * 
 * Production-ready MCP server with advanced features:
 * - Batch processing
 * - Template system
 * - Caching and rate limiting
 * - Health monitoring
 * - Docker support
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import { 
  createConverter,
  PDFGenerator,
  MermaidRenderer,
  BrowserPool
} from 'mermaid-converter-core';

import { createDefaultConfig, validateConfig, logConfig } from './config.js';
import { createCacheService } from './services/cache.js';
import { BatchProcessor } from './services/batch.js';
import { TemplateService } from './services/templates.js';
import { 
  MCPToolResult,
  BatchConversionInput,
  ConversionTemplate,
  TemplateInput,
  HealthStatus
} from './types.js';

// Initialize logger
const loggerOptions: any = {
  level: process.env.LOG_LEVEL || 'info'
};

if (process.env.NODE_ENV !== 'production') {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard'
    }
  };
}

const logger = pino(loggerOptions);

// Load and validate configuration
const config = createDefaultConfig();
validateConfig(config);
logConfig(config, logger);

// Initialize services
const cache = createCacheService(config.cache);
const converter = createConverter();
const batchProcessor = new BatchProcessor(converter, cache, logger);
const templateService = new TemplateService(cache, logger);

// Register built-in plugins
converter.registerGenerator(new PDFGenerator());
converter.registerRenderer(new MermaidRenderer());

// Metrics tracking
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalProcessingTime: 0,
  startTime: Date.now()
};

// Create MCP server
const server = new Server(
  {
    name: '@mermaid-converter/mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Enhanced tool definitions
const TOOLS = {
  // Core conversion tools
  convertMarkdownToPdf: {
    name: 'convert_markdown_to_pdf',
    description: 'Convert Markdown content with Mermaid diagrams to PDF. Supports templates and caching.',
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
            title: { type: 'string', description: 'Document title' },
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
            },
            template: { type: 'string', description: 'Template ID to apply' }
          }
        }
      },
      required: ['markdown']
    }
  },

  // Batch processing
  convertMultipleFiles: {
    name: 'convert_multiple_files',
    description: 'Convert multiple Markdown files in batch with concurrency control and error handling.',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              format: { type: 'string' },
              metadata: {
                type: 'object',
                properties: {
                  filename: { type: 'string' },
                  title: { type: 'string' },
                  author: { type: 'string' }
                }
              },
              options: { type: 'object' }
            },
            required: ['content', 'format']
          }
        },
        options: {
          type: 'object',
          properties: {
            concurrency: { type: 'number', minimum: 1, maximum: 10 },
            continueOnError: { type: 'boolean' },
            outputFormat: { type: 'string' },
            template: { type: 'string' }
          }
        }
      },
      required: ['files']
    }
  },

  // Template management
  createTemplate: {
    name: 'create_template',
    description: 'Create a new conversion template with specific options and schema.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        format: { type: 'string' },
        options: { type: 'object' },
        schema: { type: 'object' }
      },
      required: ['name', 'description', 'format', 'options']
    }
  },

  listTemplates: {
    name: 'list_templates',
    description: 'List all available conversion templates including built-in and custom templates.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  getTemplate: {
    name: 'get_template',
    description: 'Get details of a specific template by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string' }
      },
      required: ['templateId']
    }
  },

  // Enhanced diagram tools
  extractAndEnhanceDiagrams: {
    name: 'extract_and_enhance_diagrams',
    description: 'Extract all diagrams from markdown and enhance them with metadata and validation.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string' },
        format: { type: 'string', enum: ['png', 'svg'], default: 'png' },
        enhance: { type: 'boolean', default: true }
      },
      required: ['markdown']
    }
  },

  validateAllDiagrams: {
    name: 'validate_all_diagrams',
    description: 'Validate all Mermaid diagrams in markdown content and provide detailed reports.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string' }
      },
      required: ['markdown']
    }
  },

  // System tools
  getHealthStatus: {
    name: 'get_health_status',
    description: 'Get comprehensive health status of the MCP server and its services.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  getCacheStats: {
    name: 'get_cache_stats',
    description: 'Get detailed caching statistics and performance metrics.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  clearCache: {
    name: 'clear_cache',
    description: 'Clear all cached data from the server.',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: { type: 'boolean' }
      },
      required: ['confirm']
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
  const startTime = Date.now();
  
  metrics.totalRequests++;
  
  try {
    logger.info({ tool: name, args: Object.keys(args || {}) }, 'Processing tool request');

    let result: MCPToolResult;

    switch (name) {
      case 'convert_markdown_to_pdf':
        result = await handleMarkdownToPdf(args as any);
        break;
        
      case 'convert_multiple_files':
        result = await handleBatchConversion(args as any);
        break;
        
      case 'create_template':
        result = await handleCreateTemplate(args as any);
        break;
        
      case 'list_templates':
        result = await handleListTemplates();
        break;
        
      case 'get_template':
        result = await handleGetTemplate(args as any);
        break;
        
      case 'extract_and_enhance_diagrams':
        result = await handleExtractDiagrams(args as any);
        break;
        
      case 'validate_all_diagrams':
        result = await handleValidateDiagrams(args as any);
        break;
        
      case 'get_health_status':
        result = await handleHealthStatus();
        break;
        
      case 'get_cache_stats':
        result = await handleCacheStats();
        break;
        
      case 'clear_cache':
        result = await handleClearCache(args as any);
        break;

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }

    const processingTime = Date.now() - startTime;
    metrics.successfulRequests++;
    metrics.totalProcessingTime += processingTime;
    
    // Add metadata to result
    result.metadata = {
      ...result.metadata,
      processingTime,
      version: '1.0.0'
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    metrics.failedRequests++;
    metrics.totalProcessingTime += processingTime;
    
    logger.error({ error, tool: name, processingTime }, 'Tool execution failed');
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Tool handlers
async function handleMarkdownToPdf(args: { markdown: string; options?: any }): Promise<MCPToolResult> {
  const { markdown, options = {} } = args;
  
  if (!markdown || typeof markdown !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'markdown parameter is required and must be a string');
  }

  // Apply template if specified
  let processedOptions = options;
  if (options.template) {
    const template = await templateService.getTemplate(options.template);
    if (template) {
      const templateOptions = await templateService.applyTemplate(template, markdown);
      processedOptions = { ...templateOptions, ...options };
      delete processedOptions.template; // Remove template ID from final options
    }
  }

  const result = await converter.convert({
    content: markdown,
    format: 'pdf',
    options: processedOptions,
    metadata: {
      title: options.title
    }
  });

  return {
    success: true,
    data: {
      pdfBase64: result.data.toString('base64'),
      metadata: result.metadata
    }
  };
}

async function handleBatchConversion(args: BatchConversionInput): Promise<MCPToolResult> {
  const validationErrors = await batchProcessor.validateBatchInput(args);
  if (validationErrors.length > 0) {
    throw new McpError(ErrorCode.InvalidParams, `Validation errors: ${validationErrors.join(', ')}`);
  }

  const result = await batchProcessor.processBatch(args);
  
  return {
    success: result.success,
    data: result
  };
}

async function handleCreateTemplate(args: TemplateInput): Promise<MCPToolResult> {
  const validationErrors = templateService.validateTemplate(args);
  if (validationErrors.length > 0) {
    throw new McpError(ErrorCode.InvalidParams, `Validation errors: ${validationErrors.join(', ')}`);
  }

  const template = await templateService.createTemplate(args);
  
  return {
    success: true,
    data: template
  };
}

async function handleListTemplates(): Promise<MCPToolResult> {
  const templates = await templateService.listTemplates();
  
  return {
    success: true,
    data: {
      templates,
      count: templates.length
    }
  };
}

async function handleGetTemplate(args: { templateId: string }): Promise<MCPToolResult> {
  const { templateId } = args;
  
  if (!templateId) {
    throw new McpError(ErrorCode.InvalidParams, 'templateId is required');
  }

  const template = await templateService.getTemplate(templateId);
  
  if (!template) {
    throw new McpError(ErrorCode.InvalidParams, `Template not found: ${templateId}`);
  }
  
  return {
    success: true,
    data: template
  };
}

async function handleExtractDiagrams(args: { markdown: string; format?: string; enhance?: boolean }): Promise<MCPToolResult> {
  const { markdown, format = 'png', enhance = true } = args;
  
  if (!markdown) {
    throw new McpError(ErrorCode.InvalidParams, 'markdown is required');
  }

  // Parse markdown to extract diagrams
  const parsed = await converter['parser'].parse(markdown);
  
  // Render diagrams if enhancement is requested
  const diagrams = enhance ? 
    await Promise.all(parsed.diagrams.map(async (diagram: any) => {
      const renderer = (converter as any).config.renderers.get(diagram.type);
      if (renderer) {
        const rendered = await renderer.render(diagram, { format: format as any });
        return {
          ...diagram,
          rendered: {
            imageBase64: rendered.dataUrl,
            format: rendered.format,
            dimensions: rendered.dimensions
          }
        };
      }
      return diagram;
    })) :
    parsed.diagrams;
  
  return {
    success: true,
    data: {
      diagrams,
      count: diagrams.length,
      enhanced: enhance
    }
  };
}

async function handleValidateDiagrams(args: { markdown: string }): Promise<MCPToolResult> {
  const { markdown } = args;
  
  if (!markdown) {
    throw new McpError(ErrorCode.InvalidParams, 'markdown is required');
  }

  const parsed = await (converter as any).parser.parse(markdown);
  const renderer = (converter as any).config.renderers.get('mermaid');
  
  if (!renderer) {
    throw new McpError(ErrorCode.InternalError, 'Mermaid renderer not available');
  }

  const validationResults = await Promise.all(
    parsed.diagrams.map(async (diagram: any) => {
      try {
        const validation = await renderer.validate(diagram.code, diagram.type);
        return {
          diagramId: diagram.id,
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings
        };
      } catch (error) {
        return {
          diagramId: diagram.id,
          valid: false,
          errors: [error instanceof Error ? error.message : String(error)],
          warnings: []
        };
      }
    })
  );

  const summary = {
    total: validationResults.length,
    valid: validationResults.filter(r => r.valid).length,
    invalid: validationResults.filter(r => !r.valid).length,
    hasWarnings: validationResults.some(r => r.warnings && r.warnings.length > 0)
  };
  
  return {
    success: true,
    data: {
      validations: validationResults,
      summary
    }
  };
}

async function handleHealthStatus(): Promise<MCPToolResult> {
  const uptime = Date.now() - metrics.startTime;
  const avgProcessingTime = metrics.totalRequests > 0 ? 
    metrics.totalProcessingTime / metrics.totalRequests : 0;
  const successRate = metrics.totalRequests > 0 ? 
    (metrics.successfulRequests / metrics.totalRequests) * 100 : 100;
  
  const cacheStats = cache.getStats();
  
  const health: HealthStatus = {
    status: successRate > 95 ? 'healthy' : successRate > 80 ? 'degraded' : 'unhealthy',
    version: '1.0.0',
    uptime,
    services: {
      converter: {
        status: 'healthy',
        lastCheck: new Date()
      },
      cache: {
        status: config.cache.enabled ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        message: config.cache.enabled ? `${cacheStats.hits + cacheStats.misses} requests` : 'disabled'
      },
      browser: {
        status: 'healthy',
        lastCheck: new Date(),
        message: 'Browser pool active'
      }
    },
    metrics: {
      totalConversions: metrics.totalRequests,
      successRate,
      averageProcessingTime: Math.round(avgProcessingTime),
      cacheHitRate: cacheStats.hitRate
    }
  };
  
  return {
    success: true,
    data: health
  };
}

async function handleCacheStats(): Promise<MCPToolResult> {
  const stats = cache.getStats();
  
  return {
    success: true,
    data: stats,
    metadata: {
      cacheHit: false // This request itself is not cached
    }
  };
}

async function handleClearCache(args: { confirm: boolean }): Promise<MCPToolResult> {
  const { confirm } = args;
  
  if (!confirm) {
    throw new McpError(ErrorCode.InvalidParams, 'confirm parameter must be true to clear cache');
  }

  await cache.clear();
  
  logger.info('Cache cleared by user request');
  
  return {
    success: true,
    data: {
      message: 'Cache cleared successfully'
    }
  };
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  try {
    // Clean up browser pool
    const browserPool = BrowserPool.getInstance();
    await browserPool.destroy();
    
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  
  try {
    const browserPool = BrowserPool.getInstance();
    await browserPool.destroy();
    
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
});

// Start the server
async function main() {
  logger.info('Starting Enhanced Mermaid Converter MCP Server...');
  
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info({
      version: '1.0.0',
      cacheEnabled: config.cache.enabled,
      rateLimitEnabled: config.rateLimit.enabled,
      authEnabled: config.auth?.enabled || false
    }, 'Enhanced MCP server is running');
    
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error({ error }, 'Unhandled error in main');
  process.exit(1);
});