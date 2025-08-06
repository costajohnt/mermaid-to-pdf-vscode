import { ConfluenceConversionOptions, ConversionResult } from './types/confluence.js';
export declare class ConfluenceConverter {
    private mermaidCounter;
    private attachments;
    private options;
    private mapper;
    constructor(options?: Partial<ConfluenceConversionOptions>);
    convert(markdownPath: string, progressCallback?: (message: string, increment: number) => void): Promise<ConversionResult>;
    private validateMarkdownFile;
    private validateAndSanitizeOptions;
    private extractTitleFromMarkdown;
    private getOutputPath;
    private processMermaidDiagrams;
    private markdownToConfluence;
    private writeOutput;
    private cleanupTempImages;
}
//# sourceMappingURL=confluenceConverter.d.ts.map