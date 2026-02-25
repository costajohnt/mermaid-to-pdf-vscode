// src/mermaidRenderer.test.ts
import { test, describe, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderMermaidToSvg, closeBrowser } from './mermaidRenderer.js';

describe('mermaidRenderer', () => {
    after(async () => {
        await closeBrowser();
    });

    test('renders a simple flowchart to SVG with dimensions', async () => {
        const result = await renderMermaidToSvg('flowchart LR\n    A --> B');
        assert.ok(result.svgString.includes('<svg'), 'should contain SVG element');
        assert.ok(result.svgString.includes('</svg>'), 'should have closing SVG tag');
        assert.ok(result.width > 0, 'width should be positive');
        assert.ok(result.height > 0, 'height should be positive');
    });

    test('renders a sequence diagram to SVG', async () => {
        const result = await renderMermaidToSvg(
            'sequenceDiagram\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi'
        );
        assert.ok(result.svgString.includes('<svg'));
        assert.ok(result.width > 0);
        assert.ok(result.height > 0);
    });

    test('throws on invalid mermaid syntax', async () => {
        await assert.rejects(
            () => renderMermaidToSvg('this is not valid mermaid'),
            (err) => err instanceof Error && err.message.includes('Failed to render')
        );
    });

    test('rejects empty input', async () => {
        await assert.rejects(
            () => renderMermaidToSvg(''),
            (err) => err instanceof Error && err.message.includes('non-empty string')
        );
    });
});
