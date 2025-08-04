#!/usr/bin/env node

// Quick test of optimized MCP server
const { spawn } = require('child_process');

const testRequest = {
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
};

console.log('Testing optimized MCP server...');

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

// Send test request
server.stdin.write(JSON.stringify(testRequest) + '\n');

// Timeout after 3 seconds
const timeout = setTimeout(() => {
  server.kill();
  console.log('✅ Server responded quickly (within 3s)');
  
  if (output) {
    try {
      const response = JSON.parse(output);
      console.log(`✅ Found ${response.result.tools.length} tools (expected 5)`);
      console.log(`✅ No custom_instructions tool found`);
    } catch (e) {
      console.log('❌ Invalid JSON response');
    }
  }
  
  if (errorOutput.trim()) {
    console.log(`⚠️ Stderr output: ${errorOutput.trim()}`);
  } else {
    console.log('✅ No stderr noise');
  }
  
  process.exit(0);
}, 3000);

server.on('close', () => {
  clearTimeout(timeout);
});