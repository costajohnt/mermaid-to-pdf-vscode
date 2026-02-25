// src/cli.test.ts
import { test, describe, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Converter, closePdfBrowser } from './converter.js';
import { closeBrowser } from './mermaidRenderer.js';

const execFileAsync = promisify(execFile);

describe('CLI Tool Tests', () => {
    after(async () => {
        await closeBrowser();
        await closePdfBrowser();
    });

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

describe('CLI --json flag', () => {
    const cliPath = join(process.cwd(), 'dist', 'cli.js');
    const fixturePath = join(process.cwd(), 'test-fixtures', 'sample.md');

    test('--json outputs valid JSON with correct fields on success', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-json-test-'));
        const outputPath = join(tmpDir, 'output.pdf');

        try {
            const { stdout } = await execFileAsync('node', [
                cliPath,
                fixturePath,
                '-o', outputPath,
                '--json',
            ], { timeout: 60_000 });

            const result = JSON.parse(stdout.trim());

            // Verify all expected fields exist
            assert.ok('outputPath' in result, 'JSON should contain outputPath');
            assert.ok('fileSize' in result, 'JSON should contain fileSize');
            assert.ok('diagramCount' in result, 'JSON should contain diagramCount');
            assert.ok('processingTimeMs' in result, 'JSON should contain processingTimeMs');

            // Verify types
            assert.equal(typeof result.outputPath, 'string', 'outputPath should be a string');
            assert.equal(typeof result.fileSize, 'number', 'fileSize should be a number');
            assert.equal(typeof result.diagramCount, 'number', 'diagramCount should be a number');
            assert.equal(typeof result.processingTimeMs, 'number', 'processingTimeMs should be a number');

            // Verify values
            assert.ok(result.fileSize > 0, 'fileSize should be > 0');
            assert.ok(result.diagramCount >= 0, 'diagramCount should be >= 0');
            assert.ok(result.processingTimeMs >= 0, 'processingTimeMs should be >= 0');

            // sample.md has 4 mermaid diagrams
            assert.equal(result.diagramCount, 4, 'sample.md should have 4 diagrams');

            // outputPath should match what we passed
            assert.ok(result.outputPath.endsWith('output.pdf'), 'outputPath should end with output.pdf');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });

    test('--json outputs error JSON on failure', async () => {
        const nonExistentFile = join(tmpdir(), 'does-not-exist-' + Date.now() + '.md');

        try {
            await execFileAsync('node', [
                cliPath,
                nonExistentFile,
                '--json',
            ], { timeout: 30_000 });
            assert.fail('CLI should have exited with non-zero code');
        } catch (err: unknown) {
            // execFile rejects when process exits with non-zero code
            const execErr = err as { stdout?: string; stderr?: string; code?: number };
            assert.ok(execErr.stdout, 'stdout should contain JSON error output');

            const result = JSON.parse(execErr.stdout.trim());
            assert.ok('error' in result, 'JSON error output should contain error field');
            assert.equal(typeof result.error, 'string', 'error should be a string');
            assert.ok(result.error.length > 0, 'error message should be non-empty');
        }
    });
});
