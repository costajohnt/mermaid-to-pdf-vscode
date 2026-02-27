// src/cli.test.ts
import { test, describe, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Converter, closePdfBrowser } from './converter.js';
import { closeBrowser } from './mermaidRenderer.js';

const execFileAsync = promisify(execFile);

/**
 * Helper: spawn the CLI, write `input` to its stdin, close stdin, and collect
 * stdout / stderr / exit code.  Returns a promise that resolves when the
 * process exits.
 */
function runCliWithStdin(
    args: string[],
    input: string,
    timeoutMs = 60_000,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve, reject) => {
        const cliPath = join(process.cwd(), 'dist', 'cli.js');
        const child = spawn('node', [cliPath, ...args], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        child.stdout.on('data', (d: Buffer) => stdoutChunks.push(d));
        child.stderr.on('data', (d: Buffer) => stderrChunks.push(d));

        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`CLI process timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({
                stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
                stderr: Buffer.concat(stderrChunks).toString('utf-8'),
                code,
            });
        });
        child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });

        // Write content to stdin and signal EOF
        child.stdin.write(input);
        child.stdin.end();
    });
}

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

describe('CLI stdin (readStdin) tests', () => {
    const sampleMarkdown = `# Stdin Test

Some text before the diagram.

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

Some text after the diagram.
`;

    test('reads piped stdin and produces a PDF with --json', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-stdin-test-'));
        const outputPath = join(tmpDir, 'stdin-output.pdf');

        try {
            const { stdout, code } = await runCliWithStdin(
                ['-o', outputPath, '--json'],
                sampleMarkdown,
            );

            assert.equal(code, 0, 'CLI should exit with code 0');

            const result = JSON.parse(stdout.trim());
            assert.ok('outputPath' in result, 'JSON should contain outputPath');
            assert.ok('fileSize' in result, 'JSON should contain fileSize');
            assert.ok('diagramCount' in result, 'JSON should contain diagramCount');
            assert.ok('processingTimeMs' in result, 'JSON should contain processingTimeMs');

            assert.equal(result.diagramCount, 1, 'should detect 1 mermaid diagram from stdin');
            assert.ok(result.fileSize > 0, 'PDF fileSize should be > 0');

            // Verify the PDF file was actually written
            const stat = await fs.stat(outputPath);
            assert.ok(stat.size > 0, 'PDF file should exist and be non-empty');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });

    test('reads plain markdown (no diagrams) from stdin', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-stdin-plain-'));
        const outputPath = join(tmpDir, 'plain-output.pdf');

        try {
            const { stdout, code } = await runCliWithStdin(
                ['-o', outputPath, '--json'],
                '# Hello World\n\nJust plain markdown, no diagrams.\n',
            );

            assert.equal(code, 0, 'CLI should exit with code 0');

            const result = JSON.parse(stdout.trim());
            assert.equal(result.diagramCount, 0, 'should detect 0 mermaid diagrams');
            assert.ok(result.fileSize > 0, 'PDF should still be produced');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });

    test('errors when stdin is used without --output', async () => {
        // Pass --json so argv is non-empty (bypasses the help guard),
        // but omit -o: the CLI should complain that --output is required
        const { stderr, code } = await runCliWithStdin(
            ['--json'],
            sampleMarkdown,
        );

        assert.notEqual(code, 0, 'CLI should exit with non-zero code');
        assert.ok(
            stderr.includes('--output is required'),
            `stderr should mention --output is required, got: ${stderr}`,
        );
    });

    test('stdin respects --theme and --page options', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-stdin-opts-'));
        const outputPath = join(tmpDir, 'opts-output.pdf');

        try {
            const { stdout, code } = await runCliWithStdin(
                ['-o', outputPath, '-t', 'dark', '-p', 'Letter', '--json'],
                sampleMarkdown,
            );

            assert.equal(code, 0, 'CLI should exit with code 0');

            const result = JSON.parse(stdout.trim());
            assert.equal(result.diagramCount, 1, 'should detect 1 diagram');
            assert.ok(result.fileSize > 0, 'PDF should be produced');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });
});

describe('CLI --watch flag', () => {
    const cliPath = join(process.cwd(), 'dist', 'cli.js');

    test('--watch flag is parsed (long form)', async () => {
        // --watch without an input file should error with a specific message
        const { stderr, code } = await runCliWithStdin(
            ['--watch'],
            '# test\n',
        );

        assert.notEqual(code, 0, 'CLI should exit with non-zero code');
        assert.ok(
            stderr.includes('--watch requires an input file'),
            `stderr should mention --watch requires an input file, got: ${stderr}`,
        );
    });

    test('-w flag is parsed (short form)', async () => {
        // -w without an input file should error with a specific message
        const { stderr, code } = await runCliWithStdin(
            ['-w'],
            '# test\n',
        );

        assert.notEqual(code, 0, 'CLI should exit with non-zero code');
        assert.ok(
            stderr.includes('--watch requires an input file'),
            `stderr should mention --watch requires an input file, got: ${stderr}`,
        );
    });

    test('--watch requires an input file (not stdin)', async () => {
        // Pipe content via stdin with --watch but no input file
        const { stderr, code } = await runCliWithStdin(
            ['--watch', '-o', '/tmp/watch-test-output.pdf'],
            '# test\n',
        );

        assert.notEqual(code, 0, 'CLI should exit with non-zero code');
        assert.ok(
            stderr.includes('cannot watch stdin'),
            `stderr should mention cannot watch stdin, got: ${stderr}`,
        );
    });

    test('--watch with a non-existent file produces an error', async () => {
        const nonExistentFile = join(tmpdir(), 'cli-watch-noexist-' + Date.now() + '.md');

        try {
            await execFileAsync('node', [
                cliPath,
                nonExistentFile,
                '--watch',
            ], { timeout: 30_000 });
            assert.fail('CLI should have exited with non-zero code');
        } catch (err: unknown) {
            const execErr = err as { stderr?: string; code?: number };
            assert.ok(
                execErr.stderr?.includes('does not exist'),
                `stderr should mention file does not exist, got: ${execErr.stderr}`,
            );
        }
    });
});

describe('CLI --format flag', () => {
    const cliPath = join(process.cwd(), 'dist', 'cli.js');

    test('--format html produces an .html file', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-format-html-'));
        const inputFile = join(tmpDir, 'doc.md');
        const outputFile = join(tmpDir, 'doc.html');
        await fs.writeFile(inputFile, '# HTML Test\n\nSome content.\n');

        try {
            const { stdout } = await execFileAsync('node', [
                cliPath,
                inputFile,
                '-f', 'html',
                '-o', outputFile,
                '--json',
            ], { timeout: 60_000 });

            const result = JSON.parse(stdout.trim());
            assert.ok(result.outputPath.endsWith('.html'), 'outputPath should end with .html');
            assert.ok(result.fileSize > 0, 'fileSize should be > 0');

            // Verify the file exists and contains HTML content
            const content = await fs.readFile(outputFile, 'utf-8');
            assert.ok(content.includes('<!DOCTYPE html>'), 'output should be valid HTML');
            assert.ok(content.includes('HTML Test'), 'output should contain the heading');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });

    test('--format docx produces a .docx file', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-format-docx-'));
        const inputFile = join(tmpDir, 'doc.md');
        const outputFile = join(tmpDir, 'doc.docx');
        await fs.writeFile(inputFile, '# DOCX Test\n\nSome content for DOCX.\n');

        try {
            const { stdout } = await execFileAsync('node', [
                cliPath,
                inputFile,
                '-f', 'docx',
                '-o', outputFile,
                '--json',
            ], { timeout: 60_000 });

            const result = JSON.parse(stdout.trim());
            assert.ok(result.outputPath.endsWith('.docx'), 'outputPath should end with .docx');
            assert.ok(result.fileSize > 0, 'fileSize should be > 0');

            // Verify the DOCX file exists and has content
            const stat = await fs.stat(outputFile);
            assert.ok(stat.size > 0, 'DOCX file should be non-empty');

            // DOCX files are ZIP-based; the first bytes should be the ZIP magic number PK
            const buf = await fs.readFile(outputFile);
            assert.equal(buf[0], 0x50, 'DOCX should start with PK (0x50)');
            assert.equal(buf[1], 0x4B, 'DOCX should start with PK (0x4B)');
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });

    test('--format invalid produces an error', async () => {
        const tmpDir = await fs.mkdtemp(join(tmpdir(), 'cli-format-invalid-'));
        const inputFile = join(tmpDir, 'doc.md');
        await fs.writeFile(inputFile, '# Test\n');

        try {
            await execFileAsync('node', [
                cliPath,
                inputFile,
                '-f', 'pptx',
            ], { timeout: 30_000 });
            assert.fail('CLI should have exited with non-zero code for invalid format');
        } catch (err: unknown) {
            const execErr = err as { stderr?: string; code?: number };
            assert.ok(
                execErr.stderr?.includes('Invalid format') ||
                execErr.stderr?.includes('Must be'),
                `stderr should mention invalid format, got: ${execErr.stderr}`,
            );
        } finally {
            await fs.rm(tmpDir, { recursive: true });
        }
    });
});
