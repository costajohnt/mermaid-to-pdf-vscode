// src/types.ts

export interface ConversionOptions {
    theme: 'light' | 'dark';
    pageSize: 'A4' | 'Letter' | 'Legal';
    margins: {
        top: string;
        right: string;
        bottom: string;
        left: string;
    };
}

export interface RenderedDiagram {
    svgString: string;
    width: number;
    height: number;
}

export interface DiagramCacheEntry {
    diagram: RenderedDiagram;
    timestamp: number;
}

export interface PageDimensions {
    /** Full page width in px */
    pageWidth: number;
    /** Full page height in px */
    pageHeight: number;
    /** Usable content width after margins in px */
    contentWidth: number;
    /** Usable content height after margins in px */
    contentHeight: number;
}

export const PAGE_DIMENSIONS: Record<string, { widthMm: number; heightMm: number }> = {
    'A4': { widthMm: 210, heightMm: 297 },
    'Letter': { widthMm: 215.9, heightMm: 279.4 },
    'Legal': { widthMm: 215.9, heightMm: 355.6 },
};

export const DEFAULT_OPTIONS: ConversionOptions = {
    theme: 'light',
    pageSize: 'A4',
    margins: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm',
    },
};

/** Minimum scale factor before we allow vertical overflow rather than shrinking further */
export const MIN_SCALE = 0.6;
