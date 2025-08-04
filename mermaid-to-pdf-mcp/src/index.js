#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const converter_js_1 = require("./converter.js");
// Simple console logger
const logger = {
    info: (obj, msg) => console.log(msg || JSON.stringify(obj)),
    error: (obj, msg) => console.error(msg || JSON.stringify(obj)),
    warn: (obj, msg) => console.warn(msg || JSON.stringify(obj)),
    debug: (obj, msg) => console.debug(msg || JSON.stringify(obj))
};
// Initialize converter
const converter = new converter_js_1.MermaidConverter(logger);
// Create MCP server
const server = new index_js_1.Server({
    name: 'mermaid-to-pdf',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
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
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: Object.values(TOOLS)
    };
});
// Handle tool calls
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        logger.info({ tool: name, args }, 'Processing tool request');
        switch (name) {
            case 'convert_markdown_to_pdf': {
                const { markdown, options = {} } = args;
                if (!markdown || typeof markdown !== 'string') {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, 'markdown parameter is required and must be a string');
                }
                const result = await converter.convertMarkdownToPdf(markdown, options);
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
                const { inputPath, outputPath, options = {} } = args;
                if (!inputPath || typeof inputPath !== 'string') {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, 'inputPath parameter is required and must be a string');
                }
                const result = await converter.convertFileToFile(inputPath, outputPath, options);
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
                const { markdown, format = 'png' } = args;
                if (!markdown || typeof markdown !== 'string') {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, 'markdown parameter is required and must be a string');
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
                const { mermaidCode } = args;
                if (!mermaidCode || typeof mermaidCode !== 'string') {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, 'mermaidCode parameter is required and must be a string');
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
                throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
    }
    catch (error) {
        logger.error({ error, tool: name }, 'Tool execution failed');
        if (error instanceof types_js_1.McpError) {
            throw error;
        }
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
});
// Start the server
async function main() {
    logger.info('Starting Mermaid to PDF MCP server...');
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    logger.info('MCP server is running');
}
main().catch((error) => {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
});
//# sourceMappingURL=index.js.map