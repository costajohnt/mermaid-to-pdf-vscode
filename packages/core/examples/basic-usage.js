/**
 * Basic usage example for @mermaid-converter/core
 */

const { createConverter, PDFGenerator, MermaidRenderer } = require('../dist');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Creating converter...');
  
  // Create converter and register plugins
  const converter = createConverter();
  converter.registerGenerator(new PDFGenerator());
  converter.registerRenderer(new MermaidRenderer());

  // Sample markdown with Mermaid diagram
  const markdown = `
# Sample Document

This is a sample document demonstrating the core library functionality.

## Flow Diagram

Here's a simple flow diagram:

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E[End]
    D --> E
\`\`\`

## Sequence Diagram

And here's a sequence diagram:

\`\`\`mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob, how are you?
    B-->>A: Great!
\`\`\`

## Conclusion

The core library successfully converts markdown with diagrams to PDF!
`;

  console.log('Converting to PDF...');
  
  try {
    // Convert to PDF
    const result = await converter.convert({
      content: markdown,
      format: 'pdf',
      metadata: {
        title: 'Sample Document',
        author: 'Core Library Example'
      },
      options: {
        theme: 'light',
        quality: 'standard'
      }
    });

    // Save the PDF
    const outputPath = path.join(__dirname, 'sample-output.pdf');
    fs.writeFileSync(outputPath, result.data);
    
    console.log('✅ PDF generated successfully!');
    console.log(`📄 Output: ${outputPath}`);
    console.log(`📊 Size: ${result.data.length} bytes`);
    console.log(`📈 Diagrams: ${result.metadata.diagrams}`);
    console.log(`⏱️  Processing time: ${result.metadata.processingTime}ms`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };