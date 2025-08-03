// @ts-ignore
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
// @ts-ignore  
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import * as path from 'path';

export interface MermaidToPdfMcpClient {
  convertMarkdownToPdf(markdown: string, options?: any): Promise<{
    success: boolean;
    pdfBase64?: string;
    error?: string;
    metadata?: {
      pageCount: number;
      fileSize: number;
      diagramCount: number;
      processingTime: number;
    };
  }>;
  
  convertFileToFile(inputPath: string, outputPath?: string, options?: any): Promise<{
    success: boolean;
    outputPath?: string;
    error?: string;
    metadata?: any;
  }>;
  
  extractMermaidDiagrams(markdown: string, format?: 'png' | 'svg'): Promise<{
    success: boolean;
    diagrams?: Array<{
      index: number;
      code: string;
      imageBase64: string;
      format: string;
    }>;
    error?: string;
  }>;
  
  disconnect(): Promise<void>;
}

export async function createMcpClient(): Promise<MermaidToPdfMcpClient> {
  // Find the MCP server executable
  const serverPath = path.join(__dirname, '../../mermaid-to-pdf-mcp/dist/index.js');
  
  // Spawn the MCP server process
  const serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      LOG_LEVEL: 'warn' // Reduce server logging
    }
  });

  // Create transport
  const transport = new StdioClientTransport({
    child: serverProcess,
    command: 'node',
    args: [serverPath]
  });

  // Create client
  const client = new Client({
    name: 'mermaid-to-pdf-vscode',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  // Connect to server
  await client.connect(transport);

  // Return wrapped client with typed methods
  return {
    async convertMarkdownToPdf(markdown: string, options?: any) {
      try {
        const result = await client.callTool({
          name: 'convert_markdown_to_pdf',
          arguments: { markdown, options }
        });

        // Parse the response
        const response = JSON.parse(result.content[0].text);
        return response;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    },

    async convertFileToFile(inputPath: string, outputPath?: string, options?: any) {
      try {
        const result = await client.callTool({
          name: 'convert_markdown_file_to_pdf',
          arguments: { inputPath, outputPath, options }
        });

        const response = JSON.parse(result.content[0].text);
        return response;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    },

    async extractMermaidDiagrams(markdown: string, format: 'png' | 'svg' = 'png') {
      try {
        const result = await client.callTool({
          name: 'extract_mermaid_diagrams',
          arguments: { markdown, format }
        });

        const response = JSON.parse(result.content[0].text);
        return response;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    },

    async disconnect() {
      await client.disconnect();
      serverProcess.kill();
    }
  };
}