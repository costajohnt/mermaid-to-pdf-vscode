/**
 * Test PDF generation functionality
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const testMarkdown = `# Test PDF Generation

This is a test document to verify PDF generation works.

## Test Diagram

\`\`\`mermaid
graph LR
    A[Test] --> B[PDF Generation]
    B --> C[Success!]
\`\`\`

The diagram above should be rendered in the PDF output.
`;

async function testPdfGeneration() {
  console.log('🧪 Testing PDF Generation\n');
  
  const serverProcess = spawn('node', ['dist/simple-index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });
  
  let serverReady = false;
  let testComplete = false;
  
  return new Promise((resolve) => {
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('📡 Server:', output.trim());
      
      if (output.includes('Enhanced MCP server is running') && !serverReady) {
        serverReady = true;
        console.log('✅ Server started, testing PDF generation...\n');
        
        // Test PDF conversion
        const convertRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'convertMarkdownToPdf',
            arguments: {
              markdown: testMarkdown,
              options: {
                template: 'pdf-report',
                title: 'Test PDF Generation'
              }
            }
          }
        };
        
        console.log('📤 Sending conversion request...');
        serverProcess.stdin.write(JSON.stringify(convertRequest) + '\n');
      }
    });
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('📡 Response:', output.trim());
      
      try {
        const response = JSON.parse(output);
        if (response.result && response.result.content) {
          const message = response.result.content[0].text;
          console.log('\n📄 Conversion Result:');
          console.log(message);
          
          // Check if PDF was created
          const downloadsPath = path.join(os.homedir(), 'Downloads');
          const files = fs.readdirSync(downloadsPath).filter(f => 
            f.includes('Test-PDF-Generation') && f.endsWith('.pdf')
          );
          
          if (files.length > 0) {
            const newestFile = files[files.length - 1];
            const filePath = path.join(downloadsPath, newestFile);
            const stats = fs.statSync(filePath);
            
            console.log('\n🎉 PDF File Created Successfully!');
            console.log(`   📁 File: ${newestFile}`);
            console.log(`   📊 Size: ${(stats.size / 1024).toFixed(1)} KB`);
            console.log(`   📅 Created: ${stats.birthtime.toLocaleString()}`);
            
            testComplete = true;
            serverProcess.kill();
            resolve(true);
          } else {
            console.log('\n❌ No PDF file found in Downloads folder');
            testComplete = true;
            serverProcess.kill();
            resolve(false);
          }
        }
      } catch (e) {
        // Response might not be complete JSON yet
      }
    });
    
    serverProcess.on('close', (code) => {
      if (!testComplete) {
        console.log(`\n❌ Server exited unexpectedly with code ${code}`);
        resolve(false);
      }
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (!testComplete) {
        console.log('\n❌ Test timeout');
        serverProcess.kill();
        resolve(false);
      }
    }, 30000);
  });
}

if (require.main === module) {
  testPdfGeneration()
    .then(success => {
      if (success) {
        console.log('\n🎉 PDF generation test PASSED!');
        console.log('\n📋 Next steps:');
        console.log('   1. Restart Claude Desktop');
        console.log('   2. Try: "Convert test-manual-conversion.md to PDF"');
        console.log('   3. Check your Downloads folder for the PDF');
      } else {
        console.log('\n❌ PDF generation test FAILED');
        console.log('   The server may have issues with PDF creation');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test error:', error);
      process.exit(1);
    });
}