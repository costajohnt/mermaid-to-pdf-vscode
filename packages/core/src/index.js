"use strict";
/**
 * @mermaid-converter/core
 *
 * Core library for converting Markdown with Mermaid diagrams to various formats
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = exports.MermaidRenderer = exports.PDFGenerator = exports.BrowserPool = exports.CacheManager = exports.MarkdownParser = exports.createConverter = exports.MarkdownMermaidConverter = void 0;
// Main converter
var converter_1 = require("./converter");
Object.defineProperty(exports, "MarkdownMermaidConverter", { enumerable: true, get: function () { return converter_1.MarkdownMermaidConverter; } });
Object.defineProperty(exports, "createConverter", { enumerable: true, get: function () { return converter_1.createConverter; } });
// Core types and interfaces
__exportStar(require("./types"), exports);
// Parser
var parser_1 = require("./parser");
Object.defineProperty(exports, "MarkdownParser", { enumerable: true, get: function () { return parser_1.MarkdownParser; } });
// Cache manager
var cache_1 = require("./cache");
Object.defineProperty(exports, "CacheManager", { enumerable: true, get: function () { return cache_1.CacheManager; } });
// Browser pool
var browser_1 = require("./browser");
Object.defineProperty(exports, "BrowserPool", { enumerable: true, get: function () { return browser_1.BrowserPool; } });
// Built-in generators and renderers
var pdf_1 = require("./generators/pdf");
Object.defineProperty(exports, "PDFGenerator", { enumerable: true, get: function () { return pdf_1.PDFGenerator; } });
var mermaid_1 = require("./renderers/mermaid");
Object.defineProperty(exports, "MermaidRenderer", { enumerable: true, get: function () { return mermaid_1.MermaidRenderer; } });
// Version
exports.VERSION = '1.0.0';
//# sourceMappingURL=index.js.map