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

    // Mermaid 12 changed defaults (ELK layout, neo look, minNodeWidth 120,
    // mindmap pulled onto dagre by a global layout). These sizes were measured
    // with mermaid 11.17.2; tolerance absorbs font differences between hosts.
    describe('mermaid 11 geometry', () => {
        const samples = {
            flowchart: { code: 'flowchart TD\n  Start --> Ok{Ok?}\n  Ok -->|yes| Done\n  Ok -->|no| Start', width: 119, height: 360 },
            state: { code: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy\n  Busy --> [*]', width: 72, height: 278 },
            mindmap: { code: 'mindmap\n  root((m))\n    A\n    B', width: 262, height: 54 },
        };
        const near = (actual: number, expected: number) =>
            Math.abs(actual - expected) <= Math.max(16, expected * 0.1);
        const neoElement = /<[a-z]+[^<>]*\sdata-look="neo"/;

        for (const [name, s] of Object.entries(samples)) {
            test(`${name} keeps its mermaid 11 size and classic look`, async () => {
                const r = await renderMermaidToSvg(s.code);
                assert.ok(near(r.width, s.width) && near(r.height, s.height),
                    `${name} is ${r.width}x${r.height}, expected about ${s.width}x${s.height}`);
                assert.ok(!neoElement.test(r.svgString), `${name} should not use the neo look`);
            });
        }

        test('user look and layout still override the defaults', async () => {
            const { code } = samples.flowchart;
            const neo = await renderMermaidToSvg(code, 'default', { look: 'neo' });
            assert.ok(neoElement.test(neo.svgString), 'look: neo should apply');

            const base = await renderMermaidToSvg(code);
            const elk = await renderMermaidToSvg(code, 'default', { layout: 'elk' });
            assert.notEqual(`${elk.width}x${elk.height}`, `${base.width}x${base.height}`, 'layout: elk should apply');

            const wide = await renderMermaidToSvg(code, 'default', { flowchart: { minNodeWidth: 200 } });
            assert.ok(wide.width > base.width + 100, 'user minNodeWidth should apply');

            const mm = await renderMermaidToSvg(samples.mindmap.code, 'default', { mindmap: { layout: 'dagre' } });
            assert.ok(!near(mm.height, samples.mindmap.height), 'mindmap.layout should apply');
        });
    });

    test('rejects empty input', async () => {
        await assert.rejects(
            () => renderMermaidToSvg(''),
            (err) => err instanceof Error && err.message.includes('non-empty string')
        );
    });
});
