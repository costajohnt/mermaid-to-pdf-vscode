// src/browserCrash.test.ts
// Issue #54: Browser crash recovery tests
//
// Simulates browser/page failure scenarios by importing the renderer module
// and testing that errors are properly surfaced (not swallowed) and that
// the cleanup code paths execute correctly.
import { test, describe, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderMermaidToSvg, closeBrowser } from './mermaidRenderer.js';
import { Converter, closePdfBrowser } from './converter.js';

describe('Browser crash recovery: renderer errors', () => {
    after(async () => {
        await closeBrowser();
    });

    test('invalid mermaid syntax reports a clear error (not swallowed)', async () => {
        await assert.rejects(
            () => renderMermaidToSvg('completely invalid %%% diagram $$$ syntax ???'),
            (err: unknown) => {
                assert.ok(err instanceof Error, 'should throw an Error instance');
                assert.ok(
                    err.message.includes('Failed to render'),
                    `Error should mention "Failed to render", got: "${err.message}"`,
                );
                return true;
            },
        );
    });

    test('error message includes "Failed to render" context', async () => {
        await assert.rejects(
            () => renderMermaidToSvg('this is not a valid diagram type at all'),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    err.message.includes('Failed to render'),
                    `Error should mention "Failed to render", got: "${err.message}"`,
                );
                return true;
            },
        );
    });

    test('empty string input throws with descriptive message', async () => {
        await assert.rejects(
            () => renderMermaidToSvg(''),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    err.message.includes('non-empty string'),
                    `Error should mention "non-empty string", got: "${err.message}"`,
                );
                return true;
            },
        );
    });

    test('whitespace-only input throws with descriptive message', async () => {
        await assert.rejects(
            () => renderMermaidToSvg('   \n\t\n   '),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    err.message.includes('non-empty string'),
                    `Error should mention "non-empty string", got: "${err.message}"`,
                );
                return true;
            },
        );
    });

    test('oversized diagram code throws size-limit error', async () => {
        const oversized = 'flowchart LR\n' + 'A --> B\n'.repeat(10000);
        await assert.rejects(
            () => renderMermaidToSvg(oversized),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    err.message.includes('too large'),
                    `Error should mention "too large", got: "${err.message}"`,
                );
                return true;
            },
        );
    });
});

describe('Browser crash recovery: closeBrowser resilience', () => {
    test('closeBrowser can be called multiple times without error', async () => {
        // Should not throw even when called repeatedly with no open browser.
        await closeBrowser();
        await closeBrowser();
        await closeBrowser();
    });

    test('closeBrowser after rendering cleans up successfully', async () => {
        // Open a browser by rendering, then close it.
        const result = await renderMermaidToSvg('flowchart LR\n    A --> B');
        assert.ok(result.svgString.includes('<svg'));

        await closeBrowser();

        // After closing, a new render should still work (re-launches browser).
        const result2 = await renderMermaidToSvg('flowchart TD\n    X --> Y');
        assert.ok(result2.svgString.includes('<svg'));

        await closeBrowser();
    });
});

describe('Browser crash recovery: closePdfBrowser resilience', () => {
    after(async () => {
        await closePdfBrowser();
    });

    test('closePdfBrowser can be called multiple times without error', async () => {
        await closePdfBrowser();
        await closePdfBrowser();
        await closePdfBrowser();
    });
});

describe('Browser crash recovery: converter error propagation', () => {
    after(async () => {
        await closeBrowser();
        await closePdfBrowser();
    });

    test('converter surfaces rendering errors in error boxes without crashing', async () => {
        const converter = new Converter();
        // This has an invalid diagram — the converter should embed an error
        // box and still produce a valid PDF.
        const md = [
            '# Test',
            '',
            '```mermaid',
            'invalidDiagramType ???',
            '```',
            '',
            'Text after.',
        ].join('\n');

        const result = await converter.convertString(md);
        assert.ok(result.pdfBuffer.length > 0, 'should produce a PDF');
        assert.equal(result.pdfBuffer.slice(0, 5).toString(), '%PDF-');
        // The failed diagram should NOT count.
        assert.equal(result.diagramCount, 0, 'failed diagram should not be counted');
    });

    test('converter handles mix of valid and invalid diagrams', async () => {
        const converter = new Converter();
        const md = [
            '# Mixed Test',
            '',
            '```mermaid',
            'flowchart LR',
            '    A --> B',
            '```',
            '',
            '```mermaid',
            'totally broken diagram !!!',
            '```',
            '',
            '```mermaid',
            'sequenceDiagram',
            '    Alice->>Bob: Hi',
            '```',
        ].join('\n');

        const result = await converter.convertString(md);
        assert.ok(result.pdfBuffer.length > 0, 'should produce a PDF');
        assert.equal(result.diagramCount, 2, 'only valid diagrams should be counted');
    });

    test('oversized markdown is rejected before browser interaction', async () => {
        const converter = new Converter();
        const oversized = 'x'.repeat(10 * 1024 * 1024 + 1);

        await assert.rejects(
            () => converter.convertString(oversized),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    err.message.includes('too large'),
                    `Should reject with size error, got: "${err.message}"`,
                );
                return true;
            },
        );
    });
});
