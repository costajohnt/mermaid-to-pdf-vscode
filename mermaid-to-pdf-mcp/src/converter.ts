import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ConversionOptions, ConversionResult, FileConversionResult } from './types.js';

const execFileAsync = promisify(execFile);

export class MermaidConverter {
    constructor(private logger: any) {}

    private async findCli(): Promise<string> {
        try {
            const cmd = process.platform === 'win32' ? 'where' : 'which';
            const { stdout } = await execFileAsync(cmd, ['markdown-mermaid-converter']);
            return stdout.trim().split('\n')[0]; // 'where' on Windows may return multiple lines
        } catch {
            // Try local build relative to the MCP server
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

    async convertMarkdownToPdf(markdown: string, options: ConversionOptions = {}): Promise<ConversionResult> {
        const startTime = Date.now();
        const tempDir = await fs.mkdtemp('/tmp/mcp-mermaid-');

        try {
            const inputFile = path.join(tempDir, 'input.md');
            const outputFile = path.join(tempDir, 'output.pdf');
            await fs.writeFile(inputFile, markdown, 'utf-8');

            const cli = await this.findCli();
            const cliArgs = [inputFile, '-o', outputFile];
            if (options.theme) cliArgs.push('-t', options.theme);
            if (options.pageSize) cliArgs.push('-p', options.pageSize);

            // If CLI is a path to a JS file, run it with node
            if (cli.endsWith('.js')) {
                await execFileAsync('node', [cli, ...cliArgs], { timeout: 60000 });
            } else {
                await execFileAsync(cli, cliArgs, { timeout: 60000 });
            }

            const pdfBuffer = await fs.readFile(outputFile);
            const diagramCount = (markdown.match(/```mermaid\r?\n/g) || []).length;

            return {
                pdfBase64: pdfBuffer.toString('base64'),
                metadata: {
                    fileSize: pdfBuffer.length,
                    diagramCount,
                    processingTime: Date.now() - startTime,
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
        const cli = await this.findCli();
        const cliArgs = [inputPath, '-o', resolvedOutput];
        if (options.theme) cliArgs.push('-t', options.theme);
        if (options.pageSize) cliArgs.push('-p', options.pageSize);

        const startTime = Date.now();

        // If CLI is a path to a JS file, run it with node
        if (cli.endsWith('.js')) {
            await execFileAsync('node', [cli, ...cliArgs], { timeout: 60000 });
        } else {
            await execFileAsync(cli, cliArgs, { timeout: 60000 });
        }

        let stat;
        try {
            stat = await fs.stat(resolvedOutput);
        } catch (statErr: any) {
            if (statErr?.code === 'ENOENT') {
                throw new Error(
                    `CLI conversion completed but output file was not created at ${resolvedOutput}. ` +
                    `The CLI tool may have encountered an internal error.`
                );
            }
            throw statErr;
        }
        const markdown = await fs.readFile(inputPath, 'utf-8');
        const diagramCount = (markdown.match(/```mermaid\r?\n/g) || []).length;

        return {
            outputPath: resolvedOutput,
            metadata: {
                fileSize: stat.size,
                diagramCount,
                processingTime: Date.now() - startTime,
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
