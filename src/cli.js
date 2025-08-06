#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const path_1 = require("path");
const finalConverter_js_1 = require("./finalConverter.js");
const confluenceConverter_js_1 = require("./confluenceConverter.js");
const browserPool_js_1 = require("./browserPool.js");
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
Markdown Mermaid Converter CLI Tool

Usage:
  markdown-mermaid-converter <input.md> [options]

Options:
  -f, --format <format>  Output format: pdf, confluence (default: pdf)
  -o, --output <file>    Output file path (default: auto-generated)
  -t, --theme <theme>    Mermaid theme (default: light)
  -q, --quality <level>  PDF quality: draft, standard, high (default: high)
  -p, --page <size>      Page size: A4, Letter, Legal (default: A4)
  --confluence-format <type>  Confluence output: json, xml, package (default: json)
  --space-key <key>      Confluence space key
  --title <title>        Document title (auto-detected from markdown if not provided)
  -h, --help            Show this help message

Examples:
  # PDF conversion (default)
  markdown-mermaid-converter document.md
  markdown-mermaid-converter document.md -o output.pdf -t dark -q high
  
  # Confluence conversion
  markdown-mermaid-converter document.md --format confluence
  markdown-mermaid-converter document.md -f confluence --space-key TECH --title "My Doc"
  markdown-mermaid-converter document.md -f confluence --confluence-format xml
        `);
        process.exit(0);
    }
    const inputFile = args[0];
    if (!inputFile) {
        console.error('Error: Input file is required');
        process.exit(1);
    }
    // Parse options
    let format = 'pdf';
    let outputFile = '';
    let theme = 'light';
    let quality = 'high';
    let pageSize = 'A4';
    let confluenceFormat = 'json';
    let spaceKey = '';
    let title = '';
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '-f':
            case '--format':
                format = args[++i];
                break;
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
            case '--confluence-format':
                confluenceFormat = args[++i];
                break;
            case '--space-key':
                spaceKey = args[++i];
                break;
            case '--title':
                title = args[++i];
                break;
        }
    }
    // Set default output file if not specified
    if (!outputFile) {
        if (format === 'confluence') {
            const extension = confluenceFormat === 'xml' ? 'xml' :
                confluenceFormat === 'package' ? 'zip' : 'json';
            outputFile = inputFile.replace(/\.md$/, `_confluence.${extension}`);
        }
        else {
            outputFile = inputFile.replace(/\.md$/, '.pdf');
        }
    }
    // Validate format
    if (!['pdf', 'confluence'].includes(format)) {
        console.error(`Error: Invalid format "${format}". Must be "pdf" or "confluence".`);
        process.exit(1);
    }
    // Validate confluence format
    if (format === 'confluence' && !['json', 'xml', 'package'].includes(confluenceFormat)) {
        console.error(`Error: Invalid confluence format "${confluenceFormat}". Must be "json", "xml", or "package".`);
        process.exit(1);
    }
    try {
        if (format === 'confluence') {
            console.log(`Converting ${inputFile} to Confluence format...`);
            const confluenceConverter = new confluenceConverter_js_1.ConfluenceConverter({
                spaceKey: spaceKey || undefined,
                title: title || undefined,
                outputFormat: confluenceFormat,
                includeAttachments: true,
                diagramFormat: 'attachment',
                validateOutput: true
            });
            const result = await confluenceConverter.convert((0, path_1.resolve)(inputFile), (message, increment) => {
                console.log(`[${increment}%] ${message}`);
            });
            console.log(`✅ Confluence document created successfully: ${result.outputPath}`);
            if (result.attachments.length > 0) {
                console.log(`📎 Generated ${result.attachments.length} attachment(s)`);
            }
            if (result.warnings.length > 0) {
                console.log(`⚠️  Warnings:`);
                result.warnings.forEach(warning => console.log(`   ${warning}`));
            }
        }
        else {
            console.log(`Converting ${inputFile} to PDF...`);
            const pdfConverter = new finalConverter_js_1.FinalMermaidToPdfConverter({
                engine: 'puppeteer',
                quality: quality,
                theme: theme,
                pageSize: pageSize
            });
            const result = await pdfConverter.convert((0, path_1.resolve)(inputFile), (message, increment) => {
                console.log(`[${increment}%] ${message}`);
            });
            console.log(`✅ PDF created successfully: ${result}`);
        }
        // Clean up browser pool to prevent hanging processes
        const browserPool = browserPool_js_1.BrowserPool.getInstance();
        await browserPool.destroy();
        // Explicitly exit with success to prevent hanging
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Conversion failed:', error);
        // Clean up browser pool even on error
        try {
            const browserPool = browserPool_js_1.BrowserPool.getInstance();
            await browserPool.destroy();
        }
        catch (cleanupError) {
            // Ignore cleanup errors
        }
        process.exit(1);
    }
}
main().catch(console.error);
