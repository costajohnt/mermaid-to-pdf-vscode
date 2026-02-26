import { type Page } from 'puppeteer';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { RenderedDiagram } from './types.js';
import { RENDER_TIMEOUT } from './types.js';
import { getBrowser, closeBrowser } from './browserManager.js';

// Re-export closeBrowser so existing callers (tests, cli) keep working.
export { closeBrowser };

const PADDING = 10;

/**
 * Load the vendored mermaid.min.js source code (cached at module level).
 */
let _mermaidScriptCache: string | null = null;

function loadMermaidScript(): string {
    if (_mermaidScriptCache) { return _mermaidScriptCache; }
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = dirname(currentFile);
    const mermaidPath = resolve(currentDir, 'vendor', 'mermaid.min.js');
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

// ---------------------------------------------------------------------------
// Render session — reuses a single page across multiple diagram renders
// ---------------------------------------------------------------------------

/**
 * A render session keeps a single Puppeteer page alive with the mermaid
 * library already injected. Rendering multiple diagrams avoids the overhead
 * of creating a new page and re-injecting the 2.8 MB mermaid.min.js for
 * each diagram.
 *
 * Usage:
 *   const session = await createRenderSession('default');
 *   try {
 *       const svg1 = await session.render(code1);
 *       const svg2 = await session.render(code2);
 *   } finally {
 *       await session.close();
 *   }
 */
export interface MermaidRenderSession {
    /** Render a single diagram on the reused page. */
    render(code: string): Promise<RenderedDiagram>;
    /** Close the underlying page. */
    close(): Promise<void>;
}

/**
 * Create a render session with a single Puppeteer page and pre-loaded
 * mermaid library. The session must be closed when rendering is complete.
 */
export async function createRenderSession(theme: string = 'default'): Promise<MermaidRenderSession> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(RENDER_TIMEOUT);

    // Load a minimal blank page with a container div already present
    await page.setContent(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="mermaid-container"></div></body></html>',
        { waitUntil: 'domcontentloaded' },
    );

    // Inject vendored mermaid.js once
    const mermaidScript = loadMermaidScript();
    await page.addScriptTag({ content: mermaidScript });

    // Wait for mermaid global to be available
    await page.waitForFunction(
        () =>
            typeof (window as any).mermaid !== 'undefined' &&
            typeof (window as any).mermaid.initialize === 'function',
        { timeout: RENDER_TIMEOUT },
    );

    // Initialize mermaid once with useMaxWidth: false on ALL diagram types
    await page.evaluate((mermaidTheme: string) => {
        const mermaid = (window as any).mermaid;
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
    }, theme);

    return {
        render: (code: string) => renderOnPage(page, code),
        close: async () => {
            try {
                await page.close();
            } catch (closeErr) {
                console.error('Warning: Failed to close render session page:',
                    closeErr instanceof Error ? closeErr.message : String(closeErr));
            }
        },
    };
}

/**
 * Render a single mermaid diagram on an already-initialised page.
 * Clears the container div between renders rather than destroying the page.
 */
async function renderOnPage(
    page: Page,
    code: string,
): Promise<RenderedDiagram> {
    // Validate input (same checks as the standalone function)
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
        throw new Error('Mermaid code must be a non-empty string');
    }
    if (code.length > 50_000) {
        throw new Error(
            `Mermaid code too large (${(code.length / 1024).toFixed(1)} KB). Maximum size is 50 KB.`
        );
    }

    try {
        const result = await page.evaluate(
            async (mermaidCode: string, padding: number) => {
                const mermaid = (window as any).mermaid;

                // Clear previous diagram content from the container
                const container = document.getElementById('mermaid-container')!;
                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }

                // Create a fresh diagram div
                const diagramDiv = document.createElement('div');
                diagramDiv.className = 'mermaid';
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

                const viewBoxX = bbox.x - padding;
                const viewBoxY = bbox.y - padding;
                const viewBoxW = bbox.width + padding * 2;
                const viewBoxH = bbox.height + padding * 2;

                const width = Math.ceil(viewBoxW);
                const height = Math.ceil(viewBoxH);
                svg.setAttribute(
                    'viewBox',
                    `${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`,
                );
                svg.setAttribute('width', String(width));
                svg.setAttribute('height', String(height));

                svg.style.maxWidth = '';

                const svgString = svg.outerHTML;
                return { svgString, width, height };
            },
            code,
            PADDING,
        );

        if (!result || typeof result.svgString !== 'string' || !result.svgString.includes('<svg') ||
            typeof result.width !== 'number' || result.width <= 0 ||
            typeof result.height !== 'number' || result.height <= 0) {
            throw new Error('Failed to render Mermaid diagram: invalid SVG output');
        }

        return result as RenderedDiagram;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.startsWith('Failed to render') || msg.includes('non-empty string') || msg.includes('too large')) {
            throw error;
        }
        throw new Error(`Failed to render Mermaid diagram: ${msg}`);
    }
}

// ---------------------------------------------------------------------------
// Standalone convenience function (backward-compatible)
// ---------------------------------------------------------------------------

/**
 * Render a Mermaid diagram to SVG with measured dimensions.
 * Creates a single-use render session internally.
 *
 * For rendering multiple diagrams, prefer createRenderSession() to avoid
 * re-creating the page and re-injecting mermaid for each diagram.
 *
 * @param code - The Mermaid diagram source code
 * @param theme - Optional mermaid theme (default: 'default')
 * @returns A RenderedDiagram with the SVG string and pixel dimensions
 */
export async function renderMermaidToSvg(
    code: string,
    theme: string = 'default',
): Promise<RenderedDiagram> {
    const session = await createRenderSession(theme);
    try {
        return await session.render(code);
    } finally {
        await session.close();
    }
}
