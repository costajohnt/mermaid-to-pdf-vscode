/**
 * Tests for MarkdownMermaidConverter
 */

import { MarkdownMermaidConverter, createConverter } from '../converter';
import { PDFGenerator } from '../generators/pdf';
import { MermaidRenderer } from '../renderers/mermaid';

describe('MarkdownMermaidConverter', () => {
  let converter: MarkdownMermaidConverter;

  beforeEach(() => {
    converter = createConverter();
    // Register built-in generators and renderers
    converter.registerGenerator(new PDFGenerator());
    converter.registerRenderer(new MermaidRenderer());
  });

  afterEach(async () => {
    // Clean up browser pool
    const { BrowserPool } = await import('../browser');
    const pool = BrowserPool.getInstance();
    await pool.destroy();
  });

  describe('registration', () => {
    it('should register generators and renderers', () => {
      const pdfGenerator = new PDFGenerator();
      const mermaidRenderer = new MermaidRenderer();

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