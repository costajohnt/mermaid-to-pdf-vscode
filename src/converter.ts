import * as fs from 'fs';
import * as path from 'path';
import { marked } from 'marked';
import * as puppeteer from 'puppeteer';
import { renderMermaid } from './mermaidRenderer';

export class MermaidToPdfConverter {
    private mermaidCounter = 0;

    async convert(markdownPath: string, progressCallback?: (message: string, increment: number) => void): Promise<string> {
        progressCallback?.('Reading Markdown file...', 10);
        
        const markdownContent = fs.readFileSync(markdownPath, 'utf-8');
        const outputDir = path.dirname(markdownPath);
        const basename = path.basename(markdownPath, '.md');
        const outputPath = path.join(outputDir, `${basename}.pdf`);
        
        progressCallback?.('Processing Mermaid diagrams...', 20);
        
        const processedContent = await this.processMermaidDiagrams(markdownContent, outputDir);
        
        progressCallback?.('Converting Markdown to HTML...', 40);
        
        const html = this.markdownToHtml(processedContent, basename);
        
        progressCallback?.('Generating PDF...', 60);
        
        await this.htmlToPdf(html, outputPath);
        
        progressCallback?.('Cleaning up temporary files...', 90);
        
        this.cleanupTempImages(outputDir);
        
        progressCallback?.('Complete!', 100);
        
        return outputPath;
    }

    private async processMermaidDiagrams(content: string, outputDir: string): Promise<string> {
        const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
        let match;
        let processedContent = content;
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
                        
                        // Convert image to base64 data URL for embedding in HTML
                        const imageBuffer = fs.readFileSync(imagePath);
                        const base64Image = imageBuffer.toString('base64');
                        const dataUrl = `data:image/png;base64,${base64Image}`;
                        
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

        return processedContent;
    }

    private markdownToHtml(markdown: string, title: string): string {
        const htmlContent = marked(markdown);
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1em; }
        h5 { font-size: 0.875em; }
        h6 { font-size: 0.85em; }
        pre {
            background-color: #f6f8fa;
            border-radius: 3px;
            font-size: 85%;
            line-height: 1.45;
            overflow: auto;
            padding: 16px;
        }
        code {
            background-color: rgba(27,31,35,0.05);
            border-radius: 3px;
            font-size: 85%;
            margin: 0;
            padding: 0.2em 0.4em;
        }
        pre code {
            background-color: transparent;
            border: 0;
            display: inline;
            line-height: inherit;
            margin: 0;
            overflow: visible;
            padding: 0;
            word-wrap: normal;
        }
        blockquote {
            border-left: 0.25em solid #dfe2e5;
            color: #6a737d;
            margin: 0;
            padding: 0 1em;
        }
        table {
            border-collapse: collapse;
            border-spacing: 0;
            display: block;
            overflow: auto;
            width: 100%;
        }
        table th {
            font-weight: 600;
        }
        table td, table th {
            border: 1px solid #dfe2e5;
            padding: 6px 13px;
        }
        table tr {
            background-color: #fff;
            border-top: 1px solid #c6cbd1;
        }
        table tr:nth-child(2n) {
            background-color: #f6f8fa;
        }
        img {
            max-width: 100%;
            height: auto;
            box-sizing: content-box;
            background-color: #fff;
            display: block;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 8px;
        }
        a {
            color: #0366d6;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        @media print {
            body {
                max-width: 100%;
            }
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;
    }

    private async htmlToPdf(html: string, outputPath: string): Promise<void> {
        const browser = await puppeteer.launch({ 
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set viewport for consistent rendering
        await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });
        
        try {
            await page.setContent(html, { 
                waitUntil: ['networkidle0', 'domcontentloaded']
            });
            
            // Wait for any images to load (including base64 data URLs)
            await page.evaluate(() => {
                return Promise.all(
                    Array.from(document.images)
                        .filter(img => !img.complete || img.naturalWidth === 0)
                        .map(img => new Promise(resolve => {
                            img.onload = img.onerror = resolve;
                            // Force load if it's a data URL
                            if (img.src.startsWith('data:')) {
                                resolve(undefined);
                            }
                        }))
                );
            });
            
            // Additional wait for base64 images to render
            await page.waitForFunction(() => {
                const images = Array.from(document.images);
                return images.length === 0 || images.every(img => 
                    img.complete && (img.naturalWidth > 0 || img.src.startsWith('data:'))
                );
            }, { timeout: 10000 });
            
            // Additional wait for rendering
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await page.pdf({
                path: outputPath,
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: false,
                margin: {
                    top: '20mm',
                    right: '20mm',
                    bottom: '20mm',
                    left: '20mm'
                }
            });
            
            console.log(`✅ PDF generated successfully: ${outputPath}`);
            
        } catch (error) {
            console.error('❌ PDF generation failed:', error);
            throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            await browser.close();
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