"use strict";
/**
 * PDF Output Generator
 *
 * Generates PDF files from parsed markdown content with rendered diagrams
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDFGenerator = void 0;
const marked_1 = require("marked");
const browser_1 = require("../browser");
const types_1 = require("../types");
class PDFGenerator {
    format = 'pdf';
    name = 'PDF Generator';
    description = 'Generate PDF files with embedded diagrams';
    optionsSchema = {
        quality: { type: 'string', enum: ['draft', 'standard', 'high'], default: 'standard' },
        theme: { type: 'string', enum: ['light', 'dark', 'auto'], default: 'light' },
        pageSize: { type: 'string', enum: ['A4', 'Letter', 'Legal'], default: 'A4' },
        margins: {
            type: 'object',
            properties: {
                top: { type: 'string', default: '10mm' },
                right: { type: 'string', default: '10mm' },
                bottom: { type: 'string', default: '10mm' },
                left: { type: 'string', default: '10mm' }
            }
        },
        includeBackground: { type: 'boolean', default: true },
        landscape: { type: 'boolean', default: false }
    };
    async generate(content, diagrams, options = {}) {
        const opts = {
            quality: options.quality || 'standard',
            theme: options.theme || 'light',
            pageSize: options.pageSize || 'A4',
            margins: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm',
                ...options.margins
            },
            includeBackground: options.includeBackground !== false,
            landscape: options.landscape || false
        };
        try {
            // Generate HTML content
            const html = await this.generateHTML(content, diagrams, opts);
            // Convert to PDF
            const pdfBuffer = await this.htmlToPDF(html, opts);
            return {
                format: 'pdf',
                data: pdfBuffer,
                mimeType: 'application/pdf',
                metadata: {
                    size: pdfBuffer.length,
                    diagrams: diagrams.length
                }
            };
        }
        catch (error) {
            throw new types_1.ConversionError(`PDF generation failed: ${error instanceof Error ? error.message : String(error)}`, 'PDF_GENERATION_FAILED', { originalError: error });
        }
    }
    /**
     * Generate HTML content with embedded diagrams
     */
    async generateHTML(content, diagrams, options) {
        // Create diagram lookup map
        const diagramMap = new Map();
        diagrams.forEach(diagram => {
            diagramMap.set(diagram.info.id, diagram);
        });
        // Convert content sections to markdown
        let markdown = '';
        for (const section of content.sections) {
            if (section.type === 'diagram') {
                // Find corresponding rendered diagram
                const diagram = diagrams.find(d => d.info.code === section.content);
                if (diagram) {
                    markdown += `\n<div class="mermaid-diagram">`;
                    markdown += `<img src="${diagram.dataUrl}" alt="Mermaid Diagram" style="max-width: 90%; max-height: 400px; height: auto; width: auto; display: block; margin: 5px auto; object-fit: contain;" />`;
                    markdown += `</div>\n\n`;
                }
            }
            else {
                markdown += section.markdown + '\n\n';
            }
        }
        // Convert markdown to HTML
        const htmlContent = await (0, marked_1.marked)(markdown);
        // Generate complete HTML document
        return this.createHTMLTemplate(htmlContent, content.title || 'Document', options);
    }
    /**
     * Create HTML template with styling
     */
    createHTMLTemplate(htmlContent, title, options) {
        const isDark = options.theme === 'dark';
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: ${isDark ? '#e1e4e8' : '#24292e'};
            background-color: ${isDark ? '#0d1117' : '#ffffff'};
            max-width: none;
            margin: 0;
            padding: 20px;
            font-size: 16px;
        }

        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
            color: ${isDark ? '#f0f6fc' : '#1f2328'};
        }

        h1 { font-size: 2em; border-bottom: 1px solid ${isDark ? '#30363d' : '#d1d9e0'}; padding-bottom: 10px; }
        h2 { font-size: 1.5em; border-bottom: 1px solid ${isDark ? '#30363d' : '#d1d9e0'}; padding-bottom: 8px; }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1em; }
        h5 { font-size: 0.875em; }
        h6 { font-size: 0.85em; color: ${isDark ? '#8b949e' : '#656d76'}; }

        p {
            margin-top: 0;
            margin-bottom: 16px;
        }

        pre {
            background-color: ${isDark ? '#161b22' : '#f6f8fa'};
            border-radius: 6px;
            padding: 16px;
            overflow: auto;
            font-size: 85%;
            line-height: 1.45;
            border: 1px solid ${isDark ? '#30363d' : '#d1d9e0'};
        }

        code {
            background-color: ${isDark ? '#161b22' : '#f6f8fa'};
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 85%;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }

        pre code {
            background-color: transparent;
            padding: 0;
            border-radius: 0;
        }

        table {
            border-spacing: 0;
            border-collapse: collapse;
            margin-top: 0;
            margin-bottom: 16px;
            width: 100%;
        }

        table th,
        table td {
            padding: 6px 13px;
            border: 1px solid ${isDark ? '#30363d' : '#d1d9e0'};
        }

        table tr {
            background-color: ${isDark ? '#0d1117' : '#ffffff'};
            border-top: 1px solid ${isDark ? '#30363d' : '#d1d9e0'};
        }

        table tr:nth-child(2n) {
            background-color: ${isDark ? '#161b22' : '#f6f8fa'};
        }

        table th {
            font-weight: 600;
            background-color: ${isDark ? '#21262d' : '#f6f8fa'};
        }

        ul, ol {
            margin-top: 0;
            margin-bottom: 16px;
            padding-left: 2em;
        }

        li {
            margin-bottom: 4px;
        }

        blockquote {
            margin: 0;
            padding: 0 1em;
            color: ${isDark ? '#8b949e' : '#656d76'};
            border-left: 4px solid ${isDark ? '#30363d' : '#d1d9e0'};
            margin-bottom: 16px;
        }

        hr {
            height: 4px;
            margin: 24px 0;
            background-color: ${isDark ? '#30363d' : '#d1d9e0'};
            border: 0;
        }

        .mermaid-diagram {
            text-align: center;
            margin: 20px 0;
            page-break-inside: avoid;
        }

        .mermaid-diagram img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
        }

        .mermaid-error {
            background-color: ${isDark ? '#2d1b14' : '#fff5f5'};
            border: 1px solid ${isDark ? '#f85149' : '#f87171'};
            border-radius: 6px;
            padding: 16px;
            margin: 16px 0;
        }

        .mermaid-error h4 {
            color: ${isDark ? '#f85149' : '#dc2626'};
            margin-top: 0;
        }

        @media print {
            body {
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
            }
            
            .mermaid-diagram {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            
            h1, h2, h3 {
                page-break-after: avoid;
                break-after: avoid;
            }
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;
    }
    /**
     * Convert HTML to PDF using Puppeteer
     */
    async htmlToPDF(html, options) {
        const browserPool = browser_1.BrowserPool.getInstance();
        const browser = await browserPool.getBrowser();
        try {
            const page = await browser.newPage();
            // Set viewport for consistent rendering
            await page.setViewport({
                width: 1200,
                height: 1600,
                deviceScaleFactor: options.quality === 'high' ? 2 : 1
            });
            // Set content and wait for images to load
            await page.setContent(html, { waitUntil: 'networkidle0' });
            // Generate PDF
            const pdfBuffer = await page.pdf({
                format: options.pageSize.toLowerCase(),
                margin: options.margins,
                printBackground: options.includeBackground,
                landscape: options.landscape,
                preferCSSPageSize: true
            });
            return Buffer.from(pdfBuffer);
        }
        finally {
            await browserPool.releaseBrowser(browser);
        }
    }
}
exports.PDFGenerator = PDFGenerator;
//# sourceMappingURL=pdf.js.map