import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import puppeteer from 'puppeteer';
import { marked } from 'marked';
import * as pino from 'pino';
import {
  ConversionOptions,
  ConversionResult,
  FileConversionResult,
  MermaidDiagram,
  ValidationResult,
  CacheEntry
} from './types.js';

export class MermaidConverter {
  private cache = new Map<string, CacheEntry>();
  private browser: puppeteer.Browser | null = null;
  
  constructor(private logger: any) {}

  async convertMarkdownToPdf(markdown: string, options: ConversionOptions = {}): Promise<ConversionResult> {
    const startTime = Date.now();
    
    try {
      // Process Mermaid diagrams
      const { processedMarkdown, diagramCount } = await this.processMermaidDiagrams(markdown);
      
      // Convert to HTML
      const html = this.markdownToHtml(processedMarkdown, options.title || 'Document');
      
      // Generate PDF
      const pdfBuffer = await this.htmlToPdf(html, options);
      
      return {
        pdfBase64: pdfBuffer.toString('base64'),
        metadata: {
          pageCount: 0, // Would need PDF parsing to get actual count
          fileSize: pdfBuffer.length,
          diagramCount,
          processingTime: Date.now() - startTime
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'Conversion failed');
      throw error;
    }
  }

  async convertFileToFile(
    inputPath: string, 
    outputPath?: string, 
    options: ConversionOptions = {}
  ): Promise<FileConversionResult> {
    // Read input file
    const markdown = await fs.readFile(inputPath, 'utf-8');
    
    // Determine output path
    const resolvedOutputPath = outputPath || inputPath.replace(/\.md$/i, '.pdf');
    
    // Convert to PDF
    const result = await this.convertMarkdownToPdf(markdown, {
      ...options,
      title: options.title || path.basename(inputPath, '.md')
    });
    
    // Write to file
    await fs.writeFile(resolvedOutputPath, Buffer.from(result.pdfBase64, 'base64'));
    
    return {
      outputPath: resolvedOutputPath,
      metadata: result.metadata
    };
  }

  async extractMermaidDiagrams(markdown: string, format: 'png' | 'svg' = 'png'): Promise<MermaidDiagram[]> {
    const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
    const diagrams: MermaidDiagram[] = [];
    let match;
    let index = 0;

    while ((match = mermaidRegex.exec(markdown)) !== null) {
      const code = match[1].trim();
      const imageBase64 = await this.renderMermaidDiagram(code, format);
      
      diagrams.push({
        index: index++,
        code,
        imageBase64,
        format
      });
    }

    return diagrams;
  }

  async validateMermaidSyntax(mermaidCode: string): Promise<ValidationResult> {
    try {
      // Attempt to render - if it succeeds, syntax is valid
      await this.renderMermaidDiagram(mermaidCode, 'svg');
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async processMermaidDiagrams(markdown: string): Promise<{ processedMarkdown: string; diagramCount: number }> {
    const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
    let processedMarkdown = markdown;
    let diagramCount = 0;
    let match;

    const matches = [...markdown.matchAll(mermaidRegex)];
    
    for (const match of matches) {
      const mermaidCode = match[1].trim();
      
      try {
        const imageBase64 = await this.renderMermaidDiagram(mermaidCode, 'png');
        
        const imageHtml = `
<div class="mermaid-diagram">
    <img src="data:image/png;base64,${imageBase64}" alt="Mermaid Diagram" />
</div>`;
        
        processedMarkdown = processedMarkdown.replace(match[0], imageHtml);
        diagramCount++;
      } catch (error) {
        this.logger.warn({ error, code: mermaidCode }, 'Failed to render Mermaid diagram');
        
        const errorHtml = `
<div class="mermaid-error">
    <h4>⚠️ Mermaid Diagram Error</h4>
    <pre><code>${mermaidCode}</code></pre>
    <p><em>${error instanceof Error ? error.message : String(error)}</em></p>
</div>`;
        
        processedMarkdown = processedMarkdown.replace(match[0], errorHtml);
      }
    }

    return { processedMarkdown, diagramCount };
  }

  private async renderMermaidDiagram(mermaidCode: string, format: 'png' | 'svg'): Promise<string> {
    // Check cache
    const cacheKey = this.getCacheKey(mermaidCode, format);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      this.logger.debug({ cacheKey }, 'Using cached diagram');
      return cached.imageBase64;
    }

    // Ensure browser is initialized
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    }

    const page = await this.browser.newPage();
    
    try {
      const html = this.getMermaidRenderHtml(mermaidCode);
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Wait for Mermaid to render
      await page.waitForFunction(
        () => (window as any).mermaidRenderComplete === true,
        { timeout: 30000 }
      );
      
      let result: string;
      
      if (format === 'svg') {
        const svg = await page.$eval('.mermaid svg', el => el.outerHTML);
        result = Buffer.from(svg).toString('base64');
      } else {
        const element = await page.$('.mermaid');
        if (!element) throw new Error('Mermaid diagram not found');
        
        const screenshot = await element.screenshot({ type: 'png' });
        result = screenshot.toString('base64');
      }
      
      // Cache the result
      this.cache.set(cacheKey, {
        imageBase64: result,
        timestamp: Date.now(),
        hash: cacheKey
      });
      
      return result;
    } finally {
      await page.close();
    }
  }

  private getMermaidRenderHtml(mermaidCode: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        body { margin: 0; padding: 20px; background: white; }
        .mermaid { display: inline-block; }
    </style>
</head>
<body>
    <div class="mermaid" id="diagram">${mermaidCode}</div>
    <script>
        mermaid.initialize({ 
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose'
        });
        
        window.addEventListener('DOMContentLoaded', async function() {
            try {
                await mermaid.run({ nodes: [document.getElementById('diagram')] });
                (window as any).mermaidRenderComplete = true;
            } catch (error) {
                console.error('Mermaid error:', error);
                (window as any).mermaidRenderComplete = true;
                (window as any).mermaidRenderError = error.message;
            }
        });
    </script>
</body>
</html>`;
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #24292e;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        
        h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
        
        pre {
            background-color: #f6f8fa;
            border-radius: 6px;
            padding: 16px;
            overflow: auto;
        }
        
        code {
            background-color: rgba(27,31,35,0.05);
            border-radius: 3px;
            padding: 0.2em 0.4em;
            font-family: 'SFMono-Regular', Consolas, monospace;
        }
        
        pre code {
            background-color: transparent;
            padding: 0;
        }
        
        blockquote {
            border-left: 0.25em solid #dfe2e5;
            color: #6a737d;
            padding: 0 1em;
            margin: 0;
        }
        
        table {
            border-collapse: collapse;
            width: 100%;
        }
        
        table th, table td {
            border: 1px solid #dfe2e5;
            padding: 6px 13px;
        }
        
        table tr:nth-child(2n) {
            background-color: #f6f8fa;
        }
        
        .mermaid-diagram {
            margin: 20px 0;
            text-align: center;
        }
        
        .mermaid-diagram img {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 10px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .mermaid-error {
            margin: 20px 0;
            padding: 16px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            color: #856404;
        }
        
        a { color: #0366d6; text-decoration: none; }
        a:hover { text-decoration: underline; }
        
        @media print {
            body { max-width: 100%; }
            .mermaid-diagram { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;
  }

  private async htmlToPdf(html: string, options: ConversionOptions): Promise<Buffer> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    }

    const page = await this.browser.newPage();
    
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Wait for images to load
      await page.evaluate(() => {
        return Promise.all(
          Array.from((document as any).images)
            .filter((img: any) => !img.complete)
            .map((img: any) => new Promise(resolve => {
              img.onload = img.onerror = resolve;
            }))
        );
      });
      
      const pdfBuffer = await page.pdf({
        format: options.pageSize || 'A4',
        printBackground: true,
        margin: options.margins || {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
      
      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  private getCacheKey(mermaidCode: string, format: string): string {
    return createHash('sha256')
      .update(mermaidCode)
      .update(format)
      .digest('hex');
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.cache.clear();
  }
}