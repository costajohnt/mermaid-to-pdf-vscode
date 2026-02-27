// src/types.ts

export type PageSize = 'A4' | 'Letter' | 'Legal';

export type OutputFormat = 'pdf' | 'html' | 'docx';

export interface ConversionOptions {
    theme: 'light' | 'dark';
    pageSize: PageSize;
    format: OutputFormat;
    margins: {
        top: string;
        right: string;
        bottom: string;
        left: string;
    };
    /** Show "Page X of Y" centered in the footer */
    pageNumbers: boolean;
    /** Custom header HTML template (Puppeteer template variables: pageNumber, totalPages, date, title) */
    headerTemplate?: string;
    /** Custom footer HTML template (Puppeteer template variables: pageNumber, totalPages, date, title) */
    footerTemplate?: string;
    /** Custom CSS to inject after the default styles (inline string or file path ending in .css) */
    customCss?: string;
    /** Custom font-family for body text */
    font?: string;
    /** Custom font-family for code/pre elements */
    codeFont?: string;
    /** Enable KaTeX math equation rendering ($...$ for inline, $$...$$ for block) */
    math?: boolean;
    /** BCP 47 language code for the HTML document (e.g. "en", "fr", "de"). Defaults to "en". */
    lang?: string;
    /** Custom Mermaid configuration object (merged with required settings; securityLevel and useMaxWidth are enforced) */
    mermaidConfig?: Record<string, unknown>;
    /** PDF metadata: document title. If not set, auto-detected from first # heading. */
    pdfTitle?: string;
    /** PDF metadata: document author. Embedded as <meta name="author">. */
    pdfAuthor?: string;
    /** PDF metadata: document subject/description. Embedded as <meta name="description">. */
    pdfSubject?: string;
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

/** Valid theme values for runtime validation */
export const VALID_THEMES = ['light', 'dark'] as const;

/** Valid page size values for runtime validation */
export const VALID_PAGE_SIZES = ['A4', 'Letter', 'Legal'] as const;

/** Valid output format values for runtime validation */
export const VALID_FORMATS = ['pdf', 'html', 'docx'] as const;

export const DEFAULT_OPTIONS: ConversionOptions = Object.freeze({
    theme: 'light' as const,
    pageSize: 'A4' as const,
    format: 'pdf' as const,
    pageNumbers: false,
    margins: Object.freeze({ top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }),
});

/** Minimum scale factor before we allow vertical overflow rather than shrinking further */
export const MIN_SCALE = 0.6;

/** Timeout in ms for Mermaid diagram rendering operations */
export const RENDER_TIMEOUT = 30_000;

/** Timeout in ms for PDF generation (page.pdf()) to prevent indefinite hangs */
export const PDF_TIMEOUT = 60_000;

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
