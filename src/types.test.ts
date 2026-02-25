// src/types.test.ts
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { getBrowserArgs } from './types.js';

describe('getBrowserArgs', () => {
    test('always includes --disable-dev-shm-usage and --disable-gpu', () => {
        const args = getBrowserArgs();
        assert.ok(args.includes('--disable-dev-shm-usage'), 'should include --disable-dev-shm-usage');
        assert.ok(args.includes('--disable-gpu'), 'should include --disable-gpu');
    });

    test('does NOT include --no-sandbox when not in CI and not root', () => {
        const origCI = process.env.CI;
        delete process.env.CI;
        try {
            const args = getBrowserArgs();
            assert.ok(!args.includes('--no-sandbox'), 'should not include --no-sandbox');
            assert.ok(!args.includes('--disable-setuid-sandbox'), 'should not include --disable-setuid-sandbox');
        } finally {
            if (origCI !== undefined) {
                process.env.CI = origCI;
            }
        }
    });

    test('includes --no-sandbox and --disable-setuid-sandbox when CI=true', () => {
        const origCI = process.env.CI;
        process.env.CI = 'true';
        try {
            const args = getBrowserArgs();
            assert.ok(args.includes('--no-sandbox'), 'should include --no-sandbox in CI');
            assert.ok(args.includes('--disable-setuid-sandbox'), 'should include --disable-setuid-sandbox in CI');
        } finally {
            if (origCI !== undefined) {
                process.env.CI = origCI;
            } else {
                delete process.env.CI;
            }
        }
    });

    test('returns a fresh array on each call (no shared mutable state)', () => {
        const a = getBrowserArgs();
        const b = getBrowserArgs();
        assert.notStrictEqual(a, b, 'each call should return a distinct array');
        assert.deepStrictEqual(a, b, 'arrays should have the same contents');

        a.push('--extra-flag');
        const c = getBrowserArgs();
        assert.ok(!c.includes('--extra-flag'), 'mutating a previous result should not affect future calls');
    });
});
