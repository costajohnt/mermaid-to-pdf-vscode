#!/usr/bin/env node

import { resolve } from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { Converter } from './converter.js';
import { closeBrowser } from './mermaidRenderer.js';

export async function main(argv: string[] = process.argv.slice(2)) {
    if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
        console.log(`
markdown-mermaid-converter — Convert Markdown with Mermaid diagrams to PDF

Usage:
  markdown-mermaid-converter <input.md> [options]
  cat input.md | markdown-mermaid-converter -o output.pdf

Options:
  -o, --output <file>   Output PDF file path (default: <input>.pdf)
  -t, --theme <theme>   light | dark (default: light)
  -p, --page <size>     A4 | Letter | Legal (default: A4)
  -h, --help            Show this help message

Examples:
  markdown-mermaid-converter document.md
  markdown-mermaid-converter document.md -o output.pdf -t dark
  cat README.md | markdown-mermaid-converter -o readme.pdf
`);
        process.exit(0);
    }

    // Parse arguments
    let inputFile: string | null = null;
    let outputFile: string | null = null;
    let theme: 'light' | 'dark' = 'light';
    let pageSize: 'A4' | 'Letter' | 'Legal' = 'A4';

    for (let i = 0; i < argv.length; i++) {
        switch (argv[i]) {
            case '-o':
            case '--output':
                outputFile = argv[++i];
                break;
            case '-t':
            case '--theme':
                theme = argv[++i] as 'light' | 'dark';
                break;
            case '-p':
            case '--page':
                pageSize = argv[++i] as 'A4' | 'Letter' | 'Legal';
                break;
            default:
                if (!argv[i].startsWith('-')) {
                    inputFile = argv[i];
                }
                break;
        }
    }

    try {
        const converter = new Converter({ theme, pageSize });
        let markdown: string;

        if (inputFile) {
            const resolvedInput = resolve(inputFile);
            if (!outputFile) {
                outputFile = resolvedInput.replace(/\.md$/i, '.pdf');
            }
            markdown = await fs.readFile(resolvedInput, 'utf-8');
        } else if (!process.stdin.isTTY) {
            markdown = await readStdin();
            if (!outputFile) {
                console.error('Error: --output is required when reading from stdin');
                process.exit(1);
            }
        } else {
            console.error('Error: No input file specified. Use --help for usage.');
            process.exit(1);
            return;
        }

        const resolvedOutput = resolve(outputFile!);
        console.error(`Converting to ${resolvedOutput}...`);

        const pdfBuffer = await converter.convertString(markdown);
        await fs.writeFile(resolvedOutput, pdfBuffer);

        console.error(`Done. ${(pdfBuffer.length / 1024).toFixed(1)} KB written.`);
    } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    } finally {
        await closeBrowser();
    }
}

function readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
        process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        process.stdin.on('error', reject);
    });
}

// Only auto-run when this module is the direct entry point
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
