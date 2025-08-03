const { MermaidToPdfConverterPDFKit } = require('./out/converterPDFKit');
const path = require('path');

async function test() {
    console.log('Testing PDFKit-based Mermaid to PDF converter...');
    
    const converter = new MermaidToPdfConverterPDFKit();
    const samplePath = path.join(__dirname, 'sample.md');
    
    try {
        console.log('Converting sample.md to PDF using PDFKit...');
        const outputPath = await converter.convert(samplePath, (message, progress) => {
            console.log(`[${progress}%] ${message}`);
        });
        
        console.log(`✅ PDF created successfully at: ${outputPath}`);
        
        // Check file size
        const fs = require('fs');
        const stats = fs.statSync(outputPath);
        console.log(`📄 PDF file size: ${(stats.size / 1024).toFixed(2)} KB`);
        
    } catch (error) {
        console.error('❌ Error during conversion:', error);
    }
}

test();