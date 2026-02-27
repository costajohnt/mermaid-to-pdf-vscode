// src/math.test.ts
import { test, describe, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { Converter, closePdfBrowser } from './converter.js';
import { closeBrowser } from './mermaidRenderer.js';

describe('KaTeX Math Rendering', () => {
    after(async () => {
        await closeBrowser();
        await closePdfBrowser();
    });

    test('Converter accepts math option', () => {
        const converter = new Converter({ math: true });
        assert.ok(converter);
    });

    test('math defaults to disabled (no KaTeX processing)', async () => {
        const converter = new Converter();
        const md = '# Test\n\nInline math: $E = mc^2$\n';
        const result = await converter.convertString(md);
        assert.ok(result.outputBuffer.length > 0);
    });

    test('inline math ($...$) renders KaTeX HTML when math is enabled', async () => {
        const converter = new Converter({ math: true, format: 'html' });
        const md = '# Math Test\n\nInline: $E = mc^2$\n';
        const result = await converter.convertString(md);
        assert.ok(result.htmlString, 'HTML output should be present');
        assert.ok(
            result.htmlString!.includes('class="katex"'),
            'HTML should contain KaTeX-rendered math with class="katex"',
        );
        assert.ok(
            result.htmlString!.includes('KaTeX math styles'),
            'HTML should contain inlined KaTeX CSS',
        );
    });

    test('block math ($$...$$) renders KaTeX HTML when math is enabled', async () => {
        const converter = new Converter({ math: true, format: 'html' });
        const md = '# Block Math\n\n$$\\sum_{i=1}^{n} x_i$$\n';
        const result = await converter.convertString(md);
        assert.ok(result.htmlString, 'HTML output should be present');
        assert.ok(
            result.htmlString!.includes('katex-display'),
            'HTML should contain katex-display for block math',
        );
    });

    test('math and mermaid diagrams work together', async () => {
        const converter = new Converter({ math: true, format: 'html' });
        const md = [
            '# Combined Test',
            '',
            'The equation $E = mc^2$ relates energy and mass.',
            '',
            '```mermaid',
            'flowchart LR',
            '    A[Start] --> B[End]',
            '```',
            '',
            'Block math:',
            '',
            '$$\\int_0^\\infty e^{-x} dx = 1$$',
            '',
        ].join('\n');

        const result = await converter.convertString(md);
        assert.ok(result.htmlString, 'HTML output should be present');
        assert.equal(result.diagramCount, 1, 'should have 1 mermaid diagram');
        assert.ok(
            result.htmlString!.includes('class="katex"'),
            'HTML should contain KaTeX-rendered inline math',
        );
        assert.ok(
            result.htmlString!.includes('mermaid-diagram'),
            'HTML should contain rendered mermaid diagram',
        );
    });

    test('KaTeX CSS includes base64-encoded fonts', async () => {
        const converter = new Converter({ math: true, format: 'html' });
        const md = 'Math: $x^2$\n';
        const result = await converter.convertString(md);
        assert.ok(result.htmlString, 'HTML output should be present');
        assert.ok(
            result.htmlString!.includes('data:font/woff2;base64,'),
            'KaTeX CSS should contain base64-encoded woff2 fonts',
        );
    });

    test('font-src data: is in CSP when math is enabled', async () => {
        const converter = new Converter({ math: true, format: 'html' });
        const md = 'Math: $x$\n';
        const result = await converter.convertString(md);
        assert.ok(result.htmlString, 'HTML output should be present');
        assert.ok(
            result.htmlString!.includes('font-src data:'),
            'CSP should allow font-src data: for base64 fonts',
        );
    });

    test('no KaTeX CSS injected when math is disabled', async () => {
        const converter = new Converter({ format: 'html' });
        const md = '# No Math\n\nPlain text $not math$.\n';
        const result = await converter.convertString(md);
        assert.ok(result.htmlString, 'HTML output should be present');
        assert.ok(
            !result.htmlString!.includes('KaTeX math styles'),
            'HTML should NOT contain KaTeX CSS when math is disabled',
        );
    });
});
