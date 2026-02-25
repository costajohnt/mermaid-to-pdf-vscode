// src/diagramCache.test.ts
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { DiagramCache } from './diagramCache.js';

describe('DiagramCache', () => {
    test('returns null for cache miss', () => {
        const cache = new DiagramCache();
        assert.equal(cache.get('flowchart LR\n    A --> B'), null);
    });

    test('stores and retrieves SVG diagrams', () => {
        const cache = new DiagramCache();
        const diagram = { svgString: '<svg>test</svg>', width: 100, height: 50 };
        cache.set('flowchart LR\n    A --> B', diagram);
        const result = cache.get('flowchart LR\n    A --> B');
        assert.deepEqual(result, diagram);
    });

    test('returns null for different code', () => {
        const cache = new DiagramCache();
        const diagram = { svgString: '<svg>test</svg>', width: 100, height: 50 };
        cache.set('flowchart LR\n    A --> B', diagram);
        assert.equal(cache.get('flowchart LR\n    A --> C'), null);
    });

    test('trims whitespace for consistent hashing', () => {
        const cache = new DiagramCache();
        const diagram = { svgString: '<svg>test</svg>', width: 100, height: 50 };
        cache.set('  flowchart LR\n    A --> B  ', diagram);
        const result = cache.get('flowchart LR\n    A --> B');
        assert.deepEqual(result, diagram);
    });
});
