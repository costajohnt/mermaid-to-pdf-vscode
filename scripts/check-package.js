#!/usr/bin/env node

/**
 * Pack the CLI package the way `npm publish` would, then install the tarball
 * into an empty directory and use it as a consumer would. Guards against
 * shipping a package that fails to install, lacks its type declarations,
 * carries development files, or whose bin does nothing.
 *
 * Usage: node scripts/check-package.js
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const work = mkdtempSync(join(tmpdir(), 'mmc-pack-'));
const failures = [];

function run(cmd, args, opts = {}) {
    return execFileSync(cmd, args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

try {
    // 1. Pack (prepack performs a clean build).
    const packJson = run(npm, ['pack', '--json', '--pack-destination', work], { cwd: root });
    const [packed] = JSON.parse(packJson.slice(packJson.indexOf('[')));
    const files = packed.files.map(f => f.path);
    const tarball = join(work, packed.filename);

    const required = [
        'package.json',
        'README.md',
        'LICENSE',
        'dist/cli.js',
        'dist/index.js',
        'dist/index.d.ts',
        'dist/types.d.ts',
        'dist/vendor/mermaid.min.js',
    ];
    for (const f of required) {
        if (!files.includes(f)) failures.push(`tarball is missing ${f}`);
    }
    const forbidden = [
        /^src\//,
        /^scripts\//,
        /^benchmarks\//,
        /^\.serena\//,
        /^\.github\//,
        /^mermaid-to-pdf-mcp\//,
        /^eslint\.config\.js$/,
        /\.test\.(js|d\.ts)$/,
        /\.map$/,
        /^dist\/vendor\/vendor\//,
    ];
    for (const f of files) {
        if (forbidden.some(re => re.test(f))) failures.push(`tarball should not contain ${f}`);
    }
    console.log(`Packed ${packed.filename}: ${files.length} files`);

    // 2. Install into an empty consumer project.
    const consumer = join(work, 'consumer');
    mkdirSync(consumer);
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'consumer', version: '1.0.0', type: 'module', private: true }));
    run(npm, ['install', '--no-audit', '--no-fund', tarball], {
        cwd: consumer,
        env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1' },
    });
    console.log('Installed tarball into a clean project');

    // 3. The bin runs through node_modules/.bin (a symlink) and prints usage.
    const bin = join(consumer, 'node_modules', '.bin', 'markdown-mermaid-converter');
    if (!existsSync(bin)) {
        failures.push('bin markdown-mermaid-converter was not linked');
    } else {
        const help = run(bin, ['--help'], { cwd: consumer });
        if (!/usage/i.test(help)) failures.push(`bin --help printed no usage text: ${JSON.stringify(help.slice(0, 200))}`);
        else console.log('bin --help printed usage');
    }

    // 4. The library entry point imports and exposes its public API.
    const probe = "const m = await import('markdown-mermaid-converter-cli'); " +
        "for (const k of ['Converter', 'renderMermaidToSvg', 'DiagramCache', 'loadConfigFile']) " +
        "{ if (typeof m[k] !== 'function') { console.error('missing export ' + k); process.exit(1); } }";
    run(process.execPath, ['--input-type=module', '-e', probe], { cwd: consumer });
    console.log('Library import exposes the public API');

    const pkgDir = join(consumer, 'node_modules', 'markdown-mermaid-converter-cli');
    if (existsSync(join(pkgDir, 'src'))) failures.push('install created a src/ directory (postinstall leak)');
    if (!readdirSync(join(pkgDir, 'dist')).includes('index.d.ts')) failures.push('installed package has no dist/index.d.ts');
} catch (err) {
    failures.push(`${err.message}${err.stderr ? `\n${err.stderr}` : ''}`);
} finally {
    rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
    console.error('Package check failed:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
}
console.log('Package check passed');
