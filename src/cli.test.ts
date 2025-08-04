import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { FinalMermaidToPdfConverter } from './finalConverter.js';

describe('CLI Tool Tests', () => {
    test('FinalMermaidToPdfConverter can be instantiated', () => {
        const converter = new FinalMermaidToPdfConverter();
        assert.ok(converter);
        assert.ok(typeof converter.convert === 'function');
    });

    test('FinalMermaidToPdfConverter accepts valid options', () => {
        const converter = new FinalMermaidToPdfConverter({
            quality: 'high',
            theme: 'dark',
            pageSize: 'A4'
        });
        assert.ok(converter);
    });

    test('CLI tool has help functionality', async () => {
        // Test that help doesn't throw errors
        const { main } = await import('./cli.js');
        // We can't easily test the CLI without mocking process.argv, 
        // but we can at least ensure the module loads
        assert.ok(main);
    });
});