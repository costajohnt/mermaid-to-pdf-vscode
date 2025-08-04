#!/usr/bin/env node

/**
 * Simplified MCP Server for Mermaid Converter
 * Basic version without complex configuration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { 
  createConverter,
  PDFGenerator,
  MermaidRenderer,
  BrowserPool
} from '@mermaid-converter/core';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';

// Initialize core components
const converter = createConverter();
const pdfGenerator = new PDFGenerator();
const mermaidRenderer = new MermaidRenderer();

// Register components
converter.registerGenerator(pdfGenerator);
converter.registerRenderer(mermaidRenderer);

// Simple templates
const TEMPLATES = {
  'pdf-report': {
    id: 'pdf-report',
    name: 'Professional Report',
    description: 'High-quality PDF report',
    format: 'pdf',
    options: {
      quality: 'high',
      theme: 'light',
      pageSize: 'A4',
      margins: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' },
      landscape: false
    }
  },
  'pdf-presentation': {
    id: 'pdf-presentation',
    name: 'Presentation Slides',
    description: 'Landscape PDF for presentations',
    format: 'pdf',
    options: {
      quality: 'high',
      theme: 'light',
      pageSize: 'A4',
      margins: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      landscape: true
    }
  },
  'documentation': {
    id: 'documentation',
    name: 'Technical Documentation',
    description: 'Standard technical documentation',
    format: 'pdf',
    options: {
      quality: 'standard',
      theme: 'light',
      pageSize: 'A4',
      margins: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      landscape: false
    }
  },
  'dark-theme': {
    id: 'dark-theme',
    name: 'Dark Theme Document',
    description: 'Dark theme for code and diagrams',
    format: 'pdf',
    options: {
      quality: 'standard',
      theme: 'dark',
      pageSize: 'A4',
      margins: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      landscape: false
    }
  }
};

// Create server
const server = new Server(
  {
    name: 'mermaid-converter',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'convertMarkdownToPdf',
        description: 'Convert markdown with Mermaid diagrams to PDF',
        inputSchema: {
          type: 'object',
          properties: {
            markdown: {
              type: 'string',
              description: 'Markdown content to convert'
            },
            options: {
              type: 'object',
              properties: {
                template: {
                  type: 'string',
                  description: 'Template to use (pdf-report, pdf-presentation, documentation, dark-theme)'
                },
                title: {
                  type: 'string',
                  description: 'Document title'
                }
              }
            }
          },
          required: ['markdown']
        }
      },
      {
        name: 'listTemplates',
        description: 'List available conversion templates',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'openPdf',
        description: 'Open a generated PDF file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'Name of the PDF file to open (from Downloads folder)'
            }
          },
          required: ['filename']
        }
      }
    ]
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'convertMarkdownToPdf': {
        const { markdown, options = {} } = args as any;
        
        if (!markdown || typeof markdown !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Markdown content is required');
        }

        // Get template
        const templateId = options.template || 'pdf-report';
        const template = TEMPLATES[templateId as keyof typeof TEMPLATES];
        
        if (!template) {
          throw new McpError(ErrorCode.InvalidParams, `Template '${templateId}' not found`);
        }

        // Convert
        const startTime = Date.now();
        const result = await converter.convert({
          content: markdown,
          format: 'pdf',
          options: {
            ...template.options,
            ...(options.title && { title: options.title })
          }
        });
        const processingTime = Date.now() - startTime;

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const title = (options.title || 'converted-document').replace(/[^a-zA-Z0-9-_]/g, '-');
        const filename = `${title}-${templateId}-${timestamp}.pdf`;
        
        // Save to Downloads folder
        const downloadsPath = path.join(os.homedir(), 'Downloads');
        const filePath = path.join(downloadsPath, filename);
        
        // Write PDF file
        fs.writeFileSync(filePath, result.data);

        return {
          content: [
            {
              type: 'text',
              text: `✅ PDF conversion completed successfully!

📄 File Details:
• Template: ${template.name}
• File: ${filename}
• Location: ${filePath}
• Size: ${(result.data.length / 1024).toFixed(1)} KB
• Processing time: ${processingTime}ms

🎉 Your PDF has been saved to the Downloads folder!`
            }
          ]
        };
      }

      case 'listTemplates': {
        const templateList = Object.values(TEMPLATES).map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          format: t.format
        }));

        return {
          content: [
            {
              type: 'text',
              text: `Available Templates:\n\n${templateList.map(t => 
                `• ${t.id}: ${t.name}\n  ${t.description}`
              ).join('\n\n')}`
            }
          ]
        };
      }

      case 'openPdf': {
        const { filename } = args as any;
        
        if (!filename || typeof filename !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Filename is required');
        }

        const downloadsPath = path.join(os.homedir(), 'Downloads');
        const filePath = path.join(downloadsPath, filename);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          throw new McpError(ErrorCode.InvalidParams, `PDF file '${filename}' not found in Downloads folder`);
        }

        // Open PDF file (macOS)
        return new Promise((resolve, reject) => {
          exec(`open "${filePath}"`, (error) => {
            if (error) {
              reject(new McpError(ErrorCode.InternalError, `Failed to open PDF: ${error.message}`));
            } else {
              resolve({
                content: [
                  {
                    type: 'text',
                    text: `✅ Opened PDF file: ${filename}\n\n📁 Location: ${filePath}`
                  }
                ]
              });
            }
          });
        });
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Tool '${name}' not found`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Simple startup message
  process.stderr.write('Enhanced MCP server is running\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`Server startup failed: ${error}\n`);
    process.exit(1);
  });
}