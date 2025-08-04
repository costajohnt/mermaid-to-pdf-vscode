"use strict";
/**
 * Tests for MarkdownMermaidConverter
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const converter_1 = require("../converter");
const pdf_1 = require("../generators/pdf");
const mermaid_1 = require("../renderers/mermaid");
describe('MarkdownMermaidConverter', () => {
    let converter;
    beforeEach(() => {
        converter = (0, converter_1.createConverter)();
        // Register built-in generators and renderers
        converter.registerGenerator(new pdf_1.PDFGenerator());
        converter.registerRenderer(new mermaid_1.MermaidRenderer());
    });
    afterEach(async () => {
        // Clean up browser pool
        const { BrowserPool } = await Promise.resolve().then(() => __importStar(require('../browser')));
        const pool = BrowserPool.getInstance();
        await pool.destroy();
    });
    describe('registration', () => {
        it('should register generators and renderers', () => {
            const pdfGenerator = new pdf_1.PDFGenerator();
            const mermaidRenderer = new mermaid_1.MermaidRenderer();
            converter.registerGenerator(pdfGenerator);
            converter.registerRenderer(mermaidRenderer);
            expect(converter.getSupportedFormats()).toContain('pdf');
            expect(converter.getSupportedDiagramTypes()).toContain('mermaid');
        });
    });
    describe('convert', () => {
        it('should convert simple markdown without diagrams', async () => {
            const input = {
                content: '# Test\n\nThis is a test document.',
                format: 'pdf'
            };
            const result = await converter.convert(input);
            expect(result.format).toBe('pdf');
            expect(result.data).toBeInstanceOf(Buffer);
            expect(result.mimeType).toBe('application/pdf');
            expect(result.metadata?.diagrams).toBe(0);
        }, 30000);
        it('should handle invalid format', async () => {
            const input = {
                content: '# Test',
                format: 'invalid-format'
            };
            await expect(converter.convert(input)).rejects.toThrow('No generator available for format: invalid-format');
        });
    });
});
//# sourceMappingURL=converter.test.js.map