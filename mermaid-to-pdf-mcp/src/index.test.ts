// mermaid-to-pdf-mcp/src/index.test.ts
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { validateOptions, validatePath } from './validation.js';
import { homedir, tmpdir } from 'os';
import path from 'path';

// ---------------------------------------------------------------------------
// validateOptions
// ---------------------------------------------------------------------------
describe('validateOptions', () => {
    test('accepts empty/undefined options', () => {
        const result = validateOptions(undefined);
        assert.deepStrictEqual(result, {});
    });

    test('accepts null options', () => {
        const result = validateOptions(null);
        assert.deepStrictEqual(result, {});
    });

    test('accepts empty object', () => {
        const result = validateOptions({});
        assert.deepStrictEqual(result, {});
    });

    test('accepts theme only', () => {
        const result = validateOptions({ theme: 'dark' });
        assert.deepStrictEqual(result, { theme: 'dark' });
    });

    test('accepts pageSize only', () => {
        const result = validateOptions({ pageSize: 'Letter' });
        assert.deepStrictEqual(result, { pageSize: 'Letter' });
    });

    test('accepts full valid options', () => {
        const result = validateOptions({
            title: 'My Doc',
            theme: 'light',
            pageSize: 'A4',
        });
        assert.deepStrictEqual(result, {
            title: 'My Doc',
            theme: 'light',
            pageSize: 'A4',
        });
    });

    test('rejects invalid theme', () => {
        assert.throws(
            () => validateOptions({ theme: 'neon' }),
            (err: unknown) => {
                assert.ok(err instanceof McpError);
                assert.equal(err.code, ErrorCode.InvalidParams);
                assert.match(err.message, /Invalid theme/);
                return true;
            },
        );
    });

    test('rejects invalid pageSize', () => {
        assert.throws(
            () => validateOptions({ pageSize: 'Tabloid' }),
            (err: unknown) => {
                assert.ok(err instanceof McpError);
                assert.equal(err.code, ErrorCode.InvalidParams);
                assert.match(err.message, /Invalid pageSize/);
                return true;
            },
        );
    });

    test('rejects non-object options (string)', () => {
        assert.throws(
            () => validateOptions('bad'),
            (err: unknown) => {
                assert.ok(err instanceof McpError);
                assert.equal(err.code, ErrorCode.InvalidParams);
                assert.match(err.message, /must be an object/);
                return true;
            },
        );
    });

    test('rejects non-object options (array)', () => {
        assert.throws(
            () => validateOptions([1, 2]),
            (err: unknown) => {
                assert.ok(err instanceof McpError);
                assert.equal(err.code, ErrorCode.InvalidParams);
                assert.match(err.message, /must be an object/);
                return true;
            },
        );
    });

    test('rejects non-object options (number)', () => {
        assert.throws(
            () => validateOptions(42),
            (err: unknown) => {
                assert.ok(err instanceof McpError);
                assert.equal(err.code, ErrorCode.InvalidParams);
                assert.match(err.message, /must be an object/);
                return true;
            },
        );
    });
});

// ---------------------------------------------------------------------------
// validatePath
// ---------------------------------------------------------------------------
describe('validatePath', () => {
    test('allows paths under the home directory', () => {
        const home = homedir();
        const testPath = path.join(home, 'Documents', 'test.md');
        const result = validatePath(testPath, 'inputPath');
        assert.equal(result, testPath);
    });

    test('allows paths under /tmp', () => {
        const testPath = '/tmp/mermaid-test/output.pdf';
        const result = validatePath(testPath, 'outputPath');
        assert.equal(result, path.resolve(testPath));
    });

    test('allows paths under the current working directory', () => {
        const testPath = path.join(process.cwd(), 'output.pdf');
        const result = validatePath(testPath, 'outputPath');
        assert.equal(result, testPath);
    });

    test('rejects paths outside allowed roots', () => {
        assert.throws(
            () => validatePath('/etc/passwd', 'inputPath'),
            (err: unknown) => {
                assert.ok(err instanceof McpError);
                assert.equal(err.code, ErrorCode.InvalidParams);
                assert.match(err.message, /outside allowed directories/);
                return true;
            },
        );
    });

    test('rejects path traversal attempts', () => {
        assert.throws(
            () => validatePath('/tmp/../../etc/passwd', 'inputPath'),
            (err: unknown) => {
                assert.ok(err instanceof McpError);
                assert.equal(err.code, ErrorCode.InvalidParams);
                assert.match(err.message, /outside allowed directories/);
                return true;
            },
        );
    });

    test('returns the resolved absolute path', () => {
        const home = homedir();
        const testPath = path.join(home, 'Documents', '..', 'test.md');
        const result = validatePath(testPath, 'inputPath');
        assert.equal(result, path.resolve(testPath));
        assert.equal(result, path.join(home, 'test.md'));
    });

    test('rejects directory boundary prefix attack on home dir', () => {
        // /home/user-evil/file.pdf starts with /home/user but is NOT under it
        const home = homedir();
        const evilPath = home + '-evil/file.pdf';
        assert.throws(
            () => validatePath(evilPath, 'outputPath'),
            (err: unknown) => {
                assert.ok(err instanceof McpError);
                assert.equal(err.code, ErrorCode.InvalidParams);
                assert.match(err.message, /outside allowed directories/);
                return true;
            },
        );
    });

    test('rejects path matching /tmp prefix without separator', () => {
        // /tmpevil/file.pdf starts with /tmp but is NOT under /tmp
        assert.throws(
            () => validatePath('/tmpevil/file.pdf', 'outputPath'),
            (err: unknown) => {
                assert.ok(err instanceof McpError);
                assert.equal(err.code, ErrorCode.InvalidParams);
                assert.match(err.message, /outside allowed directories/);
                return true;
            },
        );
    });

    test('accepts paths under os.tmpdir()', () => {
        const testPath = path.join(tmpdir(), 'test.pdf');
        const result = validatePath(testPath, 'outputPath');
        assert.equal(result, path.resolve(testPath));
    });
});
