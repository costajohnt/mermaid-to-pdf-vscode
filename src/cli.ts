#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve, basename } from 'path';
import { FinalMermaidToPdfConverter } from './finalConverter.js';

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
Mermaid to PDF CLI Tool

Usage:
  mermaid-to-pdf <input.md> [options]

Options:
  -o, --output <file>    Output PDF file path (default: input.pdf)
  -t, --theme <theme>    Mermaid theme (default: light)
  -q, --quality <level>  PDF quality: draft, standard, high (default: high)
  -p, --page <size>      Page size: A4, Letter, Legal (default: A4)
  -h, --help            Show this help message

Examples:
  mermaid-to-pdf document.md
  mermaid-to-pdf document.md -o output.pdf -t dark -q high
        `);
        process.exit(0);
    }

    const inputFile = args[0];
    if (!inputFile) {
        console.error('Error: Input file is required');
        process.exit(1);
    }

    // Parse options
    let outputFile = inputFile.replace(/\.md$/, '.pdf');
    let theme = 'light';
    let quality = 'high';
    let pageSize = 'A4';

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '-o':
            case '--output':
                outputFile = args[++i];
                break;
            case '-t':
            case '--theme':
                theme = args[++i];
                break;
            case '-q':
            case '--quality':
                quality = args[++i];
                break;
            case '-p':
            case '--page':
                pageSize = args[++i];
                break;
        }
    }

    try {
        console.log(`Converting ${inputFile} to PDF...`);
        
        const converter = new FinalMermaidToPdfConverter({
            engine: 'puppeteer',
            quality: quality as 'draft' | 'standard' | 'high',
            theme: theme as 'light' | 'dark',
            pageSize: pageSize as 'A4' | 'Letter' | 'Legal'
        });

        const result = await converter.convert(resolve(inputFile), (message: string, increment: number) => {
            console.log(`[${increment}%] ${message}`);
        });

        console.log(`✅ PDF created successfully: ${result}`);
        
    } catch (error) {
        console.error('❌ Conversion failed:', error);
        process.exit(1);
    }
}

main().catch(console.error);

export { main };