import * as fs from 'fs';
import * as path from 'path';
import { renderMermaid } from './mermaidRenderer';
import { PDFKitGenerator, PDFOptions } from './pdfGenerator';

export class MermaidToPdfConverterPDFKit {
    private mermaidCounter = 0;

    async convert(markdownPath: string, progressCallback?: (message: string, increment: number) => void): Promise<string> {
        progressCallback?.('Reading Markdown file...', 10);
        
        const markdownContent = fs.readFileSync(markdownPath, 'utf-8');
        const outputDir = path.dirname(markdownPath);
        const basename = path.basename(markdownPath, '.md');
        const outputPath = path.join(outputDir, `${basename}_pdfkit.pdf`);
        
        progressCallback?.('Processing Mermaid diagrams...', 20);
        
        const { processedContent, imageMap } = await this.processMermaidDiagrams(markdownContent, outputDir);
        
        progressCallback?.('Generating PDF with PDFKit...', 60);
        
        await this.generatePDF(processedContent, outputPath, basename, imageMap);
        
        progressCallback?.('Cleaning up temporary files...', 90);
        
        this.cleanupTempImages(outputDir);
        
        progressCallback?.('Complete!', 100);
        
        return outputPath;
    }

    private async processMermaidDiagrams(content: string, outputDir: string): Promise<{
        processedContent: string;
        imageMap: Map<string, Buffer>;
    }> {
        const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
        let match;
        let processedContent = content;
        const imageMap = new Map<string, Buffer>();
        const tempImages: string[] = [];

        while ((match = mermaidRegex.exec(content)) !== null) {
            const mermaidCode = match[1].trim();
            const imagePath = path.join(outputDir, `.temp_mermaid_${this.mermaidCounter++}.png`);
            
            try {
                console.log(`Rendering Mermaid diagram ${this.mermaidCounter}...`);
                await renderMermaid(mermaidCode, imagePath);
                
                // Verify the image was created and has content
                if (fs.existsSync(imagePath)) {
                    const stats = fs.statSync(imagePath);
                    if (stats.size > 0) {
                        tempImages.push(imagePath);
                        
                        // Read image as buffer for PDFKit
                        const imageBuffer = fs.readFileSync(imagePath);
                        const base64Image = imageBuffer.toString('base64');
                        const dataUrl = `data:image/png;base64,${base64Image}`;
                        
                        // Store the buffer in the map for PDFKit to use
                        imageMap.set(dataUrl, imageBuffer);
                        
                        const imageMarkdown = `![Mermaid Diagram](${dataUrl})`;
                        processedContent = processedContent.replace(match[0], imageMarkdown);
                        console.log(`✅ Successfully rendered Mermaid diagram to ${imagePath} (${stats.size} bytes)`);
                    } else {
                        throw new Error('Generated image file is empty');
                    }
                } else {
                    throw new Error('Image file was not created');
                }
            } catch (error) {
                console.error(`❌ Failed to render Mermaid diagram ${this.mermaidCounter}:`, error);
                
                // Create a fallback text representation
                const fallbackContent = `
**Mermaid Diagram (Rendering Failed)**
\`\`\`
${mermaidCode}
\`\`\`
*Error: ${error instanceof Error ? error.message : String(error)}*
`;
                processedContent = processedContent.replace(match[0], fallbackContent);
            }
        }

        return { processedContent, imageMap };
    }

    private async generatePDF(
        markdown: string, 
        outputPath: string, 
        title: string, 
        imageMap: Map<string, Buffer>
    ): Promise<void> {
        try {
            const pdfOptions: PDFOptions = {
                title: title,
                author: 'Mermaid to PDF Extension',
                subject: 'Markdown with Mermaid Diagrams',
                margins: { top: 72, bottom: 72, left: 72, right: 72 }, // 1 inch margins
                fontSize: {
                    body: 12,
                    h1: 24,
                    h2: 18,
                    h3: 16,
                    code: 10
                }
            };

            const generator = new PDFKitGenerator(pdfOptions);
            const pdfBuffer = await generator.generateFromMarkdown(markdown, imageMap);
            
            fs.writeFileSync(outputPath, pdfBuffer);
            console.log(`✅ PDF generated successfully: ${outputPath}`);
            
        } catch (error) {
            console.error('❌ PDF generation failed:', error);
            throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private cleanupTempImages(outputDir: string): void {
        const tempImagePattern = /^\.temp_mermaid_\d+\.png$/;
        const files = fs.readdirSync(outputDir);
        
        files.forEach(file => {
            if (tempImagePattern.test(file)) {
                try {
                    fs.unlinkSync(path.join(outputDir, file));
                } catch (error) {
                    console.error(`Failed to delete temp file ${file}:`, error);
                }
            }
        });
    }
}