const { FinalMermaidToPdfConverter } = require('./out/finalConverter');
const path = require('path');

async function testMultipleDiagrams() {
    console.log('🧪 Testing multiple diagrams with caching...');
    
    const converter = new FinalMermaidToPdfConverter({
        engine: 'puppeteer',
        quality: 'high',
        theme: 'light',
        pageSize: 'A4'
    });
    
    const markdownPath = path.join(__dirname, 'src/test/fixtures/multiple-diagrams.md');
    console.log(`📄 Converting: ${markdownPath}`);
    
    try {
        const outputPath = await converter.convert(markdownPath, (message, increment) => {
            console.log(`Progress: ${message} (${increment}%)`);
        });
        
        console.log(`✅ Conversion successful!`);
        console.log(`📄 PDF created at: ${outputPath}`);
        
        // Check if file exists
        const fs = require('fs');
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
            
            // Open the PDF
            const { exec } = require('child_process');
            exec(`open "${outputPath}"`, (error) => {
                if (error) {
                    console.log(`📂 Please manually open: ${outputPath}`);
                } else {
                    console.log(`🔍 PDF opened for review`);
                }
            });
        }
        
    } catch (error) {
        console.error(`❌ Conversion failed:`, error);
    }
}

testMultipleDiagrams();