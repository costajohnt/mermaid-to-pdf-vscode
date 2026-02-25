// src/e2e.test.ts
import { test, describe, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Converter, closePdfBrowser } from './converter.js';
import { closeBrowser } from './mermaidRenderer.js';

describe('End-to-end', () => {
    after(async () => {
        await closeBrowser();
        await closePdfBrowser();
    });

    test('converts sample.md with 4 diagram types to PDF', async () => {
        const converter = new Converter();
        const samplePath = join(process.cwd(), 'test-fixtures', 'sample.md');
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'e2e-test-'));
        const outputPath = join(tmpDir, 'sample.pdf');

        const result = await converter.convertFile(samplePath, outputPath);

        assert.equal(result.diagramCount, 4, 'should find 4 mermaid diagrams');
        assert.ok(result.fileSize > 1000, 'PDF should be substantial');

        const buf = await fs.readFile(outputPath);
        assert.equal(buf.slice(0, 5).toString(), '%PDF-');

        console.log(`PDF size: ${(result.fileSize / 1024).toFixed(1)} KB`);

        await fs.rm(tmpDir, { recursive: true });
    });

    test('converts with dark theme', async () => {
        const converter = new Converter({ theme: 'dark' });
        const md = '# Dark Theme\n\n```mermaid\nflowchart LR\n    A --> B\n```\n';
        const result = await converter.convertString(md);

        assert.ok(result.pdfBuffer.length > 0);
        assert.equal(result.pdfBuffer.slice(0, 5).toString(), '%PDF-');
        assert.equal(result.diagramCount, 1);
    });

    test('converts with Letter page size', async () => {
        const converter = new Converter({ pageSize: 'Letter' });
        const md = '# Letter Size\n\nHello world.\n';
        const result = await converter.convertString(md);

        assert.ok(result.pdfBuffer.length > 0);
    });
});
