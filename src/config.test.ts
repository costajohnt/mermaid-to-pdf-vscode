// src/config.test.ts
import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfigFile, mergeConfig } from './config.js';
import type { MermaidrcConfig } from './config.js';
import type { ConversionOptions } from './types.js';

// ---------------------------------------------------------------------------
// mergeConfig (pure function — no filesystem)
// ---------------------------------------------------------------------------
describe('mergeConfig', () => {
    test('returns empty when both inputs are empty', () => {
        const result = mergeConfig({}, {});
        assert.deepStrictEqual(result, {});
    });

    test('passes through config file values', () => {
        const fileConfig: MermaidrcConfig = { theme: 'dark', pageSize: 'Letter' };
        const result = mergeConfig(fileConfig, {});
        assert.deepStrictEqual(result, { theme: 'dark', pageSize: 'Letter' });
    });

    test('passes through CLI flag values', () => {
        const cliFlags: Partial<ConversionOptions> = { theme: 'light', pageSize: 'Legal' };
        const result = mergeConfig({}, cliFlags);
        assert.deepStrictEqual(result, { theme: 'light', pageSize: 'Legal' });
    });

    test('CLI flags override config file values', () => {
        const fileConfig: MermaidrcConfig = { theme: 'dark', pageSize: 'A4' };
        const cliFlags: Partial<ConversionOptions> = { theme: 'light' };
        const result = mergeConfig(fileConfig, cliFlags);
        assert.equal(result.theme, 'light');
        assert.equal(result.pageSize, 'A4');
    });

    test('merges margins from config file', () => {
        const fileConfig: MermaidrcConfig = {
            margins: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        };
        const result = mergeConfig(fileConfig, {});
        assert.deepStrictEqual(result.margins, {
            top: '20mm', right: '15mm', bottom: '20mm', left: '15mm',
        });
    });

    test('CLI margin flags override config file margins', () => {
        const fileConfig: MermaidrcConfig = {
            margins: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        };
        const cliFlags: Partial<ConversionOptions> = {
            margins: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        };
        const result = mergeConfig(fileConfig, cliFlags);
        assert.deepStrictEqual(result.margins, {
            top: '10mm', right: '10mm', bottom: '10mm', left: '10mm',
        });
    });
});

// ---------------------------------------------------------------------------
// loadConfigFile (filesystem-dependent)
// ---------------------------------------------------------------------------
describe('loadConfigFile', () => {
    let tmpDir: string;
    let originalCwd: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'config-test-'));
        originalCwd = process.cwd();
    });

    afterEach(() => {
        process.chdir(originalCwd);
        rmSync(tmpDir, { recursive: true, force: true });
    });

    test('returns empty config when no .mermaidrc.json exists', () => {
        process.chdir(tmpDir);
        const config = loadConfigFile();
        assert.deepStrictEqual(config, {});
    });

    test('loads config from current directory', () => {
        const configData = { theme: 'dark', pageSize: 'Letter' };
        writeFileSync(join(tmpDir, '.mermaidrc.json'), JSON.stringify(configData));
        process.chdir(tmpDir);
        const config = loadConfigFile();
        assert.equal(config.theme, 'dark');
        assert.equal(config.pageSize, 'Letter');
    });

    test('loads config with margins', () => {
        const configData = {
            margins: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        };
        writeFileSync(join(tmpDir, '.mermaidrc.json'), JSON.stringify(configData));
        process.chdir(tmpDir);
        const config = loadConfigFile();
        assert.deepStrictEqual(config.margins, {
            top: '20mm', right: '15mm', bottom: '20mm', left: '15mm',
        });
    });

    test('rejects invalid theme in config file', () => {
        const configData = { theme: 'neon' };
        writeFileSync(join(tmpDir, '.mermaidrc.json'), JSON.stringify(configData));
        process.chdir(tmpDir);
        assert.throws(
            () => loadConfigFile(),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.match(err.message, /Invalid config file/);
                assert.match(err.message, /theme/);
                return true;
            },
        );
    });

    test('rejects invalid pageSize in config file', () => {
        const configData = { pageSize: 'Tabloid' };
        writeFileSync(join(tmpDir, '.mermaidrc.json'), JSON.stringify(configData));
        process.chdir(tmpDir);
        assert.throws(
            () => loadConfigFile(),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.match(err.message, /Invalid config file/);
                assert.match(err.message, /pageSize/);
                return true;
            },
        );
    });

    test('rejects invalid margin value in config file', () => {
        const configData = { margins: { top: 'bad' } };
        writeFileSync(join(tmpDir, '.mermaidrc.json'), JSON.stringify(configData));
        process.chdir(tmpDir);
        assert.throws(
            () => loadConfigFile(),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.match(err.message, /Invalid config file/);
                assert.match(err.message, /margins\.top/);
                return true;
            },
        );
    });

    test('throws on malformed JSON with actionable message', () => {
        writeFileSync(join(tmpDir, '.mermaidrc.json'), '{bad json}');
        process.chdir(tmpDir);
        assert.throws(
            () => loadConfigFile(),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.match(err.message, /invalid JSON/);
                return true;
            },
        );
    });
});
