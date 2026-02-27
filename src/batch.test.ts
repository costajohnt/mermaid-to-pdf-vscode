// src/batch.test.ts — Tests for batch processing and glob pattern support
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);
const cliPath = join(process.cwd(), 'dist', 'cli.js');

describe('CLI batch processing', () => {
    test('multiple file arguments are collected and processed with --json', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-batch-'));
        const outdir = join(tmpDir, 'output');

        const file1 = join(tmpDir, 'doc1.md');
        const file2 = join(tmpDir, 'doc2.md');
        await fs.writeFile(file1, '# Doc 1\n\nHello from doc 1.\n');
        await fs.writeFile(file2, '# Doc 2\n\nHello from doc 2.\n');

        try {
            const { stdout } = await execFileAsync('node', [
                cliPath,
                file1, file2,
                '--outdir', outdir,
                '--json',
            ], { timeout: 120_000 });

            const results = JSON.parse(stdout.trim());

            assert.ok(Array.isArray(results), 'batch JSON output should be an array');
            assert.equal(results.length, 2, 'should have 2 results');

            for (const entry of results) {
                assert.ok('outputPath' in entry, 'each entry should have outputPath');
                assert.ok('fileSize' in entry, 'each entry should have fileSize');
                assert.ok('diagramCount' in entry, 'each entry should have diagramCount');
                assert.ok('processingTimeMs' in entry, 'each entry should have processingTimeMs');
                assert.ok(entry.fileSize > 0, 'fileSize should be > 0');
            }

            const stat1 = await fs.stat(join(outdir, 'doc1.pdf'));
            const stat2 = await fs.stat(join(outdir, 'doc2.pdf'));
            assert.ok(stat1.size > 0, 'doc1.pdf should exist and be non-empty');
            assert.ok(stat2.size > 0, 'doc2.pdf should exist and be non-empty');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });

    test('--outdir creates nested output directories', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-batch-outdir-'));
        const outdir = join(tmpDir, 'nested', 'deep', 'output');
        const file1 = join(tmpDir, 'test.md');
        const file2 = join(tmpDir, 'test2.md');
        await fs.writeFile(file1, '# Test\n');
        await fs.writeFile(file2, '# Test2\n');

        try {
            await execFileAsync('node', [
                cliPath,
                file1, file2,
                '--outdir', outdir,
            ], { timeout: 120_000 });

            const stat = await fs.stat(outdir);
            assert.ok(stat.isDirectory(), 'outdir should be created');
            const files = await fs.readdir(outdir);
            assert.ok(files.includes('test.pdf'), 'test.pdf should be in outdir');
            assert.ok(files.includes('test2.pdf'), 'test2.pdf should be in outdir');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });

    test('batch mode produces per-file sibling output without --outdir', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-batch-nooutdir-'));
        const file1 = join(tmpDir, 'alpha.md');
        const file2 = join(tmpDir, 'beta.md');
        await fs.writeFile(file1, '# Alpha\n');
        await fs.writeFile(file2, '# Beta\n');

        try {
            await execFileAsync('node', [
                cliPath,
                file1, file2,
            ], { timeout: 120_000 });

            const stat1 = await fs.stat(join(tmpDir, 'alpha.pdf'));
            const stat2 = await fs.stat(join(tmpDir, 'beta.pdf'));
            assert.ok(stat1.size > 0, 'alpha.pdf should exist');
            assert.ok(stat2.size > 0, 'beta.pdf should exist');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });

    test('-o/--output errors when used with multiple files', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-batch-err-'));
        const file1 = join(tmpDir, 'a.md');
        const file2 = join(tmpDir, 'b.md');
        await fs.writeFile(file1, '# A\n');
        await fs.writeFile(file2, '# B\n');

        try {
            await execFileAsync('node', [
                cliPath,
                file1, file2,
                '-o', join(tmpDir, 'out.pdf'),
            ], { timeout: 30_000 });
            assert.fail('CLI should have exited with non-zero code');
        } catch (err: unknown) {
            const execErr = err as { stderr?: string; code?: number };
            assert.ok(
                execErr.stderr?.includes('--output cannot be used with multiple input files'),
                `stderr should mention --output conflict, got: ${execErr.stderr}`,
            );
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });

    test('single file mode is backward compatible (returns object not array)', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-single-'));
        const file = join(tmpDir, 'single.md');
        const outputPath = join(tmpDir, 'single.pdf');
        await fs.writeFile(file, '# Single File\n\nBackward compatible test.\n');

        try {
            const { stdout } = await execFileAsync('node', [
                cliPath,
                file,
                '-o', outputPath,
                '--json',
            ], { timeout: 60_000 });

            const result = JSON.parse(stdout.trim());

            assert.ok(!Array.isArray(result), 'single file mode should return an object');
            assert.ok('outputPath' in result, 'should have outputPath');
            assert.ok('fileSize' in result, 'should have fileSize');
            assert.ok(result.fileSize > 0, 'fileSize should be > 0');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });

    test('single file without --outdir produces sibling PDF', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-outdir-parse-'));
        const file = join(tmpDir, 'test.md');
        await fs.writeFile(file, '# Test\n');

        try {
            await execFileAsync('node', [
                cliPath,
                file,
            ], { timeout: 60_000 });

            // Verify output was created as sibling
            const stat = await fs.stat(join(tmpDir, 'test.pdf'));
            assert.ok(stat.size > 0, 'test.pdf should be created as sibling');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });
});
