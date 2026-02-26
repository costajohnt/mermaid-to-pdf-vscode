import fs from 'fs/promises';
import path from 'path';
import { ConversionOptions, ConversionResult, FileConversionResult } from './types.js';

// Import directly from the CLI package's compiled output
// This avoids spawning a subprocess per request and lets us reuse
// the browser across multiple conversions.
import { Converter, closePdfBrowser } from '../../dist/index.js';
import { closeBrowser } from '../../dist/mermaidRenderer.js';

export interface Logger {
    info(obj: unknown, msg?: string): void;
    error(obj: unknown, msg?: string): void;
    warn(obj: unknown, msg?: string): void;
    debug(obj: unknown, msg?: string): void;
}

/** Default idle timeout before closing browser singletons (ms). */
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

export class MermaidConverter {
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly idleTimeoutMs: number;

    constructor(
        private logger: Logger,
        idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS,
    ) {
        this.idleTimeoutMs = idleTimeoutMs;
    }

    /**
     * Reset the idle timer. Each conversion call resets it so the browser
     * stays alive while requests keep coming. When the timer fires, both
     * the mermaid renderer browser and the PDF browser are closed.
     */
    private resetIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        this.idleTimer = setTimeout(async () => {
            this.logger.debug('Idle timeout reached, closing browsers');
            await this.closeBrowsers();
        }, this.idleTimeoutMs);
        // Don't block the Node.js event loop from exiting
        if (this.idleTimer && typeof this.idleTimer === 'object' && 'unref' in this.idleTimer) {
            this.idleTimer.unref();
        }
    }

    private async closeBrowsers(): Promise<void> {
        try {
            await closeBrowser();
        } catch (err) {
            this.logger.warn(err, 'Failed to close mermaid renderer browser');
        }
        try {
            await closePdfBrowser();
        } catch (err) {
            this.logger.warn(err, 'Failed to close PDF browser');
        }
    }

    async convertMarkdownToPdf(markdown: string, options: ConversionOptions = {}): Promise<ConversionResult> {
        this.resetIdleTimer();
        const startTime = Date.now();

        const converter = new Converter({
            theme: options.theme,
            pageSize: options.pageSize,
            format: options.format,
        });

        const result = await converter.convertString(markdown);

        return {
            pdfBase64: result.pdfBuffer.toString('base64'),
            metadata: {
                fileSize: result.fileSize,
                diagramCount: result.diagramCount,
                processingTime: Date.now() - startTime,
            },
        };
    }

    async convertFileToFile(inputPath: string, outputPath?: string, options: ConversionOptions = {}): Promise<FileConversionResult> {
        this.resetIdleTimer();
        const startTime = Date.now();

        const resolvedOutput = outputPath || (
            /\.md$/i.test(inputPath) ? inputPath.replace(/\.md$/i, '.pdf') : inputPath + '.pdf'
        );

        const converter = new Converter({
            theme: options.theme,
            pageSize: options.pageSize,
            format: options.format,
        });

        const result = await converter.convertFile(inputPath, resolvedOutput);

        return {
            outputPath: path.resolve(resolvedOutput),
            metadata: {
                fileSize: result.fileSize,
                diagramCount: result.diagramCount,
                processingTime: Date.now() - startTime,
            },
        };
    }

    async convertFileToFileFromContent(markdown: string, outputPath: string, options: ConversionOptions = {}): Promise<FileConversionResult> {
        this.resetIdleTimer();
        const startTime = Date.now();

        const converter = new Converter({
            theme: options.theme,
            pageSize: options.pageSize,
        });

        const result = await converter.convertString(markdown);
        await fs.writeFile(outputPath, result.pdfBuffer);

        return {
            outputPath,
            metadata: {
                fileSize: result.fileSize,
                diagramCount: result.diagramCount,
                processingTime: Date.now() - startTime,
            },
        };
    }

    async cleanup(): Promise<void> {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        await this.closeBrowsers();
    }
}
