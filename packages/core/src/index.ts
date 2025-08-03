/**
 * @mermaid-converter/core
 * 
 * Core library for converting Markdown with Mermaid diagrams to various formats
 */

// Main converter
export { MarkdownMermaidConverter, createConverter } from './converter';

// Core types and interfaces
export * from './types';

// Parser
export { MarkdownParser } from './parser';

// Cache manager
export { CacheManager } from './cache';

// Browser pool
export { BrowserPool } from './browser';

// Built-in generators and renderers
export { PDFGenerator } from './generators/pdf';
export { MermaidRenderer } from './renderers/mermaid';

// Version
export const VERSION = '1.0.0';