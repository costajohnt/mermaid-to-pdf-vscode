// src/converter.ts
import { promises as fs, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';
import { Marked } from 'marked';
import HTMLtoDOCX from 'html-to-docx';
import markedKatex from 'marked-katex-extension';
import { createRenderSession, type MermaidRenderSession } from './mermaidRenderer.js';
import { DiagramCache } from './diagramCache.js';
import { getBrowser } from './browserManager.js';
import {
    ConversionOptions,
    DEFAULT_OPTIONS,
    PAGE_DIMENSIONS,
    PageDimensions,
    RenderedDiagram,
    PDF_TIMEOUT,
    VALID_THEMES,
    VALID_PAGE_SIZES,
    VALID_FORMATS,
} from './types.js';

/** DPI for mm-to-px conversion (CSS reference pixel) */
const DPI = 96;

/** Maximum number of concurrent render sessions (Puppeteer pages) for diagrams */
const MAX_RENDER_CONCURRENCY = 4;

// ---------------------------------------------------------------------------
// KaTeX CSS with inlined fonts (lazy-loaded, cached)
// ---------------------------------------------------------------------------

let _katexCssCache: string | null = null;

/**
 * Load KaTeX CSS and inline all font references as base64 data URIs.
 * Uses only woff2 format for minimal size. The result is cached.
 */
function getKatexCss(): string {
    if (_katexCssCache !== null) { return _katexCssCache; }

    let katexCssPath: string;
    try {
        const req = createRequire(import.meta.url);
        katexCssPath = req.resolve('katex/dist/katex.min.css');
    } catch (err) {
        throw new Error(
            `Failed to locate KaTeX CSS. The "katex" package may not be installed correctly. ` +
            `Run "npm install katex" and try again. Original error: ${err instanceof Error ? err.message : String(err)}`
        );
    }

    const katexFontsDir = join(dirname(katexCssPath), 'fonts');
    let css: string;
    try {
        css = readFileSync(katexCssPath, 'utf-8');
    } catch (err) {
        throw new Error(
            `Failed to read KaTeX CSS at "${katexCssPath}": ${err instanceof Error ? err.message : String(err)}`
        );
    }

    // Replace relative font URLs with base64 data URIs.
    // Only inline woff2 (modern, small) and drop woff/ttf fallbacks.
    let fontFailures = 0;
    css = css.replace(
        /url\(fonts\/(KaTeX_[^)]+\.woff2)\)\s*format\("woff2"\)(?:,url\(fonts\/[^)]+\)\s*format\("[^"]+"\))*/g,
        (_match: string, woff2File: string) => {
            const fontPath = join(katexFontsDir, woff2File);
            try {
                const fontData = readFileSync(fontPath);
                const base64 = fontData.toString('base64');
                return `url(data:font/woff2;base64,${base64}) format("woff2")`;
            } catch (err) {
                fontFailures++;
                console.error(`Warning: Failed to inline KaTeX font "${woff2File}": ${err instanceof Error ? err.message : String(err)}`);
                return _match;
            }
        },
    );

    if (fontFailures > 0) {
        console.error(`Warning: ${fontFailures} KaTeX font(s) could not be inlined. Math rendering may be degraded.`);
        // Do not cache broken CSS so subsequent conversions can retry
        return css;
    }
    _katexCssCache = css;
    return css;
}

/**
 * @deprecated No longer needed -- browser is managed by browserManager.
 * Kept for backward compatibility; callers that still call closePdfBrowser()
 * (tests, CLI) will simply no-op.
 */
export async function closePdfBrowser(): Promise<void> {
    // No-op: the shared browser in browserManager.ts is closed via
    // closeBrowser() from mermaidRenderer.ts / browserManager.ts.
}

/** Mermaid fenced code block pattern — optionally captures alt="..." text after the language tag */
const MERMAID_REGEX = /```mermaid(?:\s+alt="([^"]*)")?\r?\n([\s\S]*?)```/g;

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
 * Build a <style> block for custom font overrides.
 * Falls back gracefully via CSS font stacks — if the specified font is
 * not available the browser picks the next in the stack.
 */
function buildFontStyle(font?: string, codeFont?: string): string {
    if (!font && !codeFont) { return ''; }
    const rules: string[] = [];
    if (font) {
        // Prepend the user font to the default stack so it falls back gracefully
        rules.push(`        body { font-family: '${font}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }`);
    }
    if (codeFont) {
        rules.push(`        code, pre { font-family: '${codeFont}', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }`);
    }
    return `\n    <style>\n        /* Font overrides */\n${rules.join('\n')}\n    </style>`;
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
// HTML post-processing
// ---------------------------------------------------------------------------

/**
 * Absorb headings that immediately precede a `.mermaid-diagram` div.
 *
 * Chromium's PDF renderer ignores CSS `break-after: avoid` when the next
 * block is taller than a page, so heading elements placed before (or even
 * inside) the diagram container get orphaned.  The only reliable fix is to
 * remove the heading element entirely and render its text via a CSS
 * `::before` pseudo-element, which is an inseparable part of the parent
 * box and cannot be page-broken away from it.
 *
 * The heading text and level are stored as `data-heading` and
 * `data-heading-level` attributes on the diagram container (div or figure).
 */
function attachHeadingsToDiagrams(html: string): string {
    return html.replace(
        /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>\s*(<(?:div|figure)[^>]*class="mermaid-diagram[^"]*")/g,
        (_match, level, text, divStart) => {
            // Strip any inner HTML tags to get plain text for the data attribute
            const plain = text.replace(/<[^>]+>/g, '').trim();
            const escaped = plain.replace(/"/g, '&quot;');
            return `${divStart} data-heading="${escaped}" data-heading-level="${level}"`;
        },
    );
}

// ---------------------------------------------------------------------------
// HTML document template
// ---------------------------------------------------------------------------

interface HtmlDocumentOptions {
    theme: 'light' | 'dark';
    customCss?: string;
    font?: string;
    codeFont?: string;
    katexCss?: string;
    lang?: string;
}

function buildHtmlDocument(bodyHtml: string, opts: HtmlDocumentOptions): string {
    const { theme, customCss, font, codeFont, katexCss, lang = 'en' } = opts;
    const isDark = theme === 'dark';
    const bg        = isDark ? '#0d1117' : '#ffffff';
    const fg        = isDark ? '#e6edf3' : '#24292e';
    const fgHeading = isDark ? '#f0f6fc' : '#1f2328';
    const border    = isDark ? '#30363d' : '#d1d9e0';
    const codeBg    = isDark ? '#161b22' : '#f6f8fa';
    const bqColor   = isDark ? '#8b949e' : '#656d76';
    const linkColor = isDark ? '#58a6ff' : '#0969da';

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; img-src data:; font-src data:">
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
            break-after: avoid;
            page-break-after: avoid;
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
            max-width: 100%;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .mermaid-diagram.allow-break {
            page-break-inside: auto;
            break-inside: auto;
        }

        .mermaid-diagram svg {
            display: inline-block;
            max-width: 100%;
            height: auto;
        }

        /* Heading rendered as ::before pseudo-element so Chromium's PDF
           renderer cannot page-break it away from the diagram content. */
        .mermaid-diagram[data-heading]::before {
            content: attr(data-heading);
            display: block;
            text-align: left;
            font-weight: 600;
            line-height: 1.25;
            color: ${fgHeading};
            margin: 0 0 16px 0;
        }
        .mermaid-diagram[data-heading-level="1"]::before {
            font-size: 2em;
            border-bottom: 1px solid ${border};
            padding-bottom: 0.3em;
        }
        .mermaid-diagram[data-heading-level="2"]::before {
            font-size: 1.5em;
            border-bottom: 1px solid ${border};
            padding-bottom: 0.3em;
        }
        .mermaid-diagram[data-heading-level="3"]::before { font-size: 1.25em; }
        .mermaid-diagram[data-heading-level="4"]::before { font-size: 1em; }
        .mermaid-diagram[data-heading-level="5"]::before { font-size: 0.875em; }
        .mermaid-diagram[data-heading-level="6"]::before { font-size: 0.85em; color: ${bqColor}; }

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

        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }

        @media print {
            body {
                padding: 0;
                max-width: none;
            }
        }
    </style>${katexCss ? `
    <style>
        /* KaTeX math styles */
${katexCss}
    </style>` : ''}${buildFontStyle(font, codeFont)}${customCss ? `\n    <style>\n        /* User custom CSS */\n${customCss.split('\n').map(l => '        ' + l).join('\n')}\n    </style>` : ''}
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
    /** Number of mermaid diagrams successfully rendered */
    diagramCount: number;
    /** Size of the generated output in bytes */
    fileSize: number;
}

export interface ConvertStringResult extends ConvertFileResult {
    /** The generated output content as a Buffer (PDF, HTML, or DOCX depending on format) */
    outputBuffer: Buffer;
    /** The generated HTML content (present when format is 'html') */
    htmlString?: string;
}

export class Converter {
    private options: ConversionOptions;
    private cache: DiagramCache;

    constructor(options: Partial<ConversionOptions> = {}) {
        // Validate theme if provided
        if (options.theme !== undefined &&
            !(VALID_THEMES as readonly string[]).includes(options.theme)) {
            throw new Error(
                `Invalid theme "${options.theme}". Must be one of: ${VALID_THEMES.join(', ')}.`
            );
        }

        // Validate pageSize if provided
        if (options.pageSize !== undefined &&
            !(VALID_PAGE_SIZES as readonly string[]).includes(options.pageSize)) {
            throw new Error(
                `Invalid pageSize "${options.pageSize}". Must be one of: ${VALID_PAGE_SIZES.join(', ')}.`
            );
        }

        // Validate format if provided
        if (options.format !== undefined &&
            !(VALID_FORMATS as readonly string[]).includes(options.format)) {
            throw new Error(
                `Invalid format "${options.format}". Must be one of: ${VALID_FORMATS.join(', ')}.`
            );
        }

        // Validate lang (BCP 47) if provided — prevents HTML injection via library API
        if (options.lang !== undefined &&
            !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$/.test(options.lang)) {
            throw new Error(
                `Invalid lang "${options.lang}". Must be a valid BCP 47 code (e.g. "en", "fr-FR").`
            );
        }

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
     * Convert a markdown file to PDF, HTML, or DOCX on disk.
     */
    async convertFile(inputPath: string, outputPath: string): Promise<ConvertFileResult> {
        const markdown = await fs.readFile(inputPath, 'utf-8');
        const result = await this._convert(markdown);
        if (result.htmlString !== undefined) {
            const buf = Buffer.from(result.htmlString, 'utf-8');
            await fs.writeFile(outputPath, buf);
            return { diagramCount: result.diagramCount, fileSize: buf.length };
        }
        await fs.writeFile(outputPath, result.outputBuffer);
        return { diagramCount: result.diagramCount, fileSize: result.outputBuffer.length };
    }

    /**
     * Convert a markdown string to a PDF, HTML, or DOCX Buffer with metadata.
     */
    async convertString(markdown: string): Promise<ConvertStringResult> {
        return this._convert(markdown);
    }

    // ------------------------------------------------------------------
    // Core pipeline
    // ------------------------------------------------------------------

    private async _convert(markdown: string): Promise<ConvertStringResult> {
        if (markdown.length > 10 * 1024 * 1024) {
            throw new Error('Markdown content too large. Maximum size is 10 MB.');
        }

        const dims = computePageDimensions(this.options);

        // 1. Find all mermaid code blocks
        const matches = [...markdown.matchAll(MERMAID_REGEX)];
        let diagramCount = 0;

        // 2. Render diagrams to SVG concurrently, then replace in markdown.
        //    a) Forward pass: collect unique diagram codes that need rendering.
        //    b) Render all unique diagrams concurrently (limited concurrency).
        //    c) Reverse-index pass: splice rendered SVGs into the markdown.

        const mermaidTheme = this.options.theme === 'dark' ? 'dark' : 'default';

        // (a) Collect unique diagram codes that are not already cached
        const uncachedCodes = new Set<string>();
        for (const match of matches) {
            const code = match[2].trim();
            if (!this.cache.get(code, mermaidTheme)) {
                uncachedCodes.add(code);
            }
        }

        // (b) Render uncached diagrams using a pool of render sessions.
        //     Each session owns one Puppeteer page with mermaid pre-loaded.
        //     For small batches (<=2 diagrams), a single session is faster
        //     because session setup has non-trivial overhead. For larger
        //     batches, multiple sessions render diagrams in parallel.
        //
        //     renderErrors is populated here and read in phase (c) to provide
        //     meaningful error messages in the fallback error box.
        const renderErrors = new Map<string, Error>();

        if (uncachedCodes.size > 0) {
            const codes = [...uncachedCodes];
            // Only use concurrency when there are enough diagrams to justify
            // the overhead of creating multiple sessions (each ~150ms setup).
            const concurrency = codes.length <= 2
                ? 1
                : Math.min(codes.length, MAX_RENDER_CONCURRENCY);

            // Create sessions one at a time so that already-created sessions
            // are cleaned up if a later creation fails (avoids resource leaks).
            const sessions: MermaidRenderSession[] = [];
            try {
                for (let i = 0; i < concurrency; i++) {
                    sessions.push(await createRenderSession(mermaidTheme));
                }

                // Distribute work across sessions via a shared index counter.
                // JS is single-threaded so the increment between await points
                // is safe without explicit synchronization.
                let nextIdx = 0;
                const renderResults = new Map<string, RenderedDiagram | Error>();

                await Promise.all(
                    sessions.map(async (session) => {
                        while (true) {
                            const idx = nextIdx++;
                            if (idx >= codes.length) { break; }
                            const code = codes[idx];
                            try {
                                const rendered = await session.render(code);
                                renderResults.set(code, rendered);
                            } catch (err) {
                                renderResults.set(code, err instanceof Error ? err : new Error(String(err)));
                            }
                        }
                    }),
                );

                // Populate cache with successful renders; collect errors for phase (c)
                for (const [code, result] of renderResults) {
                    if (result instanceof Error) {
                        renderErrors.set(code, result);
                    } else {
                        this.cache.set(code, result, mermaidTheme);
                    }
                }
            } finally {
                // Close all sessions (including partially-created pools)
                await Promise.all(sessions.map(s => s.close()));
            }
        }

        // (c) Replace mermaid code blocks with rendered SVGs (reverse order
        //     so splice positions remain valid).
        let processed = markdown;
        for (let i = matches.length - 1; i >= 0; i--) {
            const match = matches[i];
            const fullMatch = match[0];
            const altText = match[1] || undefined;
            const mermaidCode = match[2].trim();
            const start = match.index!;
            const end = start + fullMatch.length;

            const rendered: RenderedDiagram | null = this.cache.get(mermaidCode, mermaidTheme);
            if (rendered) {
                // Scale to fit page width (never upscale). No floor -- SVGs are
                // vector so they remain sharp at any scale in PDF viewers.  A
                // properly-scaled small diagram is far better than a clipped one.
                const scale = Math.min(dims.contentWidth / rendered.width, 1.0);

                const displayWidth  = Math.round(rendered.width  * scale);
                const displayHeight = Math.round(rendered.height * scale);

                // Determine if the diagram is taller than the page content area
                const allowBreak = displayHeight > dims.contentHeight;
                const breakClass = allowBreak ? ' allow-break' : '';

                // For very wide, short diagrams (e.g. flowchart LR), the scaled
                // height can be a tiny sliver. Set a minimum container height so
                // the diagram is still usable -- the SVG will be centered inside.
                const MIN_DIAGRAM_HEIGHT = 120; // px
                const containerStyle = displayHeight < MIN_DIAGRAM_HEIGHT
                    ? ` style="min-height:${MIN_DIAGRAM_HEIGHT}px;display:flex;align-items:center;justify-content:center"`
                    : '';

                // Rewrite SVG with display dimensions, preserving renderer's viewBox
                const sized = resizeSvg(
                    rendered.svgString,
                    displayWidth,
                    displayHeight,
                );

                let replacement: string;
                if (altText) {
                    const escapedAlt = escapeHtml(altText);
                    replacement = `<figure role="img" aria-label="${escapedAlt}" class="mermaid-diagram${breakClass}"${containerStyle}>${sized}<figcaption class="sr-only">${escapedAlt}</figcaption></figure>`;
                } else {
                    replacement = `<div class="mermaid-diagram${breakClass}"${containerStyle}>${sized}</div>`;
                }
                processed = processed.slice(0, start) + replacement + processed.slice(end);
                diagramCount++;
            } else {
                // Render failed (error was stored during concurrent phase)
                const renderErr = renderErrors.get(mermaidCode);
                const message = renderErr ? renderErr.message : 'Failed to render Mermaid diagram';
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
        //    Use a per-conversion Marked instance to avoid global state pollution.
        //    If math is enabled, register KaTeX on this instance only.
        const md = new Marked({ gfm: true });
        if (this.options.math) {
            md.use(markedKatex({ throwOnError: false }));
        }
        const bodyHtml = await md.parse(processed);

        // Warn if KaTeX produced parse errors (red error text in output)
        if (this.options.math) {
            const errorCount = (bodyHtml.match(/class="katex-error"/g) || []).length;
            if (errorCount > 0) {
                console.error(`Warning: ${errorCount} math expression(s) failed to parse and will appear as error text in the output.`);
            }
        }

        // 4. Resolve custom CSS (file path or inline string)
        let resolvedCss: string | undefined;
        if (this.options.customCss) {
            if (this.options.customCss.endsWith('.css')) {
                resolvedCss = await fs.readFile(this.options.customCss, 'utf-8');
            } else {
                resolvedCss = this.options.customCss;
            }
        }

        // 5. Move headings inside their adjacent diagram containers (div or figure)
        //    so Chromium's PDF renderer can't orphan them on a prior page.
        const adjustedHtml = attachHeadingsToDiagrams(bodyHtml);
        const fullHtml = buildHtmlDocument(adjustedHtml, {
            theme: this.options.theme,
            customCss: resolvedCss,
            font: this.options.font,
            codeFont: this.options.codeFont,
            katexCss: this.options.math ? getKatexCss() : undefined,
            lang: this.options.lang,
        });

        // 6. If format is 'html', return the self-contained HTML directly
        if (this.options.format === 'html') {
            const htmlBuffer = Buffer.from(fullHtml, 'utf-8');
            return {
                outputBuffer: htmlBuffer,
                htmlString: fullHtml,
                diagramCount,
                fileSize: htmlBuffer.length,
            };
        }

        // 6b. If format is 'docx', convert HTML to DOCX
        if (this.options.format === 'docx') {
            let docxArrayBuffer: ArrayBuffer;
            try {
                docxArrayBuffer = await HTMLtoDOCX(fullHtml, null, {
                    table: { row: { cantSplit: true } },
                    footer: true,
                    pageNumber: true,
                });
            } catch (err) {
                throw new Error(
                    `DOCX conversion failed: ${err instanceof Error ? err.message : String(err)}. ` +
                    `Try using --format pdf or --format html instead.`
                );
            }
            const docxBuffer = Buffer.from(docxArrayBuffer);
            return {
                outputBuffer: docxBuffer,
                diagramCount,
                fileSize: docxBuffer.length,
            };
        }

        // 7. Generate PDF with the shared Puppeteer browser instance
        const outputBuffer = await this._generatePdf(fullHtml);

        return { outputBuffer, diagramCount, fileSize: outputBuffer.length };
    }

    // ------------------------------------------------------------------
    // PDF generation (shared browser via browserManager)
    // ------------------------------------------------------------------

    private async _generatePdf(html: string): Promise<Buffer> {
        const browser = await getBrowser();
        const page = await browser.newPage();

        try {
            await page.setContent(html, {
                waitUntil: ['domcontentloaded', 'networkidle0'],
            });

            // Wait for SVGs to paint (two rAF frames)
            await page.evaluate(
                () => new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                ),
            );

            // Determine if headers/footers are active
            const displayHeaderFooter = !!(
                this.options.pageNumbers ||
                this.options.headerTemplate ||
                this.options.footerTemplate
            );

            // Build PDF options
            const pdfOpts: Parameters<typeof page.pdf>[0] = {
                format: this.options.pageSize,
                printBackground: true,
                tagged: true,
                margin: {
                    top:    this.options.margins.top,
                    right:  this.options.margins.right,
                    bottom: this.options.margins.bottom,
                    left:   this.options.margins.left,
                },
            };

            if (displayHeaderFooter) {
                pdfOpts.displayHeaderFooter = true;

                // Puppeteer requires margins > 0 for headers/footers to render.
                // Ensure top/bottom margins are at least 15mm when using header/footer.
                const ensureMinMargin = (value: string, minMm: number): string => {
                    const match = value.trim().match(/^(\d+(?:\.\d+)?)(mm|cm|in|px)$/);
                    if (!match) { return `${minMm}mm`; }
                    const num = parseFloat(match[1]);
                    const unit = match[2];
                    let mm: number;
                    switch (unit) {
                        case 'mm': mm = num; break;
                        case 'cm': mm = num * 10; break;
                        case 'in': mm = num * 25.4; break;
                        case 'px': mm = num / (96 / 25.4); break;
                        default: mm = num;
                    }
                    return mm >= minMm ? value : `${minMm}mm`;
                };
                pdfOpts.margin!.top = ensureMinMargin(pdfOpts.margin!.top as string, 15);
                pdfOpts.margin!.bottom = ensureMinMargin(pdfOpts.margin!.bottom as string, 15);

                // Default page number footer template
                const defaultFooter = '<div style="font-size:9px;width:100%;text-align:center;color:#888;">' +
                    'Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>';

                if (this.options.headerTemplate) {
                    pdfOpts.headerTemplate = this.options.headerTemplate;
                } else {
                    // Empty header when not specified (Puppeteer requires it when displayHeaderFooter is true)
                    pdfOpts.headerTemplate = '<span></span>';
                }

                if (this.options.footerTemplate) {
                    pdfOpts.footerTemplate = this.options.footerTemplate;
                } else if (this.options.pageNumbers) {
                    pdfOpts.footerTemplate = defaultFooter;
                } else {
                    pdfOpts.footerTemplate = '<span></span>';
                }
            }

            const pdfPromise = page.pdf(pdfOpts);

            let timer: ReturnType<typeof setTimeout>;
            const timeoutPromise = new Promise<never>((_resolve, reject) => {
                timer = setTimeout(
                    () => reject(new Error(
                        `PDF generation timed out after ${PDF_TIMEOUT / 1000} seconds. ` +
                        `The document may be too large or complex.`
                    )),
                    PDF_TIMEOUT,
                );
            });

            try {
                const pdfUint8 = await Promise.race([pdfPromise, timeoutPromise]);
                return Buffer.from(pdfUint8);
            } finally {
                clearTimeout(timer!);
            }
        } finally {
            try {
                await page.close();
            } catch (closeErr) {
                console.error('Warning: Failed to close PDF page:', closeErr instanceof Error ? closeErr.message : String(closeErr));
            }
        }
    }
}
