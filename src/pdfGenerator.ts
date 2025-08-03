import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import { marked } from 'marked';

export interface PDFOptions {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    margins?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    fontSize?: {
        body: number;
        h1: number;
        h2: number;
        h3: number;
        code: number;
    };
}

export class PDFKitGenerator {
    private doc: any;
    private currentY: number = 0;
    private options: Required<PDFOptions>;

    constructor(options: PDFOptions = {}) {
        this.options = {
            title: options.title || 'Converted Document',
            author: options.author || 'Mermaid to PDF Extension',
            subject: options.subject || 'Markdown with Mermaid Diagrams',
            keywords: options.keywords || 'markdown, mermaid, pdf',
            margins: options.margins || { top: 50, bottom: 50, left: 50, right: 50 },
            fontSize: options.fontSize || { 
                body: 11, 
                h1: 20, 
                h2: 16, 
                h3: 14, 
                code: 10 
            }
        };

        this.doc = new PDFDocument({
            info: {
                Title: this.options.title,
                Author: this.options.author,
                Subject: this.options.subject,
                Keywords: this.options.keywords
            },
            margins: this.options.margins
        });

        this.currentY = this.options.margins.top;
    }

    async generateFromMarkdown(markdown: string, imageMap: Map<string, Buffer>): Promise<Buffer> {
        // Parse markdown into tokens
        const tokens = marked.lexer(markdown);
        
        // Process each token
        for (const token of tokens) {
            await this.processToken(token, imageMap);
        }

        // Finalize the document
        this.doc.end();

        // Return the PDF as a buffer
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            this.doc.on('data', (chunk: any) => chunks.push(chunk));
            this.doc.on('end', () => resolve(Buffer.concat(chunks)));
            this.doc.on('error', reject);
        });
    }

    private async processToken(token: any, imageMap: Map<string, Buffer>): Promise<void> {
        switch (token.type) {
            case 'heading':
                this.addHeading(token.text, token.depth);
                break;
            case 'paragraph':
                await this.addParagraph(token.text, imageMap);
                break;
            case 'code':
                this.addCodeBlock(token.text, token.lang || '');
                break;
            case 'blockquote':
                this.addBlockquote(token.text);
                break;
            case 'list':
                this.addList(token);
                break;
            case 'table':
                this.addTable(token);
                break;
            case 'hr':
                this.addHorizontalRule();
                break;
            case 'space':
                this.addSpace();
                break;
        }
    }

    private addHeading(text: string, depth: number): void {
        this.checkPageBreak(30);
        
        let fontSize: number;
        switch (depth) {
            case 1: fontSize = this.options.fontSize.h1; break;
            case 2: fontSize = this.options.fontSize.h2; break;
            case 3: fontSize = this.options.fontSize.h3; break;
            default: fontSize = this.options.fontSize.body + 2; break;
        }

        this.doc
            .fontSize(fontSize)
            .font('Helvetica-Bold')
            .text(text, { align: 'left' });

        this.currentY = this.doc.y + 10;

        // Add underline for h1 and h2
        if (depth <= 2) {
            this.doc
                .moveTo(this.options.margins.left, this.currentY)
                .lineTo(this.doc.page.width - this.options.margins.right, this.currentY)
                .stroke('#cccccc');
            this.currentY += 5;
        }
    }

    private async addParagraph(text: string, imageMap: Map<string, Buffer>): Promise<void> {
        // Check for image references in the text
        const imageRegex = /!\[([^\]]*)\]\(data:image\/([^;]+);base64,([^)]+)\)/g;
        let match;
        let lastIndex = 0;
        let hasImages = false;

        while ((match = imageRegex.exec(text)) !== null) {
            hasImages = true;
            
            // Add text before the image
            const textBefore = text.substring(lastIndex, match.index);
            if (textBefore.trim()) {
                this.addTextParagraph(textBefore);
            }

            // Add the image
            const base64Data = match[3];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            await this.addImage(imageBuffer, match[1] || 'Mermaid Diagram');

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        const remainingText = text.substring(lastIndex);
        if (remainingText.trim() || !hasImages) {
            this.addTextParagraph(hasImages ? remainingText : text);
        }
    }

    private addTextParagraph(text: string): void {
        if (!text.trim()) return;

        this.checkPageBreak(20);
        
        this.doc
            .fontSize(this.options.fontSize.body)
            .font('Helvetica')
            .text(text, {
                align: 'left',
                lineGap: 2
            });

        this.currentY = this.doc.y + 10;
    }

    private async addImage(imageBuffer: Buffer, altText: string): Promise<void> {
        try {
            const maxWidth = this.doc.page.width - this.options.margins.left - this.options.margins.right - 20;
            const maxHeight = 400;

            this.checkPageBreak(maxHeight + 40);

            // Add the image with proper sizing
            const imageOptions = {
                fit: [maxWidth, maxHeight] as [number, number],
                align: 'center' as const,
                valign: 'center' as const
            };

            this.doc.image(imageBuffer, this.options.margins.left + 10, this.currentY, imageOptions);
            
            // Calculate the actual height used
            const imageHeight = Math.min(maxHeight, 300); // Estimate based on fit
            this.currentY += imageHeight + 20;

            // Add caption if alt text exists
            if (altText && altText !== 'Mermaid Diagram') {
                this.doc
                    .fontSize(9)
                    .font('Helvetica-Oblique')
                    .text(`Figure: ${altText}`, {
                        align: 'center'
                    });
                this.currentY = this.doc.y + 15;
            }

        } catch (error) {
            console.error('Error adding image:', error);
            // Add fallback text
            this.addTextParagraph(`[Image: ${altText} - Failed to load]`);
        }
    }

    private addCodeBlock(code: string, language: string): void {
        this.checkPageBreak(100);

        // Add language label if provided
        if (language) {
            this.doc
                .fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#666666')
                .text(language.toUpperCase(), { align: 'left' });
            this.currentY = this.doc.y + 5;
        }

        // Add code block with background
        const codeHeight = this.estimateTextHeight(code, this.options.fontSize.code);
        
        this.doc
            .rect(this.options.margins.left, this.currentY, 
                  this.doc.page.width - this.options.margins.left - this.options.margins.right, 
                  codeHeight + 20)
            .fill('#f6f8fa')
            .fillColor('#24292e')
            .fontSize(this.options.fontSize.code)
            .font('Courier')
            .text(code, this.options.margins.left + 10, this.currentY + 10, {
                width: this.doc.page.width - this.options.margins.left - this.options.margins.right - 20
            });

        this.currentY = this.doc.y + 15;
        this.doc.fillColor('#000000'); // Reset color
    }

    private addBlockquote(text: string): void {
        this.checkPageBreak(50);

        const quoteWidth = this.doc.page.width - this.options.margins.left - this.options.margins.right - 30;
        
        // Add left border
        this.doc
            .rect(this.options.margins.left, this.currentY, 4, 
                  this.estimateTextHeight(text, this.options.fontSize.body) + 20)
            .fill('#dfe2e5');

        // Add quoted text
        this.doc
            .fillColor('#6a737d')
            .fontSize(this.options.fontSize.body)
            .font('Helvetica-Oblique')
            .text(text, this.options.margins.left + 20, this.currentY + 10, {
                width: quoteWidth
            });

        this.currentY = this.doc.y + 15;
        this.doc.fillColor('#000000'); // Reset color
    }

    private addList(listToken: any): void {
        listToken.items.forEach((item: any, index: number) => {
            this.checkPageBreak(30);
            
            const bullet = listToken.ordered ? `${index + 1}.` : '•';
            const itemText = this.extractTextFromToken(item);
            
            this.doc
                .fontSize(this.options.fontSize.body)
                .font('Helvetica')
                .text(bullet, this.options.margins.left, this.currentY, { width: 20 })
                .text(itemText, this.options.margins.left + 25, this.currentY, {
                    width: this.doc.page.width - this.options.margins.left - this.options.margins.right - 25
                });

            this.currentY = this.doc.y + 5;
        });
        
        this.currentY += 10;
    }

    private addTable(tableToken: any): void {
        // Simplified table implementation
        const colWidth = (this.doc.page.width - this.options.margins.left - this.options.margins.right) / tableToken.header.length;
        
        this.checkPageBreak(100);
        
        // Header
        let startY = this.currentY;
        tableToken.header.forEach((header: any, index: number) => {
            this.doc
                .rect(this.options.margins.left + index * colWidth, startY, colWidth, 25)
                .stroke('#dfe2e5')
                .fontSize(this.options.fontSize.body)
                .font('Helvetica-Bold')
                .text(header.text, this.options.margins.left + index * colWidth + 5, startY + 8, {
                    width: colWidth - 10,
                    height: 25
                });
        });
        
        this.currentY += 30;
        
        // Rows
        tableToken.rows.forEach((row: any) => {
            startY = this.currentY;
            row.forEach((cell: any, index: number) => {
                this.doc
                    .rect(this.options.margins.left + index * colWidth, startY, colWidth, 25)
                    .stroke('#dfe2e5')
                    .fontSize(this.options.fontSize.body)
                    .font('Helvetica')
                    .text(cell.text, this.options.margins.left + index * colWidth + 5, startY + 8, {
                        width: colWidth - 10,
                        height: 25
                    });
            });
            this.currentY += 30;
        });
    }

    private addHorizontalRule(): void {
        this.checkPageBreak(20);
        
        this.doc
            .moveTo(this.options.margins.left, this.currentY + 10)
            .lineTo(this.doc.page.width - this.options.margins.right, this.currentY + 10)
            .stroke('#cccccc');
            
        this.currentY += 25;
    }

    private addSpace(): void {
        this.currentY += 10;
    }

    private checkPageBreak(requiredSpace: number): void {
        if (this.currentY + requiredSpace > this.doc.page.height - this.options.margins.bottom) {
            this.doc.addPage();
            this.currentY = this.options.margins.top;
        }
    }

    private estimateTextHeight(text: string, fontSize: number): number {
        const linesCount = Math.ceil(text.length / 80); // Rough estimate
        return linesCount * fontSize * 1.2;
    }

    private extractTextFromToken(token: any): string {
        if ('text' in token) {
            return token.text;
        }
        if ('tokens' in token && Array.isArray(token.tokens)) {
            return token.tokens.map((t: any) => this.extractTextFromToken(t)).join('');
        }
        return '';
    }

    async saveToFile(filePath: string): Promise<void> {
        const pdfBuffer = await this.generateFromMarkdown('', new Map());
        fs.writeFileSync(filePath, pdfBuffer);
    }
}