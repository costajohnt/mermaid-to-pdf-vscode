// Direct test of the converter without MCP protocol
import { MermaidConverter } from './dist/converter.js';

const testMarkdown = `# Test Document

This is a test document.

## Simple Diagram

\`\`\`mermaid
graph TD
    A[Test] --> B[Works]
\`\`\`

End of test.
`;

async function test() {
    console.log('Testing converter directly...');
    
    const logger = {
        info: console.log,
        error: console.error,
        warn: console.warn,
        debug: console.debug
    };
    
    const converter = new MermaidConverter(logger);
    
    try {
        const result = await converter.convertMarkdownToPdf(testMarkdown, {
            title: 'Test Document',
            quality: 'standard'
        });
        
        console.log('✅ Success!');
        console.log('PDF size:', result.metadata.fileSize, 'bytes');
        console.log('Diagrams:', result.metadata.diagramCount);
        console.log('Time:', result.metadata.processingTime, 'ms');
        
        // Save to file for inspection
        const fs = await import('fs/promises');
        await fs.writeFile('test-output.pdf', Buffer.from(result.pdfBase64, 'base64'));
        console.log('Saved to test-output.pdf');
        
    } catch (error) {
        console.error('❌ Failed:', error);
    } finally {
        await converter.cleanup();
    }
}

test();