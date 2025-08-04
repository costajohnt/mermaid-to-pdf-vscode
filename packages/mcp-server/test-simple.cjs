/**
 * Test the simplified MCP server
 */

const { spawn } = require('child_process');

async function testSimpleServer() {
  console.log('🧪 Testing Simplified MCP Server\n');
  
  const serverProcess = spawn('node', ['dist/simple-index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });
  
  let hasStarted = false;
  
  return new Promise((resolve) => {
    serverProcess.stdout.on('data', (data) => {
      console.log('📡 Server output:', data.toString().trim());
    });
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('📡 Server stderr:', output.trim());
      
      if (output.includes('Enhanced MCP server is running')) {
        hasStarted = true;
        console.log('✅ Simplified server started successfully!');
        
        // Test basic MCP protocol
        const listToolsRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        };
        
        console.log('📤 Sending tools/list request...');
        serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
        
        setTimeout(() => {
          serverProcess.kill();
          resolve(true);
        }, 2000);
      }
    });
    
    serverProcess.on('close', (code) => {
      if (!hasStarted) {
        console.log(`❌ Server exited with code ${code}`);
        resolve(false);
      }
    });
    
    setTimeout(() => {
      if (!hasStarted) {
        console.log('❌ Server startup timeout');
        serverProcess.kill();
        resolve(false);
      }
    }, 10000);
  });
}

if (require.main === module) {
  testSimpleServer()
    .then(success => {
      if (success) {
        console.log('\n🎉 Simplified MCP server is working!');
        console.log('\n📋 Next steps:');
        console.log('   1. Restart Claude Desktop');
        console.log('   2. Try: "List available templates from mermaid-converter"');
        console.log('   3. Convert test-manual-conversion.md to PDF');
      } else {
        console.log('\n❌ Simplified server test failed');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test error:', error);
      process.exit(1);
    });
}