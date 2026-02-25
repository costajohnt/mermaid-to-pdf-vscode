#!/usr/bin/env node

import { resolve } from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { Converter, closePdfBrowser } from './converter.js';
import { closeBrowser } from './mermaidRenderer.js';
import type { CliJsonOutput } from './types.js';

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
  --json                Output results as JSON to stdout
  -h, --help            Show this help message

Examples:
  markdown-mermaid-converter document.md
  markdown-mermaid-converter document.md -o output.pdf -t dark
  markdown-mermaid-converter document.md --json
  cat README.md | markdown-mermaid-converter -o readme.pdf
`);
        process.exit(0);
    }

    // Parse arguments
    let inputFile: string | null = null;
    let outputFile: string | null = null;
    let theme: 'light' | 'dark' = 'light';
    let pageSize: 'A4' | 'Letter' | 'Legal' = 'A4';
    let jsonOutput = false;

    for (let i = 0; i < argv.length; i++) {
        switch (argv[i]) {
            case '-o':
            case '--output':
                if (i + 1 >= argv.length || argv[i + 1].startsWith('-')) {
                    console.error('Error: --output requires a file path argument.');
                    process.exit(1);
                }
                outputFile = argv[++i];
                break;
            case '-t':
            case '--theme': {
                if (i + 1 >= argv.length || argv[i + 1].startsWith('-')) {
                    console.error('Error: --theme requires a value (light or dark).');
                    process.exit(1);
                }
                const t = argv[++i];
                if (t !== 'light' && t !== 'dark') {
                    console.error(`Error: Invalid theme "${t}". Must be "light" or "dark".`);
                    process.exit(1);
                }
                theme = t;
                break;
            }
            case '-p':
            case '--page': {
                if (i + 1 >= argv.length || argv[i + 1].startsWith('-')) {
                    console.error('Error: --page requires a value (A4, Letter, or Legal).');
                    process.exit(1);
                }
                const p = argv[++i];
                if (p !== 'A4' && p !== 'Letter' && p !== 'Legal') {
                    console.error(`Error: Invalid page size "${p}". Must be "A4", "Letter", or "Legal".`);
                    process.exit(1);
                }
                pageSize = p;
                break;
            }
            case '--json':
                jsonOutput = true;
                break;
            default:
                if (argv[i].startsWith('-')) {
                    console.error(`Error: Unknown option "${argv[i]}". Use --help for usage.`);
                    process.exit(1);
                }
                inputFile = argv[i];
                break;
        }
    }

    try {
        const startTime = Date.now();
        const converter = new Converter({ theme, pageSize });
        let markdown: string;

        if (inputFile) {
            const resolvedInput = resolve(inputFile);
            if (!outputFile) {
                outputFile = /\.md$/i.test(resolvedInput)
                    ? resolvedInput.replace(/\.md$/i, '.pdf')
                    : resolvedInput + '.pdf';
            }
            markdown = await fs.readFile(resolvedInput, 'utf-8');
        } else if (!process.stdin.isTTY) {
            console.error('Reading from stdin...');
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
        if (!jsonOutput) {
            console.error(`Converting to ${resolvedOutput}...`);
        }

        const result = await converter.convertString(markdown);
        await fs.writeFile(resolvedOutput, result.pdfBuffer);

        if (jsonOutput) {
            const output: CliJsonOutput = {
                outputPath: resolvedOutput,
                fileSize: result.fileSize,
                diagramCount: result.diagramCount,
                processingTimeMs: Date.now() - startTime,
            };
            console.log(JSON.stringify(output));
        } else {
            console.error(`Done. ${(result.fileSize / 1024).toFixed(1)} KB written.`);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (jsonOutput) {
            console.log(JSON.stringify({ error: message }));
        } else {
            console.error(`Error: ${message}`);
        }
        process.exit(1);
    } finally {
        await closeBrowser();
        await closePdfBrowser();
    }
}

function readStdin(timeoutMs: number = 30_000): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        const onData = (chunk: Buffer) => chunks.push(chunk);
        const onEnd = () => {
            clearTimeout(timer);
            cleanup();
            resolve(Buffer.concat(chunks).toString('utf-8'));
        };
        const onError = (err: Error) => {
            clearTimeout(timer);
            cleanup();
            reject(err);
        };

        function cleanup() {
            process.stdin.removeListener('data', onData);
            process.stdin.removeListener('end', onEnd);
            process.stdin.removeListener('error', onError);
        }

        const timer = setTimeout(() => {
            cleanup();
            process.stdin.destroy();
            reject(new Error(
                `Timed out after ${timeoutMs / 1000}s waiting for stdin. ` +
                `Ensure input is piped (e.g., cat file.md | markdown-mermaid-converter -o out.pdf).`
            ));
        }, timeoutMs);

        process.stdin.on('data', onData);
        process.stdin.on('end', onEnd);
        process.stdin.on('error', onError);
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
