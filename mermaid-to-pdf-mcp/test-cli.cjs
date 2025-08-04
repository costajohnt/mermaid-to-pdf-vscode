#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Simple test Markdown content
const testMarkdown = `# Test Document

This is a test document with a Mermaid diagram.

## Flow Chart

\`\`\`mermaid
graph TD
    A[Start] --> B{Test}
    B -->|Pass| C[Success]
    B -->|Fail| D[Debug]
    D --> B
    C --> E[End]
\`\`\`

## Conclusion

This is the end of the test document.
`;

async function testMcpServer() {
    console.log('🚀 Testing MCP Server...');
    
    // Start the MCP server
    const serverPath = path.join(__dirname, 'dist/index.js');
    const serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let responseData = '';
    
    serverProcess.stdout.on('data', (data) => {
        responseData += data.toString();
        console.log('Server output:', data.toString());
    });

    serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
    });

    // Send initialization message
    const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' }
        }
    };

    serverProcess.stdin.write(JSON.stringify(initMessage) + '\n');

    // Send list tools request
    setTimeout(() => {
        const listToolsMessage = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list'
        };
        serverProcess.stdin.write(JSON.stringify(listToolsMessage) + '\n');
    }, 1000);

    // Send conversion request
    setTimeout(() => {
        const convertMessage = {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'convert_markdown_to_pdf',
                arguments: {
                    markdown: testMarkdown,
                    options: {
                        quality: 'standard',
                        theme: 'light'
                    }
                }
            }
        };
        serverProcess.stdin.write(JSON.stringify(convertMessage) + '\n');
    }, 2000);

    // Cleanup after 10 seconds
    setTimeout(() => {
        console.log('🏁 Test complete, shutting down server...');
        serverProcess.kill();
    }, 10000);
}

testMcpServer().catch(console.error);