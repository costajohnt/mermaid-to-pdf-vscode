// src/accessibility.test.ts
import { test, describe, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { Converter, closePdfBrowser } from './converter.js';
import { closeBrowser } from './mermaidRenderer.js';

describe('Accessibility', () => {
    after(async () => {
        await closeBrowser();
        await closePdfBrowser();
    });

    test('alt text is parsed from mermaid code block and wraps SVG in figure', async () => {
        const converter = new Converter({ format: 'html' });
        const md = [
            '# Test',
            '',
            '```mermaid alt="Flowchart showing login process"',
            'flowchart LR',
            '    A --> B',
            '```',
        ].join('\n');

        const result = await converter.convertString(md);
        const html = result.htmlString!;

        // Should use <figure> with role="img" and aria-label
        assert.ok(
            html.includes('role="img"'),
            'Expected figure element with role="img"',
        );
        assert.ok(
            html.includes('aria-label="Flowchart showing login process"'),
            'Expected aria-label with alt text',
        );

        // Should include visually-hidden figcaption
        assert.ok(
            html.includes('<figcaption class="sr-only">Flowchart showing login process</figcaption>'),
            'Expected sr-only figcaption with alt text',
        );
    });

    test('diagram without alt text uses plain div (no figure)', async () => {
        const converter = new Converter({ format: 'html' });
        const md = [
            '# Test',
            '',
            '```mermaid',
            'flowchart LR',
            '    A --> B',
            '```',
        ].join('\n');

        const result = await converter.convertString(md);
        const html = result.htmlString!;

        // Should use <div>, NOT <figure>
        assert.ok(
            html.includes('<div class="mermaid-diagram'),
            'Expected div container for diagram without alt text',
        );
        assert.ok(
            !html.includes('<figure'),
            'Should not use figure when no alt text is provided',
        );
    });

    test('lang attribute is set on HTML output', async () => {
        const converter = new Converter({ format: 'html', lang: 'fr' });
        const md = '# Bonjour\n\nContenu en francais.\n';

        const result = await converter.convertString(md);
        const html = result.htmlString!;

        assert.ok(
            html.includes('<html lang="fr">'),
            'Expected lang="fr" on html element',
        );
    });

    test('default lang is "en" when not specified', async () => {
        const converter = new Converter({ format: 'html' });
        const md = '# Hello\n\nEnglish content.\n';

        const result = await converter.convertString(md);
        const html = result.htmlString!;

        assert.ok(
            html.includes('<html lang="en">'),
            'Expected default lang="en" on html element',
        );
    });

    test('sr-only CSS class is present in output', async () => {
        const converter = new Converter({ format: 'html' });
        const md = '# Test\n\nContent.\n';

        const result = await converter.convertString(md);
        const html = result.htmlString!;

        assert.ok(
            html.includes('.sr-only'),
            'Expected .sr-only CSS class in stylesheet',
        );
    });

    test('alt text with special characters is properly escaped', async () => {
        const converter = new Converter({ format: 'html' });
        const md = [
            '```mermaid alt="Diagram <showing> A & B"',
            'flowchart LR',
            '    A --> B',
            '```',
        ].join('\n');

        const result = await converter.convertString(md);
        const html = result.htmlString!;

        assert.ok(
            html.includes('aria-label="Diagram &lt;showing&gt; A &amp; B"'),
            'Expected HTML-escaped alt text in aria-label',
        );
        assert.ok(
            html.includes('Diagram &lt;showing&gt; A &amp; B</figcaption>'),
            'Expected HTML-escaped alt text in figcaption',
        );
    });
});
