import { ConfluenceConversionOptions, ConfluenceElementMapping } from './types/confluence.js';
export declare class MarkdownToConfluenceMapper implements ConfluenceElementMapping {
    private options;
    constructor(options: ConfluenceConversionOptions);
    heading(level: number, text: string, id?: string): string;
    paragraph(text: string): string;
    list(items: string[], ordered: boolean): string;
    listItem(text: string): string;
    table(headers: string[], rows: string[][]): string;
    codeBlock(code: string, language?: string): string;
    inlineCode(code: string): string;
    link(text: string, url: string, title?: string): string;
    image(alt: string, src: string, title?: string): string;
    blockquote(text: string): string;
    horizontalRule(): string;
    strong(text: string): string;
    emphasis(text: string): string;
    strikethrough(text: string): string;
    mermaidDiagram(diagramCode: string, attachmentId: string): string;
    private createInternalLink;
    private createAttachmentLink;
    private createExternalLink;
    private createAttachmentImage;
    private createDataUrlImage;
    private createExternalImage;
    private isInternalLink;
    private isAttachmentLink;
    private isAttachmentReference;
    private extractPageTitleFromUrl;
    private extractFilenameFromUrl;
    private escapeXml;
    createMacro(name: string, parameters?: Record<string, string>, body?: string, richTextBody?: string): string;
    createLayout(sections: {
        cells: string[];
    }[]): string;
    private createLayoutSection;
    createTableOfContents(maxHeadingLevel?: number): string;
    createStatus(title: string, color?: 'grey' | 'red' | 'yellow' | 'green' | 'blue'): string;
    createInfoPanel(title: string, content: string, type?: 'info' | 'note' | 'warning' | 'tip'): string;
}
//# sourceMappingURL=confluenceMapping.d.ts.map