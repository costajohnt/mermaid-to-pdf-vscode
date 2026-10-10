#!/usr/bin/env node

/**
 * Copy the mermaid IIFE bundle from the installed mermaid package into
 * src/vendor/ so the build (and `npm run dev`) inject the same version that
 * package.json declares. Runs as `prebuild`; it is a development step only
 * and must never run on a consumer's install.
 */

import { copyFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const source = require.resolve('mermaid/dist/mermaid.min.js');
const target = resolve(root, 'src', 'vendor', 'mermaid.min.js');

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Vendored ${source} -> ${target}`);
