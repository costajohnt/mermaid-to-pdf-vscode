import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ConversionOptions, ConversionResult, FileConversionResult } from './types.js';

const execFileAsync = promisify(execFile);

interface CliJsonResult {
    outputPath: string;
    fileSize: number;
    diagramCount: number;
    processingTimeMs: number;
}

export interface Logger {
    info(obj: unknown, msg?: string): void;
    error(obj: unknown, msg?: string): void;
    warn(obj: unknown, msg?: string): void;
    debug(obj: unknown, msg?: string): void;
}

export class MermaidConverter {
    constructor(private logger: Logger) {}

    private async findCli(): Promise<string> {
        try {
            const cmd = process.platform === 'win32' ? 'where' : 'which';
            const { stdout } = await execFileAsync(cmd, ['markdown-mermaid-converter']);
            return stdout.trim().split('\n')[0];
        } catch (pathLookupErr) {
            this.logger.warn(pathLookupErr, 'CLI not found on PATH, trying local build');
            const __dirname = path.dirname(new URL(import.meta.url).pathname);
            const localCli = path.resolve(__dirname, '../../../dist/cli.js');
            try {
                await fs.access(localCli);
                return localCli;
            } catch (accessErr: any) {
                const detail = accessErr?.code === 'ENOENT'
                    ? 'file does not exist'
                    : `access check failed: ${accessErr?.message || String(accessErr)}`;
                throw new Error(
                    `CLI tool not found. Checked PATH and ${localCli} (${detail}). Install globally or build the CLI package.`
                );
            }
        }
    }

    private async runCli(cliArgs: string[]): Promise<CliJsonResult> {
        const cli = await this.findCli();
        const args = [...cliArgs, '--json'];
        const opts = { timeout: 60000, maxBuffer: 10 * 1024 * 1024 };

        let stdout: string;
        try {
            const result = cli.endsWith('.js')
                ? await execFileAsync('node', [cli, ...args], opts)
                : await execFileAsync(cli, args, opts);
            stdout = result.stdout;
        } catch (execErr: any) {
            // Try to extract structured JSON error from stdout first
            const rawStdout = execErr?.stdout?.trim() || '';
            if (rawStdout) {
                try {
                    const parsed = JSON.parse(rawStdout);
                    if (parsed.error) {
                        throw new Error(`CLI conversion failed: ${parsed.error}`);
                    }
                } catch (jsonErr) {
                    if (jsonErr instanceof Error && jsonErr.message.startsWith('CLI conversion failed:')) {
                        throw jsonErr;
                    }
                }
            }
            // Fall back to stderr or generic message
            const stderr = execErr?.stderr?.trim() || '';
            const msg = stderr || execErr?.message || String(execErr);
            throw new Error(`CLI conversion failed: ${msg}`);
        }

        try {
            const parsed = JSON.parse(stdout.trim());
            if (typeof parsed?.fileSize !== 'number' || typeof parsed?.diagramCount !== 'number') {
                throw new Error(
                    `CLI returned unexpected JSON structure. Raw stdout: ${stdout.slice(0, 200)}`
                );
            }
            return parsed as CliJsonResult;
        } catch (parseErr) {
            if (!(parseErr instanceof SyntaxError)) {
                throw parseErr;
            }
            throw new Error(
                `CLI produced invalid JSON output (${parseErr.message}). Raw stdout: ${stdout?.slice(0, 200) ?? '<null>'}`
            );
        }
    }

    async convertMarkdownToPdf(markdown: string, options: ConversionOptions = {}): Promise<ConversionResult> {
        const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-mermaid-'));

        try {
            const inputFile = path.join(tempDir, 'input.md');
            const outputFile = path.join(tempDir, 'output.pdf');
            await fs.writeFile(inputFile, markdown, 'utf-8');

            const cliArgs = [inputFile, '-o', outputFile];
            if (options.theme) { cliArgs.push('-t', options.theme); }
            if (options.pageSize) { cliArgs.push('-p', options.pageSize); }

            const result = await this.runCli(cliArgs);
            const pdfBuffer = await fs.readFile(outputFile);

            return {
                pdfBase64: pdfBuffer.toString('base64'),
                metadata: {
                    fileSize: result.fileSize,
                    diagramCount: result.diagramCount,
                    processingTime: result.processingTimeMs,
                },
            };
        } finally {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupErr) {
                this.logger.warn(
                    cleanupErr,
                    `Failed to clean up temp directory ${tempDir}`
                );
            }
        }
    }

    async convertFileToFile(inputPath: string, outputPath?: string, options: ConversionOptions = {}): Promise<FileConversionResult> {
        const resolvedOutput = outputPath || (
            /\.md$/i.test(inputPath) ? inputPath.replace(/\.md$/i, '.pdf') : inputPath + '.pdf'
        );

        const cliArgs = [inputPath, '-o', resolvedOutput];
        if (options.theme) { cliArgs.push('-t', options.theme); }
        if (options.pageSize) { cliArgs.push('-p', options.pageSize); }

        const result = await this.runCli(cliArgs);

        return {
            outputPath: result.outputPath,
            metadata: {
                fileSize: result.fileSize,
                diagramCount: result.diagramCount,
                processingTime: result.processingTimeMs,
            },
        };
    }

    async convertFileToFileFromContent(markdown: string, outputPath: string, options: ConversionOptions = {}): Promise<FileConversionResult> {
        const result = await this.convertMarkdownToPdf(markdown, options);
        await fs.writeFile(outputPath, Buffer.from(result.pdfBase64, 'base64'));
        return { outputPath, metadata: result.metadata };
    }

    async cleanup(): Promise<void> {
        // No browser to clean up — CLI handles its own lifecycle
    }
}
