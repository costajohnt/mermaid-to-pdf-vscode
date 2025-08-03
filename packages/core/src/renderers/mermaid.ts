/**
 * Mermaid Diagram Renderer
 * 
 * Renders Mermaid diagrams to images using Puppeteer
 */

import puppeteer from 'puppeteer';
import { BrowserPool } from '../browser';
import {
  DiagramRenderer,
  DiagramInfo,
  RenderedDiagram,
  RenderOptions,
  ValidationResult,
  ConversionError
} from '../types';

export class MermaidRenderer implements DiagramRenderer {
  supportedTypes = ['mermaid'];

  async render(diagram: DiagramInfo, options: RenderOptions = {}): Promise<RenderedDiagram> {
    const opts: Required<RenderOptions> = {
      format: options.format || 'png',
      width: options.width || 800,
      height: options.height || 600,
      theme: options.theme || 'light',
      backgroundColor: options.backgroundColor || (options.theme === 'dark' ? '#1e1e1e' : '#ffffff'),
      scale: options.scale || 1
    };

    try {
      const imageData = await this.renderToBuffer(diagram.code, opts);
      const dataUrl = `data:image/${opts.format};base64,${imageData.toString('base64')}`;

      return {
        info: diagram,
        imageData,
        format: opts.format,
        dimensions: {
          width: opts.width,
          height: opts.height
        },
        dataUrl
      };

    } catch (error) {
      throw new ConversionError(
        `Failed to render Mermaid diagram: ${error instanceof Error ? error.message : String(error)}`,
        'MERMAID_RENDER_FAILED',
        { diagramId: diagram.id, originalError: error }
      );
    }
  }

  async validate(code: string, type: string): Promise<ValidationResult> {
    if (type !== 'mermaid') {
      return {
        valid: false,
        errors: [`Unsupported diagram type: ${type}`],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic syntax validation
    if (!code.trim()) {
      errors.push('Diagram code is empty');
    }

    // Check for common mermaid diagram types
    const diagramTypes = [
      'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 
      'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie',
      'requirementDiagram', 'gitGraph'
    ];

    const hasValidType = diagramTypes.some(type => 
      code.trim().toLowerCase().startsWith(type.toLowerCase())
    );

    if (!hasValidType) {
      warnings.push('Diagram type not recognized, but may still be valid');
    }

    // Check for potential syntax issues
    if (code.includes('```')) {
      errors.push('Diagram code should not include markdown code block markers');
    }

    // Try to render for more thorough validation
    try {
      await this.renderToBuffer(code, { 
        format: 'png', 
        width: 100, 
        height: 100,
        theme: 'light',
        backgroundColor: '#ffffff',
        scale: 1 
      });
    } catch (error) {
      errors.push(`Render validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Render mermaid code to image buffer
   */
  private async renderToBuffer(code: string, options: Required<RenderOptions>): Promise<Buffer> {
    const browserPool = BrowserPool.getInstance();
    const browser = await browserPool.getBrowser();

    try {
      const page = await browser.newPage();

      // Set viewport
      await page.setViewport({
        width: options.width,
        height: options.height,
        deviceScaleFactor: options.scale
      });

      // Create HTML with Mermaid
      const html = this.createMermaidHTML(code, options);
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Wait for mermaid to render
      await page.waitForSelector('#mermaid-diagram svg, #mermaid-diagram .error', {
        timeout: 10000
      });

      // Check for errors
      const errorElement = await page.$('#mermaid-diagram .error');
      if (errorElement) {
        const errorText = await page.evaluate((el: any) => el.textContent, errorElement);
        throw new Error(`Mermaid rendering error: ${errorText}`);
      }

      // Get diagram element
      const diagramElement = await page.$('#mermaid-diagram');
      if (!diagramElement) {
        throw new Error('Diagram element not found');
      }

      // Take screenshot
      const imageBuffer = await diagramElement.screenshot({
        type: options.format === 'jpg' ? 'jpeg' : options.format as any,
        omitBackground: options.backgroundColor === 'transparent'
      });

      return Buffer.from(imageBuffer);

    } finally {
      await browserPool.releaseBrowser(browser);
    }
  }

  /**
   * Create HTML template for Mermaid rendering
   */
  private createMermaidHTML(code: string, options: Required<RenderOptions>): string {
    const theme = options.theme === 'dark' ? 'dark' : 'default';
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: ${options.backgroundColor};
            font-family: Arial, sans-serif;
        }
        #mermaid-diagram {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .error {
            color: red;
            font-size: 14px;
            background: #ffe6e6;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #ff9999;
        }
    </style>
</head>
<body>
    <div id="mermaid-diagram">
        <div class="mermaid">
${code}
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: '${theme}',
            themeVariables: {
                primaryColor: '${options.theme === 'dark' ? '#4f94cd' : '#0066cc'}',
                primaryTextColor: '${options.theme === 'dark' ? '#ffffff' : '#000000'}',
                primaryBorderColor: '${options.theme === 'dark' ? '#ffffff' : '#000000'}',
                lineColor: '${options.theme === 'dark' ? '#ffffff' : '#000000'}',
                background: '${options.backgroundColor}'
            },
            flowchart: {
                htmlLabels: true,
                curve: 'basis'
            },
            sequence: {
                diagramMarginX: 50,
                diagramMarginY: 10,
                actorMargin: 50,
                width: 150,
                height: 65,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35
            }
        });

        // Error handling
        window.addEventListener('error', function(e) {
            document.getElementById('mermaid-diagram').innerHTML = 
                '<div class="error">Mermaid render error: ' + e.message + '</div>';
        });

        // Custom error handling for mermaid
        mermaid.parseError = function(err, hash) {
            document.getElementById('mermaid-diagram').innerHTML = 
                '<div class="error">Mermaid parse error: ' + err + '</div>';
        };
    </script>
</body>
</html>`;
  }
}