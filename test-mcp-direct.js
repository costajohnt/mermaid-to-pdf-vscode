#!/usr/bin/env node

/**
 * Direct test of the MCP server's conversion functionality
 */

import fs from 'fs/promises';

const testMarkdown = `# MCP Server Test

Testing diagram sizing:

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\`
`;

async function testMCPServer() {
  console.log('Testing MCP server conversion...');
  
  try {
    // Import the converter directly
    const { MermaidConverter } = await import('./mermaid-to-pdf-mcp/dist/converter.js');
    
    const logger = {
      info: (obj, msg) => console.log(msg || JSON.stringify(obj)),
      error: (obj, msg) => console.error(msg || JSON.stringify(obj)),
      warn: (obj, msg) => console.warn(msg || JSON.stringify(obj)),
      debug: (obj, msg) => console.debug(msg || JSON.stringify(obj))
    };
    
    const converter = new MermaidConverter(logger);
    
    console.log('Converting markdown to PDF...');
    const result = await converter.convertMarkdownToPdf(testMarkdown, {
      title: 'MCP Server Test',
      quality: 'standard'
    });
    
    console.log(`PDF generated: ${result.metadata.fileSize} bytes`);
    console.log(`Diagrams processed: ${result.metadata.diagramCount}`);
    
    // Save the PDF with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mcp-direct-test-${timestamp}.pdf`;
    await fs.writeFile(filename, Buffer.from(result.pdfBase64, 'base64'));
    console.log(`✅ PDF saved as ${filename}`);
    
    await converter.cleanup();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMCPServer();