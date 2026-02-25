// src/converter.ts
import { promises as fs } from 'fs';
import { marked } from 'marked';
import puppeteer, { type Browser } from 'puppeteer';
import { renderMermaidToSvg } from './mermaidRenderer.js';
import { DiagramCache } from './diagramCache.js';
import {
    ConversionOptions,
    DEFAULT_OPTIONS,
    PAGE_DIMENSIONS,
    PageDimensions,
    RenderedDiagram,
    MIN_SCALE,
    BROWSER_ARGS,
} from './types.js';

/** DPI for mm-to-px conversion (CSS reference pixel) */
const DPI = 96;

/** Mermaid fenced code block pattern */
const MERMAID_REGEX = /```mermaid\r?\n([\s\S]*?)```/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a CSS margin string (e.g. "15mm", "1in", "2cm", "96px") to pixels.
 */
function marginToPx(value: string): number {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)(mm|cm|in|px)$/);
    if (!match) {
        throw new Error(
            `Invalid margin value "${value}". Expected a number followed by a unit (mm, cm, in, px). Example: "15mm".`
        );
    }
    const num = parseFloat(match[1]);
    const unit = match[2];
    switch (unit) {
        case 'mm': return num * (DPI / 25.4);
        case 'cm': return num * (DPI / 2.54);
        case 'in': return num * DPI;
        case 'px': return num;
        default:   return num * (DPI / 25.4); // unreachable but satisfies TS
    }
}

/**
 * Compute usable page dimensions in pixels from options.
 */
function computePageDimensions(options: ConversionOptions): PageDimensions {
    const pageDef = PAGE_DIMENSIONS[options.pageSize];
    const pageWidth  = pageDef.widthMm  * (DPI / 25.4);
    const pageHeight = pageDef.heightMm * (DPI / 25.4);

    const marginLeft   = marginToPx(options.margins.left);
    const marginRight  = marginToPx(options.margins.right);
    const marginTop    = marginToPx(options.margins.top);
    const marginBottom = marginToPx(options.margins.bottom);

    return {
        pageWidth,
        pageHeight,
        contentWidth:  Math.max(pageWidth  - marginLeft - marginRight, 1),
        contentHeight: Math.max(pageHeight - marginTop  - marginBottom, 1),
    };
}

/**
 * Rewrite an SVG string so that its `width` and `height`
 * attributes reflect the desired display dimensions while preserving
 * the renderer's viewBox.
 */
function resizeSvg(svgString: string, displayWidth: number, displayHeight: number): string {
    let svg = svgString;
    const widthPattern = /(<svg[^>]*?)\bwidth="[^"]*"/;
    const heightPattern = /(<svg[^>]*?)\bheight="[^"]*"/;

    if (!widthPattern.test(svg)) {
        console.error('Warning: SVG has no width attribute to resize. Diagram may render at wrong size.');
    } else {
        svg = svg.replace(widthPattern, `$1width="${displayWidth}"`);
    }

    if (!heightPattern.test(svg)) {
        console.error('Warning: SVG has no height attribute to resize. Diagram may render at wrong size.');
    } else {
        svg = svg.replace(heightPattern, `$1height="${displayHeight}"`);
    }

    return svg;
}

/**
 * Escape HTML special characters in a string.
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// HTML document template
// ---------------------------------------------------------------------------

function buildHtmlDocument(bodyHtml: string, theme: 'light' | 'dark'): string {
    const isDark = theme === 'dark';
    const bg        = isDark ? '#0d1117' : '#ffffff';
    const fg        = isDark ? '#e6edf3' : '#24292e';
    const fgHeading = isDark ? '#f0f6fc' : '#1f2328';
    const border    = isDark ? '#30363d' : '#d1d9e0';
    const codeBg    = isDark ? '#161b22' : '#f6f8fa';
    const bqColor   = isDark ? '#8b949e' : '#656d76';
    const linkColor = isDark ? '#58a6ff' : '#0969da';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: ${fg};
            background: ${bg};
            padding: 0;
            max-width: 100%;
            margin: 0;
        }

        h1, h2, h3, h4, h5, h6 {
            margin: 24px 0 16px 0;
            font-weight: 600;
            line-height: 1.25;
            color: ${fgHeading};
        }

        h1 {
            font-size: 2em;
            border-bottom: 1px solid ${border};
            padding-bottom: 0.3em;
        }
        h2 {
            font-size: 1.5em;
            border-bottom: 1px solid ${border};
            padding-bottom: 0.3em;
        }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1em; }
        h5 { font-size: 0.875em; }
        h6 { font-size: 0.85em; color: ${bqColor}; }

        p {
            margin: 0 0 16px 0;
            line-height: 1.6;
        }

        ul, ol {
            margin: 0 0 16px 0;
            padding-left: 2em;
        }

        li {
            margin: 4px 0;
        }

        pre {
            background: ${codeBg};
            border-radius: 6px;
            font-size: 85%;
            line-height: 1.45;
            overflow: auto;
            padding: 16px;
            margin: 0 0 16px 0;
            border: 1px solid ${border};
        }

        code {
            background: ${isDark ? 'rgba(110,118,129,0.4)' : 'rgba(175,184,193,0.2)'};
            border-radius: 6px;
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
            border-left: 0.25em solid ${border};
            color: ${bqColor};
            margin: 0 0 16px 0;
            padding: 0 1em;
        }

        table {
            border-collapse: collapse;
            border-spacing: 0;
            display: block;
            overflow: auto;
            width: max-content;
            max-width: 100%;
            margin: 0 0 16px 0;
        }

        table th, table td {
            border: 1px solid ${border};
            padding: 6px 13px;
        }

        table th {
            font-weight: 600;
            background: ${codeBg};
        }

        table tr:nth-child(2n) {
            background: ${codeBg};
        }

        hr {
            height: 0.25em;
            padding: 0;
            margin: 24px 0;
            background-color: ${border};
            border: 0;
        }

        a {
            color: ${linkColor};
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        strong { font-weight: 600; }
        em { font-style: italic; }

        img {
            max-width: 100%;
            box-sizing: border-box;
        }

        /* ---- Mermaid diagram containers ---- */
        .mermaid-diagram {
            text-align: center;
            margin: 20px 0;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .mermaid-diagram.allow-break {
            page-break-inside: auto;
            break-inside: auto;
        }

        .mermaid-diagram svg {
            display: inline-block;
        }

        /* ---- Error fallback box ---- */
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
            border-color: #ffeaa7;
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
${bodyHtml}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Converter class
// ---------------------------------------------------------------------------

export interface ConvertFileResult {
    diagramCount: number;
    fileSize: number;
}

export class Converter {
    private options: ConversionOptions;
    private cache: DiagramCache;

    constructor(options: Partial<ConversionOptions> = {}) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            margins: { ...DEFAULT_OPTIONS.margins, ...(options.margins ?? {}) },
        };

        // Validate margin format eagerly
        for (const [side, value] of Object.entries(this.options.margins)) {
            if (!/^\d+(?:\.\d+)?(mm|cm|in|px)$/.test(value.trim())) {
                throw new Error(
                    `Invalid margin "${side}": "${value}". Expected a number with unit (mm, cm, in, px).`
                );
            }
        }

        this.cache = new DiagramCache();
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Convert a markdown file to PDF on disk.
     */
    async convertFile(inputPath: string, outputPath: string): Promise<ConvertFileResult> {
        const markdown = await fs.readFile(inputPath, 'utf-8');
        const { pdfBuffer, diagramCount } = await this._convert(markdown);
        await fs.writeFile(outputPath, pdfBuffer);
        return { diagramCount, fileSize: pdfBuffer.length };
    }

    /**
     * Convert a markdown string to a PDF Buffer.
     */
    async convertString(markdown: string): Promise<Buffer> {
        const { pdfBuffer } = await this._convert(markdown);
        return pdfBuffer;
    }

    // ------------------------------------------------------------------
    // Core pipeline
    // ------------------------------------------------------------------

    private async _convert(markdown: string): Promise<{ pdfBuffer: Buffer; diagramCount: number }> {
        if (markdown.length > 10 * 1024 * 1024) {
            throw new Error('Markdown content too large. Maximum size is 10 MB.');
        }

        const dims = computePageDimensions(this.options);

        // 1. Find all mermaid code blocks
        const matches = [...markdown.matchAll(MERMAID_REGEX)];
        let diagramCount = 0;

        // 2. Render each diagram to SVG and replace in markdown
        //    Process matches in reverse index order so that splicing doesn't
        //    shift the positions of earlier matches. This also correctly handles
        //    duplicate mermaid code blocks (string.replace would only hit the first).
        let processed = markdown;
        const mermaidTheme = this.options.theme === 'dark' ? 'dark' : 'default';
        for (let i = matches.length - 1; i >= 0; i--) {
            const match = matches[i];
            const fullMatch = match[0];
            const mermaidCode = match[1].trim();
            const start = match.index!;
            const end = start + fullMatch.length;

            try {
                // Check cache first (keyed by code + theme)
                let rendered: RenderedDiagram | null = this.cache.get(mermaidCode, mermaidTheme);
                if (!rendered) {
                    rendered = await renderMermaidToSvg(mermaidCode, mermaidTheme);
                    this.cache.set(mermaidCode, rendered, mermaidTheme);
                }

                // Width-first scaling
                let scale = Math.min(dims.contentWidth / rendered.width, 1.0); // never upscale
                if (scale < MIN_SCALE) scale = MIN_SCALE; // readability floor

                const displayWidth  = Math.round(rendered.width  * scale);
                const displayHeight = Math.round(rendered.height * scale);

                // Determine if the diagram is taller than the page content area
                const allowBreak = displayHeight > dims.contentHeight;
                const breakClass = allowBreak ? ' allow-break' : '';

                // Rewrite SVG with display dimensions, preserving renderer's viewBox
                const sized = resizeSvg(
                    rendered.svgString,
                    displayWidth,
                    displayHeight,
                );

                const replacement = `<div class="mermaid-diagram${breakClass}">${sized}</div>`;
                processed = processed.slice(0, start) + replacement + processed.slice(end);
                diagramCount++;
            } catch (err) {
                // Render failure: embed error box and continue
                const message = err instanceof Error ? err.message : String(err);
                console.error(`Warning: Mermaid diagram failed to render: ${message}`);
                const errorBox = [
                    '<div class="mermaid-error">',
                    '  <h4>Mermaid Diagram (Render Failed)</h4>',
                    `  <pre><code>${escapeHtml(mermaidCode)}</code></pre>`,
                    `  <p><em>Error: ${escapeHtml(message)}</em></p>`,
                    '</div>',
                ].join('\n');
                processed = processed.slice(0, start) + errorBox + processed.slice(end);
            }
        }

        // 3. Convert processed markdown to HTML via marked (GFM)
        const bodyHtml = await marked(processed, { gfm: true });
        const fullHtml = buildHtmlDocument(bodyHtml, this.options.theme);

        // 4. Generate PDF with a dedicated Puppeteer browser instance
        const pdfBuffer = await this._generatePdf(fullHtml);

        return { pdfBuffer, diagramCount };
    }

    // ------------------------------------------------------------------
    // PDF generation (own browser, separate from the renderer singleton)
    // ------------------------------------------------------------------

    private async _generatePdf(html: string): Promise<Buffer> {
        let browser: Browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [...BROWSER_ARGS],
            });
        } catch (launchErr) {
            const msg = launchErr instanceof Error ? launchErr.message : String(launchErr);
            throw new Error(`Failed to launch browser for PDF generation: ${msg}`);
        }

        try {
            const page = await browser.newPage();

            await page.setContent(html, {
                waitUntil: ['domcontentloaded', 'networkidle0'],
            });

            // Wait for SVGs to paint (two rAF frames)
            await page.evaluate(
                () => new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                ),
            );

            const pdfUint8 = await page.pdf({
                format: this.options.pageSize,
                printBackground: true,
                margin: {
                    top:    this.options.margins.top,
                    right:  this.options.margins.right,
                    bottom: this.options.margins.bottom,
                    left:   this.options.margins.left,
                },
            });

            return Buffer.from(pdfUint8);
        } finally {
            try {
                await browser.close();
            } catch (closeErr) {
                console.error('Warning: Failed to close PDF browser:', closeErr instanceof Error ? closeErr.message : String(closeErr));
            }
        }
    }
}
