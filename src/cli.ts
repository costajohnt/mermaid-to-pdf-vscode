#!/usr/bin/env node

import { resolve, join, basename } from 'path';
import { promises as fs } from 'fs';
import { watch as fsWatch } from 'fs';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { Converter, closePdfBrowser } from './converter.js';
import { closeBrowser } from './mermaidRenderer.js';
import { loadConfigFile, mergeConfig } from './config.js';
import type { CliJsonOutput, ConversionOptions } from './types.js';

export async function main(argv: string[] = process.argv.slice(2)) {
    if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
        console.log(`
markdown-mermaid-converter — Convert Markdown with Mermaid diagrams to PDF/HTML/DOCX

Usage:
  markdown-mermaid-converter <input.md> [options]
  markdown-mermaid-converter "docs/**/*.md" --outdir out/
  markdown-mermaid-converter file1.md file2.md file3.md --outdir out/
  cat input.md | markdown-mermaid-converter -o output.pdf

Options:
  -o, --output <file>     Output file path (single-file mode only)
  --outdir <dir>          Output directory for batch mode
  -f, --format <format>   pdf | html | docx (default: pdf)
  -t, --theme <theme>     light | dark (default: light)
  -p, --page <size>       A4 | Letter | Legal (default: A4)
  -w, --watch             Watch input file for changes and re-convert automatically
  --page-numbers          Add "Page X of Y" footer to PDF output
  --header <html>         Custom header HTML template for PDF output
  --footer <html>         Custom footer HTML template for PDF output
  --css <css|file.css>    Inject custom CSS (inline string or .css file path)
  --font <family>         Set body text font-family (falls back gracefully)
  --code-font <family>    Set code/pre font-family (falls back gracefully)
  --lang <code>           Set document language (BCP 47 code, default: en)
  --math                  Enable KaTeX math equation rendering
  --json                  Output results as JSON to stdout
  -h, --help              Show this help message

Header/Footer Template Variables:
  <span class="pageNumber"></span>    Current page number
  <span class="totalPages"></span>    Total page count
  <span class="date"></span>          Current date
  <span class="title"></span>         Document title

Config file:
  Place a .mermaidrc.json in the current directory or home directory.
  CLI flags override config file values, which override built-in defaults.

Examples:
  markdown-mermaid-converter document.md
  markdown-mermaid-converter document.md -o output.pdf -t dark
  markdown-mermaid-converter document.md -f html -o output.html
  markdown-mermaid-converter document.md -f docx -o output.docx
  markdown-mermaid-converter document.md --page-numbers
  markdown-mermaid-converter document.md --watch
  markdown-mermaid-converter document.md --json
  markdown-mermaid-converter document.md --math
  markdown-mermaid-converter "docs/**/*.md" --outdir pdfs/
  markdown-mermaid-converter a.md b.md c.md --outdir out/
  cat README.md | markdown-mermaid-converter -o readme.pdf
`);
        process.exit(0);
    }

    // Parse arguments
    const inputPatterns: string[] = [];
    let outputFile: string | null = null;
    let outdir: string | null = null;
    let cliFormat: 'pdf' | 'html' | 'docx' | undefined;
    let cliTheme: 'light' | 'dark' | undefined;
    let cliPageSize: 'A4' | 'Letter' | 'Legal' | undefined;
    let pageNumbers = false;
    let headerTemplate: string | undefined;
    let footerTemplate: string | undefined;
    let customCss: string | undefined;
    let font: string | undefined;
    let codeFont: string | undefined;
    let lang: string | undefined;
    let jsonOutput = false;
    let math = false;
    let watch = false;

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
            case '--outdir':
                if (i + 1 >= argv.length || argv[i + 1].startsWith('-')) {
                    console.error('Error: --outdir requires a directory path argument.');
                    process.exit(1);
                }
                outdir = argv[++i];
                break;
            case '-f':
            case '--format': {
                if (i + 1 >= argv.length || argv[i + 1].startsWith('-')) {
                    console.error('Error: --format requires a value (pdf, html, or docx).');
                    process.exit(1);
                }
                const f = argv[++i];
                if (f !== 'pdf' && f !== 'html' && f !== 'docx') {
                    console.error(`Error: Invalid format "${f}". Must be "pdf", "html", or "docx".`);
                    process.exit(1);
                }
                cliFormat = f;
                break;
            }
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
                cliTheme = t;
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
                cliPageSize = p;
                break;
            }
            case '--page-numbers':
                pageNumbers = true;
                break;
            case '--header': {
                if (i + 1 >= argv.length) {
                    console.error('Error: --header requires an HTML template string argument.');
                    process.exit(1);
                }
                headerTemplate = argv[++i];
                break;
            }
            case '--footer': {
                if (i + 1 >= argv.length) {
                    console.error('Error: --footer requires an HTML template string argument.');
                    process.exit(1);
                }
                footerTemplate = argv[++i];
                break;
            }
            case '--css': {
                if (i + 1 >= argv.length) {
                    console.error('Error: --css requires a CSS string or .css file path argument.');
                    process.exit(1);
                }
                customCss = argv[++i];
                break;
            }
            case '--font': {
                if (i + 1 >= argv.length) {
                    console.error('Error: --font requires a font-family name argument.');
                    process.exit(1);
                }
                font = argv[++i];
                break;
            }
            case '--code-font': {
                if (i + 1 >= argv.length) {
                    console.error('Error: --code-font requires a font-family name argument.');
                    process.exit(1);
                }
                codeFont = argv[++i];
                break;
            }
            case '--lang': {
                if (i + 1 >= argv.length || argv[i + 1].startsWith('-')) {
                    console.error('Error: --lang requires a BCP 47 language code argument (e.g. "en", "fr").');
                    process.exit(1);
                }
                const langVal = argv[++i];
                if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$/.test(langVal)) {
                    console.error(`Error: Invalid language code "${langVal}". Must be a valid BCP 47 code (e.g. "en", "fr-FR", "zh-Hans").`);
                    process.exit(1);
                }
                lang = langVal;
                break;
            }
            case '--math':
                math = true;
                break;
            case '--json':
                jsonOutput = true;
                break;
            case '-w':
            case '--watch':
                watch = true;
                break;
            default:
                if (argv[i].startsWith('-')) {
                    console.error(`Error: Unknown option "${argv[i]}". Use --help for usage.`);
                    process.exit(1);
                }
                inputPatterns.push(argv[i]);
                break;
        }
    }

    try {
        // Load config file (.mermaidrc.json) and merge with CLI flags
        const fileConfig = loadConfigFile();
        const cliFlags: Partial<ConversionOptions> = {};
        if (cliFormat !== undefined) { cliFlags.format = cliFormat; }
        if (cliTheme !== undefined) { cliFlags.theme = cliTheme; }
        if (cliPageSize !== undefined) { cliFlags.pageSize = cliPageSize; }
        if (pageNumbers) { cliFlags.pageNumbers = pageNumbers; }
        if (headerTemplate) { cliFlags.headerTemplate = headerTemplate; }
        if (footerTemplate) { cliFlags.footerTemplate = footerTemplate; }
        if (customCss) { cliFlags.customCss = customCss; }
        if (font) { cliFlags.font = font; }
        if (codeFont) { cliFlags.codeFont = codeFont; }
        if (lang) { cliFlags.lang = lang; }
        if (math) { cliFlags.math = math; }
        const mergedOptions = mergeConfig(fileConfig, cliFlags);

        const fmt = mergedOptions.format ?? 'pdf';
        const ext = fmt === 'html' ? '.html' : fmt === 'docx' ? '.docx' : '.pdf';

        // Expand glob patterns to resolve input files
        const inputFiles = await expandInputPatterns(inputPatterns);
        const isBatchMode = inputFiles.length > 1;

        // Validate flag combinations
        if (isBatchMode && outputFile) {
            console.error('Error: -o/--output cannot be used with multiple input files. Use --outdir instead.');
            process.exit(1);
        }

        if (isBatchMode && watch) {
            console.error('Error: --watch cannot be used with multiple input files.');
            process.exit(1);
        }

        if (inputFiles.length === 0 && !process.stdin.isTTY && inputPatterns.length === 0) {
            // stdin mode — backward compatible
            if (watch) {
                console.error('Error: --watch requires an input file (cannot watch stdin).');
                process.exit(1);
            }
            await runSingleStdin(mergedOptions, ext, outputFile, jsonOutput);
        } else if (inputFiles.length === 0) {
            console.error('Error: No input files matched. Use --help for usage.');
            process.exit(1);
        } else if (isBatchMode) {
            await runBatch(inputFiles, mergedOptions, ext, outdir, jsonOutput);
        } else {
            // Single file mode — backward compatible
            await runSingle(inputFiles[0], mergedOptions, ext, outputFile, jsonOutput, watch);
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
        // In watch mode, cleanup is handled by the SIGINT handler.
        if (!watch) {
            await closeBrowser();
            await closePdfBrowser();
        }
    }
}

/**
 * Expand input patterns (glob patterns and literal file paths) into a
 * deduplicated list of resolved file paths.
 * @throws {Error} If a literal path does not exist or a glob pattern fails.
 */
async function expandInputPatterns(patterns: string[]): Promise<string[]> {
    if (patterns.length === 0) { return []; }

    const seen = new Set<string>();
    const result: string[] = [];

    for (const pattern of patterns) {
        if (/[*?{[]/.test(pattern)) {
            let matches: string[];
            try {
                matches = await glob(pattern, { nodir: true });
            } catch (err) {
                throw new Error(
                    `Failed to expand glob pattern "${pattern}": ${err instanceof Error ? err.message : String(err)}`
                );
            }
            if (matches.length === 0) {
                console.error(`Warning: Glob pattern "${pattern}" matched zero files.`);
            }
            for (const match of matches.sort()) {
                const resolved = resolve(match);
                if (!seen.has(resolved)) {
                    seen.add(resolved);
                    result.push(resolved);
                }
            }
        } else {
            const resolved = resolve(pattern);
            try {
                await fs.access(resolved);
            } catch {
                throw new Error(`Input file "${pattern}" does not exist.`);
            }
            if (!seen.has(resolved)) {
                seen.add(resolved);
                result.push(resolved);
            }
        }
    }

    return result;
}

/** Single-file mode (backward compatible, with optional watch). */
async function runSingle(
    inputFile: string,
    mergedOptions: Partial<ConversionOptions>,
    ext: string,
    outputFile: string | null,
    jsonOutput: boolean,
    watch: boolean,
): Promise<void> {
    const startTime = Date.now();
    const resolvedInput = resolve(inputFile);

    if (!outputFile) {
        outputFile = /\.md$/i.test(resolvedInput)
            ? resolvedInput.replace(/\.md$/i, ext)
            : resolvedInput + ext;
    }

    const resolvedOutput = resolve(outputFile);
    const converter = new Converter(mergedOptions);

    if (!jsonOutput) {
        console.error(`Converting to ${resolvedOutput}...`);
    }

    const markdown = await fs.readFile(resolvedInput, 'utf-8');
    const result = await converter.convertString(markdown);
    await fs.writeFile(resolvedOutput, result.outputBuffer);

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

    // Watch mode: keep browser alive and re-convert on file changes
    if (watch) {
        console.error('Watching for changes... (Ctrl+C to stop)');
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let consecutiveFailures = 0;
        const MAX_CONSECUTIVE_FAILURES = 5;

        const watcher = fsWatch(resolvedInput, () => {
            if (debounceTimer) { clearTimeout(debounceTimer); }
            debounceTimer = setTimeout(async () => {
                const rebuildStart = Date.now();
                try {
                    const md = await fs.readFile(resolvedInput, 'utf-8');
                    const rebuildResult = await converter.convertString(md);
                    await fs.writeFile(resolvedOutput, rebuildResult.outputBuffer);
                    consecutiveFailures = 0;
                    const time = new Date().toLocaleTimeString();
                    const size = (rebuildResult.fileSize / 1024).toFixed(1);
                    console.error(`[${time}] Rebuilt in ${Date.now() - rebuildStart}ms — ${outputFile} (${size} KB)`);
                } catch (err) {
                    consecutiveFailures++;
                    console.error(`[${new Date().toLocaleTimeString()}] Error: ${err instanceof Error ? err.message : String(err)}`);
                    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                        console.error(`\nFatal: ${MAX_CONSECUTIVE_FAILURES} consecutive rebuild failures. Exiting watch mode.`);
                        try { watcher.close(); } catch { /* already closed */ }
                        try { await closeBrowser(); } catch { /* ignore cleanup errors */ }
                        try { await closePdfBrowser(); } catch { /* ignore cleanup errors */ }
                        process.exit(1);
                    }
                }
            }, 300);
        });

        watcher.on('error', (err) => {
            console.error(`Error: File watcher failed for "${resolvedInput}": ${err.message}`);
            console.error('Stopping watch mode.');
            try { watcher.close(); } catch { /* already closed */ }
            closeBrowser()
                .then(() => closePdfBrowser())
                .catch((cleanupErr) => {
                    console.error(`Warning: Browser cleanup failed: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`);
                })
                .finally(() => process.exit(1));
        });

        // Graceful shutdown on Ctrl+C
        process.on('SIGINT', async () => {
            try { watcher.close(); } catch { /* already closed */ }
            try { await closeBrowser(); } catch { /* ignore cleanup errors */ }
            try { await closePdfBrowser(); } catch { /* ignore cleanup errors */ }
            process.exit(0);
        });

        // Keep process alive (never resolves)
        await new Promise(() => {});
    }
}

/** Stdin mode (backward compatible). */
async function runSingleStdin(
    mergedOptions: Partial<ConversionOptions>,
    ext: string,
    outputFile: string | null,
    jsonOutput: boolean,
): Promise<void> {
    const startTime = Date.now();

    console.error('Reading from stdin...');
    const markdown = await readStdin();

    if (!outputFile) {
        console.error('Error: --output is required when reading from stdin');
        process.exit(1);
    }

    const resolvedOutput = resolve(outputFile);

    if (!jsonOutput) {
        console.error(`Converting to ${resolvedOutput}...`);
    }

    const converter = new Converter(mergedOptions);
    const result = await converter.convertString(markdown);
    await fs.writeFile(resolvedOutput, result.outputBuffer);

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
}

/** Batch mode: process multiple files, reusing one Converter instance. */
async function runBatch(
    inputFiles: string[],
    mergedOptions: Partial<ConversionOptions>,
    ext: string,
    outdir: string | null,
    jsonOutput: boolean,
): Promise<void> {
    if (outdir) {
        try {
            await fs.mkdir(resolve(outdir), { recursive: true });
        } catch (err) {
            throw new Error(
                `Failed to create output directory "${outdir}": ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    // Detect output path collisions (e.g. docs/README.md and guides/README.md both → out/README.pdf)
    if (outdir) {
        const outputPaths = new Map<string, string>();
        for (const file of inputFiles) {
            const out = resolve(join(outdir, /\.md$/i.test(basename(file)) ? basename(file).replace(/\.md$/i, ext) : basename(file) + ext));
            const existing = outputPaths.get(out);
            if (existing) {
                throw new Error(
                    `Output path collision: "${existing}" and "${file}" both produce "${out}". ` +
                    `Rename one of the input files or use separate output directories.`
                );
            }
            outputPaths.set(out, file);
        }
    }

    const converter = new Converter(mergedOptions);
    let succeeded = 0;
    let failed = 0;

    interface BatchJsonEntry {
        inputPath: string;
        outputPath?: string;
        fileSize?: number;
        diagramCount?: number;
        processingTimeMs?: number;
        error?: string;
    }
    const jsonResults: BatchJsonEntry[] = [];

    for (let i = 0; i < inputFiles.length; i++) {
        const file = inputFiles[i];
        const outputPath = outdir
            ? resolve(join(outdir, /\.md$/i.test(basename(file)) ? basename(file).replace(/\.md$/i, ext) : basename(file) + ext))
            : /\.md$/i.test(file) ? file.replace(/\.md$/i, ext) : file + ext;

        if (!jsonOutput) {
            console.error(`[${i + 1}/${inputFiles.length}] ${file}`);
        }

        const fileStart = Date.now();

        try {
            const markdown = await fs.readFile(file, 'utf-8');
            const result = await converter.convertString(markdown);
            await fs.writeFile(outputPath, result.outputBuffer);

            if (!jsonOutput) {
                console.error(`  → ${outputPath} (${(result.fileSize / 1024).toFixed(1)} KB)`);
            }

            if (jsonOutput) {
                jsonResults.push({
                    inputPath: file,
                    outputPath,
                    fileSize: result.fileSize,
                    diagramCount: result.diagramCount,
                    processingTimeMs: Date.now() - fileStart,
                });
            }

            succeeded++;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const errCode = (err as NodeJS.ErrnoException).code;

            // Detect systemic errors that will doom all remaining files
            const isFatal = err instanceof Error && (
                /ENOSPC|ENOMEM/.test(errCode ?? '') ||
                /Target closed|browser.*disconnected|Protocol error/i.test(err.message)
            );

            if (isFatal) {
                console.error(`\nFatal error during batch processing: ${errMsg}`);
                console.error(`Aborting. ${succeeded} file(s) succeeded before failure.`);
                if (jsonOutput) {
                    jsonResults.push({ inputPath: file, error: errMsg });
                    console.log(JSON.stringify(jsonResults));
                }
                process.exit(1);
            }

            if (!jsonOutput) {
                console.error(`  ✗ Error: ${errMsg}`);
            }

            if (jsonOutput) {
                jsonResults.push({
                    inputPath: file,
                    error: errMsg,
                });
            }

            failed++;
        }
    }

    if (jsonOutput) {
        console.log(JSON.stringify(jsonResults));
    } else {
        console.error(`\nBatch complete: ${succeeded} succeeded, ${failed} failed out of ${inputFiles.length} files.`);
    }

    if (failed > 0) { process.exit(1); }
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
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFilePath) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
