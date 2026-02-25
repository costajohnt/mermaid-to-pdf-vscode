import puppeteer, { type Browser } from 'puppeteer';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { RenderedDiagram } from './types.js';
import { BROWSER_ARGS } from './types.js';

// Module-level browser singleton (lazy-init)
let browserInstance: Browser | null = null;

const RENDER_TIMEOUT = 30_000;
const PADDING = 10;

/**
 * Get or create the singleton browser instance.
 */
async function getBrowser(): Promise<Browser> {
    if (browserInstance && browserInstance.connected) {
        return browserInstance;
    }
    browserInstance = await puppeteer.launch({
        headless: true,
        args: BROWSER_ARGS,
    });
    return browserInstance;
}

/**
 * Close the singleton browser instance. Call this during cleanup.
 */
export async function closeBrowser(): Promise<void> {
    if (browserInstance) {
        try {
            await browserInstance.close();
        } catch (err) {
            console.error('Warning: Failed to close browser:', err instanceof Error ? err.message : String(err));
        }
        browserInstance = null;
    }
}

/**
 * Load the vendored mermaid.min.js source code (cached at module level).
 */
let _mermaidScriptCache: string | null = null;

function loadMermaidScript(): string {
    if (_mermaidScriptCache) return _mermaidScriptCache;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const mermaidPath = resolve(__dirname, 'vendor', 'mermaid.min.js');
    try {
        _mermaidScriptCache = readFileSync(mermaidPath, 'utf-8');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
            `Failed to load vendored mermaid.min.js at ${mermaidPath}: ${msg}. ` +
            `This file should be included in the package. Try reinstalling or rebuilding.`
        );
    }
    return _mermaidScriptCache;
}

/**
 * Render a Mermaid diagram to SVG with measured dimensions.
 *
 * @param code - The Mermaid diagram source code
 * @param theme - Optional mermaid theme (default: 'default')
 * @returns A RenderedDiagram with the SVG string and pixel dimensions
 */
export async function renderMermaidToSvg(
    code: string,
    theme: string = 'default',
): Promise<RenderedDiagram> {
    // Validate input
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
        throw new Error('Mermaid code must be a non-empty string');
    }

    if (code.length > 50_000) {
        throw new Error(
            `Mermaid code too large (${(code.length / 1024).toFixed(1)} KB). Maximum size is 50 KB.`
        );
    }

    const browser = await getBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(RENDER_TIMEOUT);

    try {
        // Load a minimal blank page
        await page.setContent(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>',
            { waitUntil: 'domcontentloaded' },
        );

        // Inject vendored mermaid.js
        const mermaidScript = loadMermaidScript();
        await page.addScriptTag({ content: mermaidScript });

        // Wait for mermaid global to be available
        await page.waitForFunction(
            () =>
                typeof (window as any).mermaid !== 'undefined' &&
                typeof (window as any).mermaid.initialize === 'function',
            { timeout: RENDER_TIMEOUT },
        );

        // Initialize mermaid and render the diagram
        const result = await page.evaluate(
            async (mermaidCode: string, mermaidTheme: string, padding: number) => {
                const mermaid = (window as any).mermaid;

                // Initialize with useMaxWidth: false on ALL diagram types
                mermaid.initialize({
                    startOnLoad: false,
                    theme: mermaidTheme,
                    securityLevel: 'strict',
                    logLevel: 'error',
                    flowchart: { useMaxWidth: false },
                    sequence: { useMaxWidth: false },
                    gantt: { useMaxWidth: false },
                    journey: { useMaxWidth: false },
                    timeline: { useMaxWidth: false },
                    class: { useMaxWidth: false },
                    state: { useMaxWidth: false },
                    er: { useMaxWidth: false },
                    pie: { useMaxWidth: false },
                    quadrantChart: { useMaxWidth: false },
                    requirement: { useMaxWidth: false },
                    mindmap: { useMaxWidth: false },
                    gitGraph: { useMaxWidth: false },
                    c4: { useMaxWidth: false },
                    sankey: { useMaxWidth: false },
                    block: { useMaxWidth: false },
                });

                // Create a container div and a diagram div
                const container = document.createElement('div');
                container.id = 'mermaid-container';
                document.body.appendChild(container);

                const diagramDiv = document.createElement('div');
                diagramDiv.className = 'mermaid';
                // Use textContent to avoid HTML escaping issues
                diagramDiv.textContent = mermaidCode;
                container.appendChild(diagramDiv);

                // Run mermaid on the element
                try {
                    await mermaid.run({ nodes: [diagramDiv] });
                } catch (err: any) {
                    throw new Error(
                        `Failed to render Mermaid diagram: ${err?.message || String(err)}`,
                    );
                }

                // Extract the rendered SVG
                const svg = diagramDiv.querySelector('svg');
                if (!svg) {
                    throw new Error('Failed to render Mermaid diagram: no SVG element produced');
                }

                // Measure via getBBox
                const bbox = svg.getBBox();
                const width = Math.ceil(bbox.width + bbox.x + padding * 2);
                const height = Math.ceil(bbox.height + bbox.y + padding * 2);

                // Set explicit viewBox, width, and height on the SVG
                const viewBoxX = bbox.x - padding;
                const viewBoxY = bbox.y - padding;
                const viewBoxW = bbox.width + padding * 2;
                const viewBoxH = bbox.height + padding * 2;
                svg.setAttribute(
                    'viewBox',
                    `${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`,
                );
                svg.setAttribute('width', String(width));
                svg.setAttribute('height', String(height));

                // Remove any max-width style that mermaid might set
                svg.style.maxWidth = '';

                const svgString = svg.outerHTML;
                return { svgString, width, height };
            },
            code,
            theme,
            PADDING,
        );

        if (!result || typeof result.svgString !== 'string' || !result.svgString.includes('<svg') ||
            typeof result.width !== 'number' || result.width <= 0 ||
            typeof result.height !== 'number' || result.height <= 0) {
            throw new Error('Failed to render Mermaid diagram: invalid SVG output');
        }

        return result as RenderedDiagram;
    } catch (error) {
        // Re-throw with a consistent message prefix if not already formatted
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.startsWith('Failed to render') || msg.includes('non-empty string') || msg.includes('too large')) {
            throw error;
        }
        throw new Error(`Failed to render Mermaid diagram: ${msg}`);
    } finally {
        try {
            await page.close();
        } catch (closeErr) {
            console.error('Warning: Failed to close page:', closeErr instanceof Error ? closeErr.message : String(closeErr));
        }
    }
}
