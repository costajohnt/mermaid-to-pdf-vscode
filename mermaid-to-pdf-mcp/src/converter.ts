import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConversionOptions, ConversionResult, FileConversionResult } from './types.js';

const execAsync = promisify(exec);

export class MermaidConverter {
    constructor(private logger: any) {}

    private async findCli(): Promise<string> {
        try {
            await execAsync('which markdown-mermaid-converter');
            return 'markdown-mermaid-converter';
        } catch {
            // Try local build relative to the MCP server
            const __dirname = path.dirname(new URL(import.meta.url).pathname);
            const localCli = path.resolve(__dirname, '../../../dist/cli.js');
            try {
                await fs.access(localCli);
                return `node "${localCli}"`;
            } catch {
                throw new Error('CLI tool not found. Install globally or build the CLI package.');
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
            const args = [
                `"${inputFile}"`,
                `-o "${outputFile}"`,
                options.theme ? `-t ${options.theme}` : '',
                options.pageSize ? `-p ${options.pageSize}` : '',
            ].filter(Boolean).join(' ');

            await execAsync(`${cli} ${args}`, { timeout: 60000 });

            const pdfBuffer = await fs.readFile(outputFile);
            const diagramCount = (markdown.match(/```mermaid\n/g) || []).length;

            return {
                pdfBase64: pdfBuffer.toString('base64'),
                metadata: {
                    fileSize: pdfBuffer.length,
                    diagramCount,
                    processingTime: Date.now() - startTime,
                },
            };
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
    }

    async convertFileToFile(inputPath: string, outputPath?: string, options: ConversionOptions = {}): Promise<FileConversionResult> {
        const resolvedOutput = outputPath || inputPath.replace(/\.md$/i, '.pdf');
        const cli = await this.findCli();
        const args = [
            `"${inputPath}"`,
            `-o "${resolvedOutput}"`,
            options.theme ? `-t ${options.theme}` : '',
            options.pageSize ? `-p ${options.pageSize}` : '',
        ].filter(Boolean).join(' ');

        const startTime = Date.now();
        await execAsync(`${cli} ${args}`, { timeout: 60000 });

        const stat = await fs.stat(resolvedOutput);
        const markdown = await fs.readFile(inputPath, 'utf-8');
        const diagramCount = (markdown.match(/```mermaid\n/g) || []).length;

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
