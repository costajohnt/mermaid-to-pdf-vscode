#!/usr/bin/env node

/**
 * Sanity-check the version fields of the two packages in this repo.
 *
 * The CLI (markdown-mermaid-converter-cli) and the MCP server
 * (markdown-mermaid-converter-mcp) are published separately and have
 * independent version lines on npm, so their versions are NOT required to
 * match. What must hold:
 *   - both package.json files carry a valid semver version, and
 *   - the version the MCP server advertises at runtime (src/index.ts) equals
 *     its package.json version.
 * Exits non-zero on any violation so CI catches drift.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function read(relativePath) {
    const fullPath = resolve(root, relativePath);
    try {
        return readFileSync(fullPath, 'utf-8');
    } catch (err) {
        console.error(`Failed to read ${fullPath}: ${err.message}`);
        process.exit(1);
    }
}

const errors = [];
const cliVersion = JSON.parse(read('package.json')).version;
const mcpVersion = JSON.parse(read('mermaid-to-pdf-mcp/package.json')).version;

if (typeof cliVersion !== 'string' || !SEMVER.test(cliVersion)) {
    errors.push(`CLI package.json has an invalid "version": ${JSON.stringify(cliVersion)}`);
}
if (typeof mcpVersion !== 'string' || !SEMVER.test(mcpVersion)) {
    errors.push(`MCP server package.json has an invalid "version": ${JSON.stringify(mcpVersion)}`);
}

const serverSource = read('mermaid-to-pdf-mcp/src/index.ts');
const advertised = serverSource.match(/name:\s*'markdown-mermaid-converter',\s*version:\s*'([^']+)'/);
if (!advertised) {
    errors.push('Could not find the advertised server version in mermaid-to-pdf-mcp/src/index.ts');
} else if (advertised[1] !== mcpVersion) {
    errors.push(
        `MCP server advertises version ${advertised[1]} but its package.json is ${mcpVersion}. ` +
        'Update the version in mermaid-to-pdf-mcp/src/index.ts.'
    );
}

if (errors.length > 0) {
    for (const e of errors) console.error(e);
    process.exit(1);
}

console.log(`Versions OK: CLI ${cliVersion}, MCP server ${mcpVersion}`);
