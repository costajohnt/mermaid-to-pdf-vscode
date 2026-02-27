// src/converter.test.ts
import { test, describe, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Converter, closePdfBrowser } from './converter.js';
import { closeBrowser } from './mermaidRenderer.js';

describe('Converter', () => {
    after(async () => {
        await closeBrowser();
        await closePdfBrowser();
    });

    test('converts plain markdown (no mermaid) to PDF', async () => {
        const converter = new Converter();
        const md = '# Hello World\n\nThis is a test document.\n';
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'converter-test-'));
        const inputPath = join(tmpDir, 'test.md');
        const outputPath = join(tmpDir, 'test.pdf');

        await fs.writeFile(inputPath, md);
        await converter.convertFile(inputPath, outputPath);

        const stat = await fs.stat(outputPath);
        assert.ok(stat.size > 0, 'PDF should have content');

        const buf = await fs.readFile(outputPath);
        assert.equal(buf.slice(0, 5).toString(), '%PDF-');

        await fs.rm(tmpDir, { recursive: true });
    });

    test('converts markdown with mermaid diagram to PDF', async () => {
        const converter = new Converter();
        const md = '# Test\n\n```mermaid\nflowchart LR\n    A --> B\n```\n\nSome text after.\n';
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'converter-test-'));
        const inputPath = join(tmpDir, 'test.md');
        const outputPath = join(tmpDir, 'test.pdf');

        await fs.writeFile(inputPath, md);
        const result = await converter.convertFile(inputPath, outputPath);

        assert.equal(result.diagramCount, 1);
        const stat = await fs.stat(outputPath);
        assert.ok(stat.size > 0);

        await fs.rm(tmpDir, { recursive: true });
    });

    test('converts markdown string to PDF buffer', async () => {
        const converter = new Converter();
        const md = '# Hello\n\nWorld\n';
        const result = await converter.convertString(md);

        assert.ok(result.outputBuffer.length > 0);
        assert.equal(result.outputBuffer.slice(0, 5).toString(), '%PDF-');
        assert.equal(result.diagramCount, 0);
        assert.ok(result.fileSize > 0);
    });

    test('handles multiple diagrams', async () => {
        const converter = new Converter();
        const md = [
            '# Multi Diagram Test',
            '',
            '```mermaid',
            'flowchart LR',
            '    A --> B',
            '```',
            '',
            'Middle text.',
            '',
            '```mermaid',
            'sequenceDiagram',
            '    Alice->>Bob: Hello',
            '```',
            '',
            'End text.',
        ].join('\n');

        const result = await converter.convertString(md);
        assert.ok(result.outputBuffer.length > 0);
        assert.equal(result.diagramCount, 2);
    });

    test('handles failed diagram gracefully', async () => {
        const converter = new Converter();
        const md = '# Test\n\n```mermaid\ninvalid diagram code here\n```\n\nText continues.\n';

        // Should NOT throw — should embed error box and continue
        const result = await converter.convertString(md);
        assert.ok(result.outputBuffer.length > 0);
        assert.equal(result.outputBuffer.slice(0, 5).toString(), '%PDF-');
        // Failed diagram is NOT counted in diagramCount
        assert.equal(result.diagramCount, 0);
    });

    test('accepts docx as a valid format', () => {
        const converter = new Converter({ format: 'docx' });
        assert.ok(converter);
    });

    test('converts markdown string to DOCX buffer', async () => {
        const converter = new Converter({ format: 'docx' });
        const md = '# Hello\n\nThis is a DOCX test.\n';
        const result = await converter.convertString(md);

        assert.ok(result.outputBuffer.length > 0, 'DOCX buffer should have content');
        assert.ok(result.fileSize > 0, 'fileSize should be > 0');
        assert.equal(result.diagramCount, 0);
        assert.equal(result.outputBuffer.slice(0, 2).toString(), 'PK',
            'DOCX output should be a valid ZIP (PK header)');
    });

    test('DOCX with mermaid diagrams renders successfully', async () => {
        const converter = new Converter({ format: 'docx' });
        const md = [
            '# DOCX with Diagrams',
            '',
            '```mermaid',
            'flowchart LR',
            '    A --> B --> C',
            '```',
            '',
            'Text between diagrams.',
            '',
            '```mermaid',
            'sequenceDiagram',
            '    Alice->>Bob: Hello',
            '```',
        ].join('\n');

        const result = await converter.convertString(md);
        assert.ok(result.outputBuffer.length > 0, 'DOCX buffer should have content');
        assert.equal(result.outputBuffer.slice(0, 2).toString(), 'PK',
            'DOCX output should be a valid ZIP');
        assert.equal(result.diagramCount, 2, 'should count both diagrams');
    });

    test('mermaid alt text is captured in correct capture group', async () => {
        const converter = new Converter({ format: 'html' });
        const md = '# Alt Text Test\n\n```mermaid alt="My flow diagram"\nflowchart LR\n    A --> B\n```\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.ok(result.htmlString!.includes('My flow diagram'),
            'alt text should appear in output HTML');
        assert.equal(result.diagramCount, 1);
    });

    test('mermaid block without alt text still renders correctly', async () => {
        const converter = new Converter({ format: 'html' });
        const md = '# No Alt\n\n```mermaid\nflowchart LR\n    X --> Y\n```\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.equal(result.diagramCount, 1);
        // Should use div (not figure) when no alt text
        assert.ok(!result.htmlString!.includes('<figure'),
            'should not use figure element without alt text');
    });

    test('rejects invalid lang in Converter constructor', () => {
        assert.throws(
            () => new Converter({ lang: '<script>' }),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.match(err.message, /Invalid lang/);
                return true;
            },
        );
    });
});
