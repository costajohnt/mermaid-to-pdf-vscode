// src/index.ts — Public API entry point
export { Converter, closePdfBrowser } from './converter.js';
export type { ConvertFileResult, ConvertStringResult } from './converter.js';
export { renderMermaidToSvg, closeBrowser } from './mermaidRenderer.js';
export { DiagramCache } from './diagramCache.js';
export type {
    ConversionOptions,
    RenderedDiagram,
    PageSize,
    PageDimensions,
    CliJsonOutput,
} from './types.js';
export { DEFAULT_OPTIONS, PAGE_DIMENSIONS, MIN_SCALE } from './types.js';
