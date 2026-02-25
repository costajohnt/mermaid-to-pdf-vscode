// src/cli.test.ts
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { Converter } from './converter.js';

describe('CLI Tool Tests', () => {
    test('Converter can be instantiated with defaults', () => {
        const converter = new Converter();
        assert.ok(converter);
        assert.ok(typeof converter.convertFile === 'function');
        assert.ok(typeof converter.convertString === 'function');
    });

    test('Converter accepts valid options', () => {
        const converter = new Converter({
            theme: 'dark',
            pageSize: 'Letter',
        });
        assert.ok(converter);
    });

    test('CLI module exports main', async () => {
        const { main } = await import('./cli.js');
        assert.ok(main);
    });
});
