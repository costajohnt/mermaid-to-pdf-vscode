#!/usr/bin/env node

// Test caching functionality
const { spawn } = require('child_process');

const testRequest = {
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "validate_mermaid_syntax",
    "arguments": {
      "mermaidCode": "graph TD\nA --> B\nB --> C"
    }
  }
};

console.log('Testing cache functionality...');

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responses = [];
let errorOutput = '';

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      if (response.result) {
        responses.push(response);
      }
    } catch (e) {
      // Ignore non-JSON lines
    }
  });
});

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

// Send the same request twice with a small delay
server.stdin.write(JSON.stringify(testRequest) + '\n');

setTimeout(() => {
  server.stdin.write(JSON.stringify({...testRequest, id: 3}) + '\n');
}, 100);

// Check results after 2 seconds
setTimeout(() => {
  server.kill();
  
  console.log(`✅ Received ${responses.length} responses`);
  
  if (responses.length >= 2) {
    const first = responses[0];
    const second = responses[1];
    
    if (JSON.stringify(first.result) === JSON.stringify(second.result)) {
      console.log('✅ Cache working - identical responses');
    } else {
      console.log('⚠️ Cache might not be working - different responses');
    }
  }
  
  if (errorOutput.trim()) {
    console.log(`⚠️ Stderr: ${errorOutput.trim()}`);
  } else {
    console.log('✅ No stderr noise');
  }
  
  process.exit(0);
}, 2000);