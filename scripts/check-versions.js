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

const cliPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const mcpPkg = JSON.parse(readFileSync(resolve(root, 'mermaid-to-pdf-mcp/package.json'), 'utf-8'));

const cliVersion = cliPkg.version;
const mcpVersion = mcpPkg.version;

if (cliVersion !== mcpVersion) {
    console.error(
        `Version mismatch: CLI is ${cliVersion}, MCP server is ${mcpVersion}. ` +
        'Please keep both package.json version fields in sync.'
    );
    process.exit(1);
}

console.log(`Versions match: ${cliVersion}`);
