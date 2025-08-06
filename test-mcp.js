#!/usr/bin/env node

// Simple test script for MCP server Confluence conversion
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const testMarkdown = `# MCP Test Document

This is a test for MCP server Confluence conversion.

## Features
- **Bold text**
- *Italic text*
- \`Inline code\`

## Mermaid Diagram
\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`

## Code Block
\`\`\`javascript
console.log("Hello from MCP server!");
\`\`\`

That's all!`;

async function testMcpServer() {
  console.log('🧪 Testing MCP Server Confluence Conversion...');
  
  try {
    // Start the MCP server
    const mcpServer = spawn('node', ['mermaid-to-pdf-mcp/dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let serverOutput = '';
    let serverError = '';

    mcpServer.stdout.on('data', (data) => {
      serverOutput += data.toString();
    });

    mcpServer.stderr.on('data', (data) => {
      serverError += data.toString();
    });

    // Send MCP request
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'convert_markdown_to_confluence',
        arguments: {
          markdown: testMarkdown,
          options: {
            spaceKey: 'TEST',
            title: 'MCP Test Document',
            outputFormat: 'json',
            includeAttachments: true
          }
        }
      }
    };

    mcpServer.stdin.write(JSON.stringify(mcpRequest) + '\n');
    mcpServer.stdin.end();

    await new Promise((resolve) => {
      mcpServer.on('close', (code) => {
        console.log(`MCP Server exited with code: ${code}`);
        resolve();
      });
    });

    if (serverError) {
      console.error('❌ MCP Server Error:', serverError);
    }

    if (serverOutput) {
      console.log('✅ MCP Server Output:', serverOutput.substring(0, 500) + '...');
    }

    console.log('✅ MCP Server test completed');
  } catch (error) {
    console.error('❌ MCP Server test failed:', error);
  }
}

testMcpServer().catch(console.error);