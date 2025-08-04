import { spawn } from 'child_process';
import { readFileSync } from 'fs';

// Test the MCP server directly
const serverProcess = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';

serverProcess.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('Non-JSON output:', line);
      }
    }
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('Server log:', data.toString());
});

// Send initialization
const init = {
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '0.1.0',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0'
    }
  },
  id: 1
};

serverProcess.stdin.write(JSON.stringify(init) + '\n');

// After initialization, test conversion
setTimeout(() => {
  const testContent = readFileSync('test-dynamic-sizing.md', 'utf-8');
  const convertRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'convert_markdown_to_pdf',
      arguments: {
        markdown: testContent,
        options: {
          title: 'Dynamic Sizing Test',
          outputPath: '/tmp/test-dynamic-mcp.pdf'
        }
      }
    },
    id: 2
  };
  
  serverProcess.stdin.write(JSON.stringify(convertRequest) + '\n');
}, 1000);

// Close after testing
setTimeout(() => {
  serverProcess.kill();
  process.exit(0);
}, 30000);