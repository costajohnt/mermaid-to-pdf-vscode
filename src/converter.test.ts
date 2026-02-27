// src/converter.test.ts
import { test, describe, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Converter, closePdfBrowser, embedLocalImages } from './converter.js';
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

    // --- Page break directive tests (#73) ---

    test('<!-- pagebreak --> is replaced with page-break-after div in HTML output', async () => {
        const converter = new Converter({ format: 'html' });
        const md = '# Section 1\n\nSome text.\n\n<!-- pagebreak -->\n\n# Section 2\n\nMore text.\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.ok(
            result.htmlString!.includes('page-break-after: always; break-after: page;'),
            'should contain page-break-after div',
        );
    });

    test('<!-- pagebreak-before --> is replaced with page-break-before div in HTML output', async () => {
        const converter = new Converter({ format: 'html' });
        const md = '# Section 1\n\nSome text.\n\n<!-- pagebreak-before -->\n\n# Section 2\n\nMore text.\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.ok(
            result.htmlString!.includes('page-break-before: always; break-before: page;'),
            'should contain page-break-before div',
        );
    });

    test('pagebreak directive is case insensitive', async () => {
        const converter = new Converter({ format: 'html' });
        const md = '# Section 1\n\n<!-- PAGEBREAK -->\n\n# Section 2\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.ok(
            result.htmlString!.includes('page-break-after: always; break-after: page;'),
            'should handle uppercase PAGEBREAK',
        );
    });

    test('pagebreak directive works with extra whitespace', async () => {
        const converter = new Converter({ format: 'html' });
        const md = '# Section 1\n\n<!--  pagebreak  -->\n\n# Section 2\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.ok(
            result.htmlString!.includes('page-break-after: always; break-after: page;'),
            'should handle extra whitespace inside the comment',
        );
    });

    // --- Image embedding tests (#71) ---

    test('embedLocalImages embeds a local PNG image as base64', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'img-embed-test-'));
        // Create a tiny 1x1 red PNG (68 bytes)
        const pngBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            'base64',
        );
        const imgPath = join(tmpDir, 'test.png');
        await fs.writeFile(imgPath, pngBuffer);

        const md = `# Hello\n\n![my image](./test.png)\n`;
        const result = embedLocalImages(md, tmpDir);

        assert.ok(result.includes('data:image/png;base64,'), 'should contain base64 data URI');
        assert.ok(!result.includes('./test.png'), 'should not contain original path');
        assert.ok(result.includes('![my image]'), 'should preserve alt text');

        await fs.rm(tmpDir, { recursive: true });
    });

    test('embedLocalImages skips missing images with warning', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'img-embed-test-'));
        const md = `![missing](./nonexistent.png)\n`;

        // Capture console.error output
        const originalError = console.error;
        const errors: string[] = [];
        console.error = (...args: unknown[]) => { errors.push(args.join(' ')); };

        try {
            const result = embedLocalImages(md, tmpDir);
            assert.ok(result.includes('./nonexistent.png'), 'should leave original path untouched');
            assert.ok(errors.some(e => e.includes('not found')), 'should warn about missing image');
        } finally {
            console.error = originalError;
        }

        await fs.rm(tmpDir, { recursive: true });
    });

    test('embedLocalImages leaves remote URLs untouched', () => {
        const md = `![remote](https://example.com/image.png)\n![also remote](http://example.com/pic.jpg)\n`;
        const result = embedLocalImages(md);

        assert.equal(result, md, 'remote URLs should not be modified');
    });

    test('embedLocalImages skips images larger than 5 MB', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'img-embed-test-'));
        const largePath = join(tmpDir, 'huge.png');
        // Create a file just over 5 MB
        const buf = Buffer.alloc(5 * 1024 * 1024 + 1, 0);
        await fs.writeFile(largePath, buf);

        const md = `![big](./huge.png)\n`;

        const originalError = console.error;
        const errors: string[] = [];
        console.error = (...args: unknown[]) => { errors.push(args.join(' ')); };

        try {
            const result = embedLocalImages(md, tmpDir);
            assert.ok(result.includes('./huge.png'), 'should leave original path for oversized image');
            assert.ok(errors.some(e => e.includes('5 MB')), 'should warn about size limit');
        } finally {
            console.error = originalError;
        }

        await fs.rm(tmpDir, { recursive: true });
    });

    // --- PDF metadata tests (#74) ---

    test('pdfTitle sets the <title> tag in HTML output', async () => {
        const converter = new Converter({ format: 'html', pdfTitle: 'My Custom Title' });
        const md = '# Heading\n\nSome text.\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.ok(result.htmlString!.includes('<title>My Custom Title</title>'),
            'HTML should contain <title> with pdfTitle value');
    });

    test('auto-title extracts from first heading when pdfTitle not set', async () => {
        const converter = new Converter({ format: 'html' });
        const md = '# Auto Detected Title\n\nSome text.\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.ok(result.htmlString!.includes('<title>Auto Detected Title</title>'),
            'HTML should contain <title> auto-detected from first heading');
    });

    test('pdfAuthor adds meta author tag', async () => {
        const converter = new Converter({ format: 'html', pdfAuthor: 'Jane Doe' });
        const md = '# Test\n\nSome text.\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.ok(result.htmlString!.includes('<meta name="author" content="Jane Doe">'),
            'HTML should contain meta author tag');
    });

    test('pdfSubject adds meta description tag', async () => {
        const converter = new Converter({ format: 'html', pdfSubject: 'Technical Documentation' });
        const md = '# Test\n\nSome text.\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.ok(result.htmlString!.includes('<meta name="description" content="Technical Documentation">'),
            'HTML should contain meta description tag');
    });

    test('special characters in PDF metadata are escaped', async () => {
        const converter = new Converter({
            format: 'html',
            pdfTitle: 'Title with <script> & "quotes"',
            pdfAuthor: 'Author <b>bold</b>',
            pdfSubject: 'Subject & "description"',
        });
        const md = '# Heading\n\nText.\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        // Title should be escaped
        assert.ok(result.htmlString!.includes('Title with &lt;script&gt; &amp; &quot;quotes&quot;'),
            'Title special characters should be escaped');
        // Author should be escaped
        assert.ok(result.htmlString!.includes('Author &lt;b&gt;bold&lt;/b&gt;'),
            'Author special characters should be escaped');
        // Subject should be escaped
        assert.ok(result.htmlString!.includes('Subject &amp; &quot;description&quot;'),
            'Subject special characters should be escaped');
    });

    test('no title tag when pdfTitle not set and no headings in markdown', async () => {
        const converter = new Converter({ format: 'html' });
        const md = 'Just plain text, no headings.\n';
        const result = await converter.convertString(md);

        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.ok(!result.htmlString!.includes('<title>'),
            'HTML should not contain <title> when no title or headings exist');
    });

    // --- Mermaid config tests (#72) ---

    test('accepts custom mermaidConfig and renders diagram', async () => {
        const converter = new Converter({
            format: 'html',
            mermaidConfig: {
                flowchart: { curve: 'basis' },
            },
        });
        const md = '# Config Test\n\n```mermaid\nflowchart LR\n    A --> B\n```\n';
        const result = await converter.convertString(md);
        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.equal(result.diagramCount, 1, 'should render the diagram');
    });

    test('securityLevel cannot be overridden by mermaidConfig', async () => {
        // Even if user tries to set securityLevel: 'loose', the renderer
        // enforces 'strict'. We verify this indirectly: the converter should
        // still produce valid output (not crash) and render the diagram.
        const converter = new Converter({
            format: 'html',
            mermaidConfig: {
                securityLevel: 'loose',
            },
        });
        const md = '# Security Test\n\n```mermaid\nflowchart LR\n    A --> B\n```\n';
        const result = await converter.convertString(md);
        assert.ok(result.htmlString, 'HTML format should produce htmlString');
        assert.equal(result.diagramCount, 1, 'diagram should still render under strict security');
    });
});
