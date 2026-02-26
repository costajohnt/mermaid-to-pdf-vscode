#!/usr/bin/env node

/**
 * Verify that the CLI and MCP server package.json files declare the same
 * version number.  Exits non-zero when the versions differ so CI catches
 * accidental drift.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadPackageJson(relativePath) {
    const fullPath = resolve(root, relativePath);
    try {
        return JSON.parse(readFileSync(fullPath, 'utf-8'));
    } catch (err) {
        console.error(`Failed to read ${fullPath}: ${err.message}`);
        process.exit(1);
    }
}

const cliPkg = loadPackageJson('package.json');
const mcpPkg = loadPackageJson('mermaid-to-pdf-mcp/package.json');

const cliVersion = cliPkg.version;
const mcpVersion = mcpPkg.version;

if (typeof cliVersion !== 'string' || cliVersion.length === 0) {
    console.error('CLI package.json is missing a "version" field.');
    process.exit(1);
}

if (typeof mcpVersion !== 'string' || mcpVersion.length === 0) {
    console.error('MCP server package.json is missing a "version" field.');
    process.exit(1);
}

if (cliVersion !== mcpVersion) {
    console.error(
        `Version mismatch: CLI is ${cliVersion}, MCP server is ${mcpVersion}. ` +
        'Please keep both package.json version fields in sync.'
    );
    process.exit(1);
}

console.log(`Versions match: ${cliVersion}`);
