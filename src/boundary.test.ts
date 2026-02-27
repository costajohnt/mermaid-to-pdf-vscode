// src/boundary.test.ts
// Issue #51: Boundary tests for input size limits
import { test, describe, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { Converter, closePdfBrowser } from './converter.js';
import { renderMermaidToSvg, closeBrowser } from './mermaidRenderer.js';

// Constants matching the limits in the production code:
//   converter.ts  → 10 * 1024 * 1024 bytes  (10 MB markdown limit)
//   mermaidRenderer.ts → 50_000 bytes         (50 KB per-diagram limit)
const MARKDOWN_LIMIT = 10 * 1024 * 1024;
const DIAGRAM_LIMIT = 50_000;

describe('Boundary: markdown size limits', () => {
    after(async () => {
        await closeBrowser();
        await closePdfBrowser();
    });

    test('markdown at exactly the limit (10 MB) passes the size check', async () => {
        const converter = new Converter();
        // Build a markdown string of exactly MARKDOWN_LIMIT bytes.
        // The converter checks `markdown.length > 10 * 1024 * 1024` before
        // any parsing, so at exactly the limit the check should pass.
        //
        // Note: We cannot fully render a 10 MB document because `marked`
        // has its own stack-size limitations.  Instead we verify the size
        // check specifically: if convertString throws, the error must NOT
        // be the "too large" size-limit error.
        const line = 'a\n';
        const lineCount = Math.floor(MARKDOWN_LIMIT / line.length);
        const bulk = line.repeat(lineCount);
        const remainder = MARKDOWN_LIMIT - bulk.length;
        const md = bulk + 'b'.repeat(remainder);
        assert.equal(md.length, MARKDOWN_LIMIT, 'test string should be exactly at the limit');

        try {
            await converter.convertString(md);
            // If it succeeds, the size check passed — great.
        } catch (err) {
            // If it fails, ensure it's NOT the size-limit error.
            assert.ok(err instanceof Error);
            assert.ok(
                !err.message.includes('too large') && !err.message.includes('Maximum size is 10 MB'),
                `At exactly the limit, should NOT get a size error. Got: "${err.message}"`,
            );
        }
    });

    test('markdown at limit + 1 byte should be rejected with clear error', async () => {
        const converter = new Converter();
        // Use short lines to avoid parser stack overflow (though the size
        // check fires before parsing, this keeps the test robust).
        const line = 'x'.repeat(79) + '\n';
        const lineCount = Math.floor((MARKDOWN_LIMIT + 1) / line.length);
        const bulk = line.repeat(lineCount);
        const remainder = MARKDOWN_LIMIT + 1 - bulk.length;
        const md = bulk + 'y'.repeat(remainder);
        assert.equal(md.length, MARKDOWN_LIMIT + 1);

        await assert.rejects(
            () => converter.convertString(md),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    err.message.includes('too large') || err.message.includes('Maximum size'),
                    `Error message should mention size limit, got: "${err.message}"`,
                );
                return true;
            },
        );
    });
});

describe('Boundary: per-diagram size limits', () => {
    after(async () => {
        await closeBrowser();
    });

    test('diagram code at exactly the limit (50 KB) should be accepted', async () => {
        // Build a valid mermaid flowchart that is exactly DIAGRAM_LIMIT bytes.
        // The prefix is a valid flowchart header; the rest is a long comment.
        const prefix = 'flowchart LR\n    A --> B\n    %% ';
        const suffix = '\n';
        const commentLen = DIAGRAM_LIMIT - prefix.length - suffix.length;
        const code = prefix + 'x'.repeat(commentLen) + suffix;
        assert.equal(code.length, DIAGRAM_LIMIT, 'diagram code should be exactly at the limit');

        // renderMermaidToSvg checks code.length > 50_000 — at exactly 50_000 it should pass.
        const result = await renderMermaidToSvg(code);
        assert.ok(result.svgString.includes('<svg'), 'should produce valid SVG');
        assert.ok(result.width > 0);
        assert.ok(result.height > 0);
    });

    test('diagram code at limit + 1 byte should be rejected with clear error', async () => {
        const prefix = 'flowchart LR\n    A --> B\n    %% ';
        const suffix = '\n';
        const commentLen = DIAGRAM_LIMIT + 1 - prefix.length - suffix.length;
        const code = prefix + 'x'.repeat(commentLen) + suffix;
        assert.equal(code.length, DIAGRAM_LIMIT + 1);

        await assert.rejects(
            () => renderMermaidToSvg(code),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    err.message.includes('too large') || err.message.includes('Maximum size'),
                    `Error message should mention size limit, got: "${err.message}"`,
                );
                return true;
            },
        );
    });
});

describe('Boundary: edge-case inputs', () => {
    after(async () => {
        await closeBrowser();
        await closePdfBrowser();
    });

    test('empty markdown input should produce a valid PDF', async () => {
        const converter = new Converter();
        const result = await converter.convertString('');
        assert.ok(result.outputBuffer.length > 0, 'should produce a PDF even for empty input');
        assert.equal(result.outputBuffer.slice(0, 5).toString(), '%PDF-');
        assert.equal(result.diagramCount, 0);
    });

    test('markdown with zero diagrams (plain text only) should produce a valid PDF', async () => {
        const converter = new Converter();
        const md = [
            '# Title',
            '',
            'This is plain markdown with **bold** and *italic* text.',
            '',
            '- Item 1',
            '- Item 2',
            '',
            '> A blockquote',
            '',
            'No mermaid diagrams here.',
        ].join('\n');

        const result = await converter.convertString(md);
        assert.ok(result.outputBuffer.length > 0, 'should produce a PDF');
        assert.equal(result.outputBuffer.slice(0, 5).toString(), '%PDF-');
        assert.equal(result.diagramCount, 0, 'should report zero diagrams');
    });
});
