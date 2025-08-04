import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import puppeteer from 'puppeteer';
import { marked } from 'marked';
import * as pino from 'pino';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ConversionOptions,
  ConversionResult,
  FileConversionResult,
  MermaidDiagram,
  ValidationResult,
  CacheEntry
} from './types.js';

const execAsync = promisify(exec);

export class MermaidConverter {
  private cache = new Map<string, CacheEntry>();
  private browser: puppeteer.Browser | null = null;
  
  constructor(private logger: any) {}

  async convertMarkdownToPdf(markdown: string, options: ConversionOptions = {}): Promise<ConversionResult> {
    const startTime = Date.now();
    
    try {
      // Use the working CLI tool approach
      const result = await this.convertUsingCLI(markdown, options);
      this.logger.info('CLI conversion succeeded!');
      return result;
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'CLI conversion failed, falling back to browser approach');
      // Fallback to original browser approach
      return await this.convertUsingBrowser(markdown, options, startTime);
    }
  }

  private async convertUsingCLI(markdown: string, options: ConversionOptions = {}): Promise<ConversionResult> {
    const startTime = Date.now();
    
    // Create temporary files
    const tempDir = await fs.mkdtemp('/tmp/mcp-mermaid-');
    const inputFile = path.join(tempDir, 'input.md');
    const outputFile = path.join(tempDir, 'output.pdf');
    
    try {
      // Write markdown to temp file
      await fs.writeFile(inputFile, markdown, 'utf-8');
      
      // Try to find the CLI tool - check if globally installed
      let cliCommand = 'mermaid-to-pdf';
      try {
        const { stdout: whichOutput } = await execAsync('which mermaid-to-pdf');
        this.logger.info(`Found CLI tool at: ${whichOutput.trim()}`);
      } catch (whichError) {
        this.logger.warn({ whichError }, 'Global CLI not found, trying local version');
        // If not globally available, try the local built version
        const localCli = path.resolve(__dirname, '../../../dist/cli.js');
        try {
          await fs.access(localCli);
          cliCommand = `node ${localCli}`;
          this.logger.info(`Using local CLI at: ${localCli}`);
        } catch (accessError) {
          throw new Error(`CLI tool not available: global check failed (${whichError instanceof Error ? whichError.message : String(whichError)}), local check failed (${accessError instanceof Error ? accessError.message : String(accessError)})`);
        }
      }
      
      // Run the CLI tool (it will create a file with _final.pdf suffix)
      this.logger.info(`Running CLI command: ${cliCommand} "${inputFile}"`);
      const { stdout, stderr } = await execAsync(`${cliCommand} "${inputFile}"`);
      
      this.logger.info({ stdout }, 'CLI tool output');
      if (stderr) {
        this.logger.warn({ stderr }, 'CLI tool warnings');
      }
      
      // The CLI tool creates a file with _final.pdf suffix
      const actualOutputFile = inputFile.replace(/\.md$/, '_final.pdf');
      
      // Check if output file was created
      try {
        await fs.access(actualOutputFile);
        this.logger.info(`Output file created: ${actualOutputFile}`);
      } catch (accessError) {
        throw new Error(`Output file not created: ${actualOutputFile} - ${accessError instanceof Error ? accessError.message : String(accessError)}`);
      }
      
      // Read the generated PDF
      const pdfBuffer = await fs.readFile(actualOutputFile);
      this.logger.info(`PDF read successfully: ${pdfBuffer.length} bytes`);
      
      // Count diagrams in the markdown
      const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
      const diagramCount = (markdown.match(mermaidRegex) || []).length;
      
      return {
        pdfBase64: pdfBuffer.toString('base64'),
        metadata: {
          pageCount: 0,
          fileSize: pdfBuffer.length,
          diagramCount,
          processingTime: Date.now() - startTime
        }
      };
    } finally {
      // Cleanup temp files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warn({ cleanupError }, 'Failed to cleanup temp files');
      }
    }
  }

  private async convertUsingBrowser(markdown: string, options: ConversionOptions = {}, startTime: number): Promise<ConversionResult> {
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
      this.logger.error({ error }, 'Browser conversion failed');
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
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
    }

    const page = await this.browser.newPage();
    
    try {
      // Set viewport for consistent rendering - smaller for more compact diagrams
      await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });
      
      // Increase timeout for complex diagrams - use same as CLI
      page.setDefaultTimeout(60000);
      
      const html = this.getMermaidRenderHtml(mermaidCode);
      await page.setContent(html, { 
        waitUntil: ['networkidle0', 'domcontentloaded']
      });
      
      // Wait for mermaid library to load first
      await page.waitForFunction(
        () => typeof (window as any).mermaid !== 'undefined' && typeof (window as any).mermaid.run === 'function',
        { timeout: 30000 }
      );
      
      // Wait for Mermaid to render - use same timeout as CLI
      await page.waitForFunction(
        () => (window as any).mermaidRenderComplete === true,
        { timeout: 45000 }
      );
      
      let result: string;
      
      if (format === 'svg') {
        const svg = await page.$eval('.mermaid svg', el => el.outerHTML);
        result = Buffer.from(svg).toString('base64');
      } else {
        const element = await page.$('.mermaid');
        if (!element) throw new Error('Mermaid diagram not found');
        
        // Take high-resolution screenshot
        const screenshot = await element.screenshot({ 
          type: 'png',
          omitBackground: false
        });
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
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        }
        #mermaid-container {
            display: inline-block;
            min-width: 100px;
            min-height: 100px;
        }
        .mermaid {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        }
        /* Ensure SVG is visible */
        .mermaid svg {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
    <div id="mermaid-container">
        <div class="mermaid" id="diagram">
${mermaidCode}
        </div>
    </div>
    
    <script>
        // Initialize mermaid with better error handling
        mermaid.initialize({ 
            startOnLoad: false,
            theme: 'default',
            themeVariables: {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                fontSize: '14px'
            },
            logLevel: 'error',
            securityLevel: 'loose',
            flowchart: {
                htmlLabels: true,
                useMaxWidth: false,
                nodeSpacing: 30,
                rankSpacing: 30,
                padding: 15
            },
            sequence: {
                diagramMarginX: 25,
                diagramMarginY: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 25
            }
        });
        
        // Manual initialization with error handling
        window.addEventListener('DOMContentLoaded', async function() {
            try {
                const element = document.getElementById('diagram');
                if (element) {
                    await mermaid.run({
                        nodes: [element]
                    });
                    
                    // Mark as complete for Puppeteer to detect
                    window.mermaidRenderComplete = true;
                    
                    // Ensure proper sizing
                    const svg = element.querySelector('svg');
                    if (svg) {
                        const bbox = svg.getBBox();
                        svg.setAttribute('width', Math.max(bbox.width + 40, 100));
                        svg.setAttribute('height', Math.max(bbox.height + 40, 100));
                        svg.style.maxWidth = 'none';
                        svg.style.height = 'auto';
                    }
                }
            } catch (error) {
                console.error('Mermaid rendering failed:', error);
                window.mermaidRenderError = error.message;
                
                // Create fallback content
                const element = document.getElementById('diagram');
                if (element) {
                    element.innerHTML = '<div style="border: 2px dashed #ccc; padding: 20px; text-align: center; color: #666;">Mermaid diagram failed to render:<br>' + error.message + '</div>';
                }
                window.mermaidRenderComplete = true;
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
            margin: 30px 0;
            text-align: center;
            page-break-inside: avoid;
        }
        
        .mermaid-diagram img {
            max-width: 100%;
            width: auto;
            height: auto;
            min-width: 400px;
            border: 1px solid #e1e5e9;
            border-radius: 12px;
            padding: 20px;
            background: white;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin: 10px 0;
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
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
    }

    const page = await this.browser.newPage();
    
    try {
      // Set shorter timeout
      page.setDefaultTimeout(10000);
      
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      
      // Wait for images to load with timeout
      await Promise.race([
        page.evaluate(() => {
          return Promise.all(
            Array.from((document as any).images)
              .filter((img: any) => !img.complete)
              .map((img: any) => new Promise(resolve => {
                img.onload = img.onerror = resolve;
              }))
          );
        }),
        new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
      ]);
      
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