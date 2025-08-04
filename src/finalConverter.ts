import { promises as fs, constants } from 'fs';
import * as path from 'path';
import { marked } from 'marked';
import * as puppeteer from 'puppeteer';
import { renderMermaid } from './mermaidRenderer.js';
import { BrowserPool } from './browserPool.js';
import { DiagramCache } from './diagramCache.js';

export interface ConversionOptions {
    engine: 'puppeteer' | 'pdfkit';
    quality: 'draft' | 'standard' | 'high';
    theme: 'light' | 'dark' | 'auto';
    pageSize: 'A4' | 'Letter' | 'Legal';
    margins: {
        top: string;
        right: string;
        bottom: string;
        left: string;
    };
}

export class FinalMermaidToPdfConverter {
    private mermaidCounter = 0;
    private options: ConversionOptions;

    constructor(options: Partial<ConversionOptions> = {}) {
        // Validate and sanitize options
        const validatedOptions = this.validateAndSanitizeOptions(options);
        
        this.options = {
            engine: validatedOptions.engine || 'puppeteer',
            quality: validatedOptions.quality || 'standard',
            theme: validatedOptions.theme || 'light',
            pageSize: validatedOptions.pageSize || 'A4',
            margins: validatedOptions.margins || {
                top: '10mm',
                right: '10mm', 
                bottom: '10mm',
                left: '10mm'
            }
        };
    }

    async convert(markdownPath: string, progressCallback?: (message: string, increment: number) => void): Promise<string> {
        // Validate input file before processing
        await this.validateMarkdownFile(markdownPath);
        
        progressCallback?.('🔍 Reading Markdown file...', 5);
        
        const markdownContent = await fs.readFile(markdownPath, 'utf-8');
        const outputDir = path.dirname(markdownPath);
        const basename = path.basename(markdownPath, '.md');
        const outputPath = path.join(outputDir, `${basename}_final.pdf`);
        
        progressCallback?.('🎨 Processing Mermaid diagrams...', 15);
        
        const processedContent = await this.processMermaidDiagrams(markdownContent, outputDir, progressCallback);
        
        progressCallback?.('📝 Converting Markdown to HTML...', 50);
        
        const html = this.markdownToHtml(processedContent, basename);
        
        progressCallback?.('📄 Generating PDF...', 70);
        
        await this.htmlToPdf(html, outputPath);
        
        progressCallback?.('🧹 Cleaning up...', 95);
        
        await this.cleanupTempImages(outputDir);
        
        progressCallback?.('✅ Complete!', 100);
        
        // Log cache statistics
        const cache = DiagramCache.getInstance();
        const stats = cache.getStats();
        console.log(`📊 Cache Stats: ${stats.totalEntries} entries, ${stats.hitRate}% hit rate`);
        
        return outputPath;
    }

    private async validateMarkdownFile(filePath: string): Promise<void> {
        // Path traversal protection
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath.includes('..') || !path.isAbsolute(normalizedPath)) {
            throw new Error('Invalid file path: Path traversal detected or relative path provided');
        }

        // Check file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Check file extension
        if (!filePath.toLowerCase().endsWith('.md')) {
            throw new Error('Invalid file type: Only Markdown (.md) files are supported');
        }

        // File size validation (10MB limit)
        const stats = await fs.stat(filePath);
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (stats.size > maxSize) {
            throw new Error(`File too large: Maximum file size is ${maxSize / (1024 * 1024)}MB`);
        }

        // Ensure we can read the file
        try {
            await fs.access(filePath, constants.R_OK);
        } catch (error) {
            throw new Error(`Cannot read file: ${filePath}. Check file permissions.`);
        }
    }

    private validateAndSanitizeOptions(options: Partial<ConversionOptions>): Partial<ConversionOptions> {
        const sanitized: Partial<ConversionOptions> = {};

        // Validate engine
        if (options.engine) {
            const validEngines: ConversionOptions['engine'][] = ['puppeteer', 'pdfkit'];
            if (validEngines.includes(options.engine)) {
                sanitized.engine = options.engine;
            } else {
                console.warn(`Invalid engine "${options.engine}". Using default "puppeteer".`);
            }
        }

        // Validate quality
        if (options.quality) {
            const validQualities: ConversionOptions['quality'][] = ['draft', 'standard', 'high'];
            if (validQualities.includes(options.quality)) {
                sanitized.quality = options.quality;
            } else {
                console.warn(`Invalid quality "${options.quality}". Using default "standard".`);
            }
        }

        // Validate theme
        if (options.theme) {
            const validThemes: ConversionOptions['theme'][] = ['light', 'dark', 'auto'];
            if (validThemes.includes(options.theme)) {
                sanitized.theme = options.theme;
            } else {
                console.warn(`Invalid theme "${options.theme}". Using default "light".`);
            }
        }

        // Validate page size
        if (options.pageSize) {
            const validPageSizes: ConversionOptions['pageSize'][] = ['A4', 'Letter', 'Legal'];
            if (validPageSizes.includes(options.pageSize)) {
                sanitized.pageSize = options.pageSize;
            } else {
                console.warn(`Invalid page size "${options.pageSize}". Using default "A4".`);
            }
        }

        // Validate margins
        if (options.margins) {
            const validatedMargins = this.validateMargins(options.margins);
            if (validatedMargins) {
                sanitized.margins = validatedMargins;
            }
        }

        return sanitized;
    }

    private validateMargins(margins: ConversionOptions['margins']): ConversionOptions['margins'] | null {
        if (!margins || typeof margins !== 'object') {
            console.warn('Invalid margins object. Using defaults.');
            return null;
        }

        const marginPattern = /^\d+(\.\d+)?(mm|cm|in|px)$/;
        const validatedMargins: ConversionOptions['margins'] = {
            top: '10mm',
            right: '10mm',
            bottom: '10mm',
            left: '10mm'
        };

        // Validate each margin
        for (const side of ['top', 'right', 'bottom', 'left'] as const) {
            if (margins[side] && typeof margins[side] === 'string') {
                if (marginPattern.test(margins[side])) {
                    validatedMargins[side] = margins[side];
                } else {
                    console.warn(`Invalid margin value for ${side}: "${margins[side]}". Using default.`);
                }
            }
        }

        return validatedMargins;
    }

    private async processMermaidDiagrams(
        content: string, 
        outputDir: string, 
        progressCallback?: (message: string, increment: number) => void
    ): Promise<string> {
        const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
        let match;
        let processedContent = content;
        const matches = [...content.matchAll(mermaidRegex)];
        const cache = DiagramCache.getInstance();
        
        for (let i = 0; i < matches.length; i++) {
            match = matches[i];
            const mermaidCode = match[1].trim();
            const imagePath = path.join(outputDir, `.temp_mermaid_${this.mermaidCounter++}.png`);
            
            const diagramProgress = 15 + (i / matches.length) * 30; // 15-45% range
            progressCallback?.(`🎨 Processing diagram ${i + 1}/${matches.length}...`, diagramProgress);
            
            try {
                // Use cache to get or render the diagram
                const base64Image = await cache.getOrRender(mermaidCode, imagePath);
                const dataUrl = `data:image/png;base64,${base64Image}`;
                
                // Create better image markdown with proper sizing
                const imageMarkdown = `<div class="mermaid-diagram"><img src="${dataUrl}" alt="Mermaid Diagram" style="max-width: 90%; max-height: 400px; height: auto; width: auto; display: block; margin: 5px auto; object-fit: contain;" /></div>`;
                
                processedContent = processedContent.replace(match[0], imageMarkdown);
                console.log(`✅ Processed diagram ${i + 1}: ${(base64Image.length * 0.75 / 1024).toFixed(2)} KB`);
            } catch (error) {
                console.error(`❌ Failed to render diagram ${i + 1}:`, error);
                
                const fallbackContent = `
<div class="mermaid-error">
    <h4>⚠️ Mermaid Diagram (Render Failed)</h4>
    <pre><code>${mermaidCode}</code></pre>
    <p><em>Error: ${error instanceof Error ? error.message : String(error)}</em></p>
</div>
`;
                processedContent = processedContent.replace(match[0], fallbackContent);
            }
        }

        return processedContent;
    }

    private markdownToHtml(markdown: string, title: string): string {
        // Configure marked for better HTML output
        marked.setOptions({
            gfm: true,
            breaks: false,
            pedantic: false
        });
        
        const htmlContent = marked(markdown);
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.5;
            color: #24292e;
            background: white;
            padding: 0;
            max-width: 100%;
            margin: 0;
        }
        
        h1, h2, h3, h4, h5, h6 {
            margin: 16px 0 8px 0;
            font-weight: 600;
            line-height: 1.2;
            color: #1f2328;
        }
        
        h1 { 
            font-size: 2em; 
            border-bottom: 1px solid #d1d9e0; 
            padding-bottom: 0.3em; 
        }
        h2 { 
            font-size: 1.5em; 
            border-bottom: 1px solid #d1d9e0; 
            padding-bottom: 0.3em; 
        }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1em; }
        h5 { font-size: 0.875em; }
        h6 { font-size: 0.85em; color: #656d76; }
        
        p {
            margin: 8px 0;
            line-height: 1.5;
        }
        
        ul, ol {
            margin: 8px 0;
            padding-left: 24px;
        }
        
        li {
            margin: 4px 0;
        }
        
        pre {
            background: #f6f8fa;
            border-radius: 4px;
            font-size: 85%;
            line-height: 1.4;
            overflow: auto;
            padding: 12px;
            margin: 8px 0;
            border: 1px solid #d1d9e0;
        }
        
        code {
            background: rgba(175, 184, 193, 0.2);
            border-radius: 3px;
            font-size: 85%;
            margin: 0;
            padding: 0.2em 0.4em;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }
        
        pre code {
            background: transparent;
            border: 0;
            display: inline;
            line-height: inherit;
            margin: 0;
            overflow: visible;
            padding: 0;
            word-wrap: normal;
        }
        
        blockquote {
            border-left: 0.25em solid #d1d9e0;
            color: #656d76;
            margin: 8px 0;
            padding: 0 12px;
        }
        
        table {
            border-collapse: collapse;
            border-spacing: 0;
            display: block;
            overflow: auto;
            width: max-content;
            max-width: 100%;
            margin: 8px 0;
        }
        
        table th, table td {
            border: 1px solid #d1d9e0;
            padding: 6px 13px;
        }
        
        table th {
            font-weight: 600;
            background: #f6f8fa;
        }
        
        table tr:nth-child(2n) {
            background: #f6f8fa;
        }
        
        .mermaid-diagram {
            margin: 8px 0;
            text-align: center;
        }
        
        .mermaid-diagram img {
            max-width: 90%;
            max-height: 400px;
            height: auto;
            width: auto;
            object-fit: contain;
        }
        
        .mermaid-error {
            margin: 20px 0;
            padding: 16px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            color: #856404;
        }
        
        .mermaid-error h4 {
            margin: 0 0 8px 0;
            color: #856404;
        }
        
        .mermaid-error pre {
            background: #f8f9fa;
            margin: 8px 0;
        }
        
        hr {
            height: 0.25em;
            padding: 0;
            margin: 12px 0;
            background-color: #d1d9e0;
            border: 0;
        }
        
        a {
            color: #0969da;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        strong {
            font-weight: 600;
        }
        
        em {
            font-style: italic;
        }
        
        @media print {
            body {
                padding: 0;
                max-width: none;
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
        const browserPool = BrowserPool.getInstance();
        const browser = await browserPool.getBrowser();
        
        const page = await browser.newPage();
        
        // Set viewport for consistent rendering
        await page.setViewport({ 
            width: 1200, 
            height: 1600, 
            deviceScaleFactor: this.options.quality === 'high' ? 2 : 1 
        });
        
        try {
            await page.setContent(html, { 
                waitUntil: ['networkidle0', 'domcontentloaded']
            });
            
            // Wait for all images to load completely
            await page.evaluate(() => {
                return Promise.all(
                    Array.from(document.images)
                        .filter(img => !img.complete)
                        .map(img => new Promise(resolve => {
                            img.onload = img.onerror = resolve;
                        }))
                );
            });
            
            // Additional wait for rendering stability
            await new Promise(resolve => setTimeout(resolve, 1000));

            await page.pdf({
                path: outputPath,
                format: this.options.pageSize as any,
                printBackground: true,
                preferCSSPageSize: true,
                margin: {
                    top: '5mm',
                    right: '5mm',
                    bottom: '5mm',
                    left: '5mm'
                },
                displayHeaderFooter: false,
                scale: 0.9
            });
            
            console.log(`✅ PDF generated: ${outputPath}`);
            
        } catch (error) {
            console.error('❌ PDF generation failed:', error);
            throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            // Close the page and release browser back to pool
            try {
                await page.close();
            } catch (error) {
                console.warn('Failed to close page:', error);
            }
            
            const browserPool = BrowserPool.getInstance();
            await browserPool.releaseBrowser(browser);
        }
    }

    private async cleanupTempImages(outputDir: string): Promise<void> {
        const tempImagePattern = /^\.temp_mermaid_\d+\.png$/;
        try {
            const files = await fs.readdir(outputDir);
            
            // Use Promise.all for concurrent file deletion
            await Promise.all(
                files
                    .filter(file => tempImagePattern.test(file))
                    .map(async (file) => {
                        try {
                            await fs.unlink(path.join(outputDir, file));
                        } catch (error) {
                            console.error(`Failed to delete temp file ${file}:`, error);
                        }
                    })
            );
        } catch (error) {
            console.error('Failed to cleanup temp files:', error);
        }
    }
}