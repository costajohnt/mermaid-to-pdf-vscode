// src/types.ts

export type PageSize = 'A4' | 'Letter' | 'Legal';

export interface ConversionOptions {
    theme: 'light' | 'dark';
    pageSize: PageSize;
    margins: {
        top: string;
        right: string;
        bottom: string;
        left: string;
    };
}

/**
 * A mermaid diagram rendered to SVG with measured dimensions.
 * Instances should only be created by `renderMermaidToSvg()`.
 */
export interface RenderedDiagram {
    readonly svgString: string;
    readonly width: number;
    readonly height: number;
}

export interface PageDimensions {
    /** Full page width in px */
    readonly pageWidth: number;
    /** Full page height in px */
    readonly pageHeight: number;
    /** Usable content width after margins in px */
    readonly contentWidth: number;
    /** Usable content height after margins in px */
    readonly contentHeight: number;
}

export const PAGE_DIMENSIONS = {
    'A4': { widthMm: 210, heightMm: 297 },
    'Letter': { widthMm: 215.9, heightMm: 279.4 },
    'Legal': { widthMm: 215.9, heightMm: 355.6 },
} as const satisfies Record<PageSize, { widthMm: number; heightMm: number }>;

export const DEFAULT_OPTIONS: ConversionOptions = Object.freeze({
    theme: 'light' as const,
    pageSize: 'A4' as const,
    margins: Object.freeze({ top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }),
});

/** Minimum scale factor before we allow vertical overflow rather than shrinking further */
export const MIN_SCALE = 0.6;

/**
 * Shape of the CLI's --json stdout output.
 * Shared contract between the CLI and MCP server.
 */
export interface CliJsonOutput {
    outputPath: string;
    fileSize: number;
    diagramCount: number;
    processingTimeMs: number;
}

/**
 * Build Puppeteer browser launch arguments.
 * --no-sandbox is only added in CI or when running as root (common in Docker).
 */
export function getBrowserArgs(): string[] {
    const args = [
        '--disable-dev-shm-usage',
        '--disable-gpu',
    ];

    const isCI = !!process.env.CI;
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

    if (isCI || isRoot) {
        args.unshift('--no-sandbox', '--disable-setuid-sandbox');
    }

    return args;
}
