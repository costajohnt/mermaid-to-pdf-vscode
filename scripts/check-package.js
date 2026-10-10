#!/usr/bin/env node

/**
 * Pack the CLI package the way `npm publish` would, then install the tarball
 * into an empty directory and use it as a consumer would. Guards against
 * shipping a package that fails to install, lacks its type declarations,
 * carries development files, or whose bin does nothing.
 *
 * Then pack the MCP server package (mermaid-to-pdf-mcp/), install it next to
 * the CLI tarball (its dependency) in another clean project, and start its bin
 * over stdio. This catches an MCP package that imports files from outside its
 * own tarball, which only resolves inside a repo checkout. The MCP package's
 * dependencies must already be installed (npm run install:local-cli there).
 *
 * Usage: node scripts/check-package.js
 */

import { execFileSync, spawn } from 'child_process';
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

function pack(cwd) {
    const packJson = run(npm, ['pack', '--json', '--pack-destination', work], { cwd });
    const [packed] = JSON.parse(packJson.slice(packJson.indexOf('[')));
    return { files: packed.files.map(f => f.path), filename: packed.filename, tarball: join(work, packed.filename) };
}

function makeConsumer(name) {
    const dir = join(work, name);
    mkdirSync(dir);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module', private: true }));
    return dir;
}

/**
 * Start an MCP server bin, send initialize + tools/list over stdio, and
 * resolve with the tool names it lists. Rejects on early exit or timeout.
 */
function listMcpTools(bin, cwd, timeoutMs = 20_000) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(bin, [], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        let done = false;
        const finish = (fn, value) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            child.kill();
            fn(value);
        };
        const timer = setTimeout(
            () => finish(reject, new Error(`MCP server did not answer tools/list within ${timeoutMs}ms; stderr: ${stderr.slice(0, 500)}`)),
            timeoutMs,
        );
        child.on('error', err => finish(reject, err));
        child.on('exit', code => finish(reject, new Error(`MCP server exited early (code ${code}); stderr: ${stderr.slice(0, 500)}`)));
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.stdout.on('data', chunk => {
            stdout += chunk;
            for (const line of stdout.split('\n')) {
                if (!line.trim()) continue;
                let msg;
                try { msg = JSON.parse(line); } catch { continue; }
                if (msg.id === 2 && msg.result && Array.isArray(msg.result.tools)) {
                    finish(resolvePromise, msg.result.tools.map(t => t.name));
                }
            }
        });
        child.stdin.on('error', () => {});
        const send = msg => child.stdin.write(`${JSON.stringify(msg)}\n`);
        send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'check-package', version: '1.0.0' } } });
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    });
}

try {
    // 1. Pack (prepack performs a clean build).
    const packed = pack(root);
    const { files, tarball } = packed;

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
    const consumer = makeConsumer('consumer');
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

    // 5. MCP server package: pack, check contents, install beside the CLI
    //    tarball in a clean project, and start the bin over stdio.
    const mcpDir = join(root, 'mermaid-to-pdf-mcp');
    const mcp = pack(mcpDir);
    for (const f of ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/converter.js']) {
        if (!mcp.files.includes(f)) failures.push(`MCP tarball is missing ${f}`);
    }
    const mcpForbidden = [/^src\//, /^node_modules\//, /^tsconfig\.json$/, /\.test\.(js|d\.ts)$/, /\.map$/];
    for (const f of mcp.files) {
        if (mcpForbidden.some(re => re.test(f))) failures.push(`MCP tarball should not contain ${f}`);
    }
    console.log(`Packed ${mcp.filename}: ${mcp.files.length} files`);

    const mcpConsumer = makeConsumer('mcp-consumer');
    run(npm, ['install', '--no-audit', '--no-fund', tarball, mcp.tarball], {
        cwd: mcpConsumer,
        env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1' },
    });
    console.log('Installed MCP tarball (with the CLI tarball) into a clean project');

    const mcpBin = join(mcpConsumer, 'node_modules', '.bin', 'markdown-mermaid-converter-mcp');
    if (!existsSync(mcpBin)) {
        failures.push('bin markdown-mermaid-converter-mcp was not linked');
    } else {
        const tools = await listMcpTools(mcpBin, mcpConsumer);
        if (!tools.includes('convert_markdown_to_pdf')) {
            failures.push(`MCP server tools/list lacks convert_markdown_to_pdf: ${JSON.stringify(tools)}`);
        } else {
            console.log(`MCP server started and listed ${tools.length} tools`);
        }
    }
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
