"use strict";
/**
 * Markdown Parser with Mermaid diagram extraction
 *
 * Parses markdown content and extracts diagrams for rendering
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownParser = void 0;
const marked_1 = require("marked");
const crypto_1 = __importDefault(require("crypto"));
class MarkdownParser {
    diagramCounter = 0;
    /**
     * Parse markdown content into structured format
     */
    async parse(content, metadata) {
        // Reset counter for each parse
        this.diagramCounter = 0;
        // Parse with marked
        const tokens = marked_1.marked.lexer(content);
        // Extract document metadata
        const documentMetadata = this.extractMetadata(tokens, content, metadata);
        // Process tokens into sections
        const sections = this.processTokens(tokens);
        // Extract diagrams
        const diagrams = this.extractDiagrams(content);
        return {
            title: documentMetadata.title || 'Untitled Document',
            sections,
            diagrams,
            metadata: documentMetadata
        };
    }
    /**
     * Extract document metadata from tokens and frontmatter
     */
    extractMetadata(tokens, content, inputMetadata) {
        const metadata = {
            ...inputMetadata,
            wordCount: this.countWords(content),
            readingTime: Math.ceil(this.countWords(content) / 200) // Average reading speed
        };
        // Extract title from first heading
        const firstHeading = tokens.find(token => token.type === 'heading' && token.depth === 1);
        if (firstHeading && !metadata.title) {
            metadata.title = firstHeading.text;
        }
        // Extract frontmatter if present
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        if (frontmatterMatch && frontmatterMatch[1]) {
            const frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
            Object.assign(metadata, frontmatter);
        }
        return metadata;
    }
    /**
     * Process marked tokens into content sections
     */
    processTokens(tokens) {
        const sections = [];
        for (const token of tokens) {
            const section = this.tokenToSection(token);
            if (section) {
                sections.push(section);
            }
        }
        return sections;
    }
    /**
     * Convert a marked token to a content section
     */
    tokenToSection(token) {
        switch (token.type) {
            case 'heading':
                const heading = token;
                return {
                    type: 'heading',
                    level: heading.depth,
                    content: heading.text,
                    markdown: `${'#'.repeat(heading.depth)} ${heading.text}`
                };
            case 'paragraph':
                const paragraph = token;
                return {
                    type: 'paragraph',
                    content: paragraph.text,
                    markdown: paragraph.raw
                };
            case 'list':
                const list = token;
                return {
                    type: 'list',
                    content: this.processListItems(list.items),
                    markdown: list.raw,
                    children: list.items.map(item => ({
                        type: 'paragraph',
                        content: item.text,
                        markdown: item.raw
                    }))
                };
            case 'code':
                const code = token;
                // Skip mermaid diagrams as they're handled separately
                if (code.lang === 'mermaid') {
                    return {
                        type: 'diagram',
                        content: code.text,
                        markdown: code.raw
                    };
                }
                return {
                    type: 'code',
                    content: code.text,
                    markdown: code.raw
                };
            case 'table':
                const table = token;
                return {
                    type: 'table',
                    content: this.processTable(table),
                    markdown: table.raw
                };
            case 'blockquote':
                const blockquote = token;
                return {
                    type: 'blockquote',
                    content: blockquote.text,
                    markdown: blockquote.raw
                };
            default:
                return null;
        }
    }
    /**
     * Extract mermaid diagrams from content
     */
    extractDiagrams(content) {
        const diagrams = [];
        const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
        let match;
        let position = 0;
        while ((match = mermaidRegex.exec(content)) !== null) {
            const code = match[1]?.trim();
            if (code) {
                const id = `diagram_${++this.diagramCounter}`;
                const hash = this.generateHash(code);
                const diagramInfo = {
                    id,
                    type: 'mermaid',
                    code,
                    hash,
                    position: position++
                };
                const title = this.extractDiagramTitle(code);
                if (title) {
                    diagramInfo.title = title;
                }
                diagrams.push(diagramInfo);
            }
        }
        // TODO: Add support for other diagram types (PlantUML, Graphviz, etc.)
        return diagrams;
    }
    /**
     * Generate content hash for caching
     */
    generateHash(content) {
        return crypto_1.default.createHash('sha256').update(content.trim()).digest('hex').substring(0, 16);
    }
    /**
     * Extract diagram title from code (if present)
     */
    extractDiagramTitle(code) {
        // Look for title in mermaid syntax
        const titleMatch = code.match(/%%\s*title:\s*(.+)/);
        if (titleMatch?.[1]) {
            return titleMatch[1].trim();
        }
        // Look for title in comments
        const commentMatch = code.match(/%%\s*(.+)/);
        if (commentMatch?.[1]) {
            return commentMatch[1].trim();
        }
        return undefined;
    }
    /**
     * Process list items into text
     */
    processListItems(items) {
        return items.map(item => `• ${item.text}`).join('\n');
    }
    /**
     * Process table into readable format
     */
    processTable(table) {
        const header = table.header.map(cell => cell.text).join(' | ');
        const separator = table.header.map(() => '---').join(' | ');
        const rows = table.rows.map(row => row.map(cell => cell.text).join(' | ')).join('\n');
        return `${header}\n${separator}\n${rows}`;
    }
    /**
     * Parse YAML frontmatter
     */
    parseFrontmatter(frontmatter) {
        const metadata = {};
        const lines = frontmatter.split('\n');
        for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                if (key && value) {
                    switch (key.toLowerCase()) {
                        case 'title':
                            metadata.title = value.replace(/^["']|["']$/g, '');
                            break;
                        case 'author':
                            metadata.author = value.replace(/^["']|["']$/g, '');
                            break;
                        case 'tags':
                            metadata.tags = value.split(',').map(tag => tag.trim().replace(/^["']|["']$/g, ''));
                            break;
                        case 'date':
                            metadata.createdAt = new Date(value);
                            break;
                    }
                }
            }
        }
        return metadata;
    }
    /**
     * Count words in content
     */
    countWords(content) {
        // Remove markdown syntax and count words
        const plainText = content
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/`[^`]+`/g, '') // Remove inline code
            .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
            .replace(/\[.*?\]\(.*?\)/g, '') // Remove links
            .replace(/[#*_~`]/g, '') // Remove markdown syntax
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        return plainText ? plainText.split(' ').length : 0;
    }
}
exports.MarkdownParser = MarkdownParser;
//# sourceMappingURL=parser.js.map