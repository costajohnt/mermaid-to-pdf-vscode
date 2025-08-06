"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfluenceConverter = void 0;
const fs_1 = require("fs");
const path = require("path");
const marked_1 = require("marked");
const diagramCache_js_1 = require("./diagramCache.js");
const confluenceMapping_js_1 = require("./confluenceMapping.js");
class ConfluenceConverter {
    constructor(options = {}) {
        this.mermaidCounter = 0;
        this.attachments = new Map();
        const validatedOptions = this.validateAndSanitizeOptions(options);
        this.options = {
            spaceKey: validatedOptions.spaceKey,
            title: validatedOptions.title,
            outputFormat: validatedOptions.outputFormat || 'json',
            includeAttachments: validatedOptions.includeAttachments ?? true,
            diagramFormat: validatedOptions.diagramFormat || 'attachment',
            validateOutput: validatedOptions.validateOutput ?? true,
            templatePath: validatedOptions.templatePath
        };
        this.mapper = new confluenceMapping_js_1.MarkdownToConfluenceMapper(this.options);
    }
    async convert(markdownPath, progressCallback) {
        // Validate input file before processing
        await this.validateMarkdownFile(markdownPath);
        progressCallback?.('🔍 Reading Markdown file...', 5);
        const markdownContent = await fs_1.promises.readFile(markdownPath, 'utf-8');
        const outputDir = path.dirname(markdownPath);
        const basename = path.basename(markdownPath, '.md');
        // Determine output path based on format
        const outputPath = this.getOutputPath(markdownPath, this.options.outputFormat);
        // Determine document title
        const documentTitle = this.options.title || this.extractTitleFromMarkdown(markdownContent) || basename;
        progressCallback?.('🎨 Processing Mermaid diagrams...', 15);
        const processedContent = await this.processMermaidDiagrams(markdownContent, outputDir, progressCallback);
        progressCallback?.('📝 Converting Markdown to Confluence format...', 50);
        const confluenceXml = await this.markdownToConfluence(processedContent);
        progressCallback?.('📄 Building Confluence document...', 70);
        const document = {
            type: 'page',
            title: documentTitle,
            ...(this.options.spaceKey && { space: { key: this.options.spaceKey } }),
            body: {
                storage: {
                    value: confluenceXml,
                    representation: 'storage'
                }
            },
            ...(this.attachments.size > 0 && {
                attachments: Array.from(this.attachments.values())
            })
        };
        progressCallback?.('💾 Writing output file...', 85);
        await this.writeOutput(document, outputPath);
        progressCallback?.('🧹 Cleaning up...', 95);
        await this.cleanupTempImages(outputDir);
        progressCallback?.('✅ Complete!', 100);
        // Log cache statistics
        const cache = diagramCache_js_1.DiagramCache.getInstance();
        const stats = cache.getStats();
        console.log(`📊 Cache Stats: ${stats.totalEntries} entries, ${stats.hitRate}% hit rate`);
        return {
            document,
            attachments: Array.from(this.attachments.values()),
            outputPath,
            warnings: [] // TODO: Implement warning collection
        };
    }
    async validateMarkdownFile(filePath) {
        // Path traversal protection
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath.includes('..') || !path.isAbsolute(normalizedPath)) {
            throw new Error('Invalid file path: Path traversal detected or relative path provided');
        }
        // Check file exists
        try {
            await fs_1.promises.access(filePath);
        }
        catch (error) {
            throw new Error(`File not found: ${filePath}`);
        }
        // Check file extension
        if (!filePath.toLowerCase().endsWith('.md')) {
            throw new Error('Invalid file type: Only Markdown (.md) files are supported');
        }
        // File size validation (10MB limit)
        const stats = await fs_1.promises.stat(filePath);
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (stats.size > maxSize) {
            throw new Error(`File too large: Maximum file size is ${maxSize / (1024 * 1024)}MB`);
        }
        // Ensure we can read the file
        try {
            await fs_1.promises.access(filePath, fs_1.constants.R_OK);
        }
        catch (error) {
            throw new Error(`Cannot read file: ${filePath}. Check file permissions.`);
        }
    }
    validateAndSanitizeOptions(options) {
        const sanitized = {};
        // Validate output format
        if (options.outputFormat) {
            const validFormats = ['json', 'xml', 'package'];
            if (validFormats.includes(options.outputFormat)) {
                sanitized.outputFormat = options.outputFormat;
            }
            else {
                console.warn(`Invalid output format "${options.outputFormat}". Using default "json".`);
            }
        }
        // Validate diagram format
        if (options.diagramFormat) {
            const validDiagramFormats = ['base64', 'attachment'];
            if (validDiagramFormats.includes(options.diagramFormat)) {
                sanitized.diagramFormat = options.diagramFormat;
            }
            else {
                console.warn(`Invalid diagram format "${options.diagramFormat}". Using default "attachment".`);
            }
        }
        // Pass through other options
        if (options.spaceKey)
            sanitized.spaceKey = options.spaceKey;
        if (options.title)
            sanitized.title = options.title;
        if (typeof options.includeAttachments === 'boolean')
            sanitized.includeAttachments = options.includeAttachments;
        if (typeof options.validateOutput === 'boolean')
            sanitized.validateOutput = options.validateOutput;
        if (options.templatePath)
            sanitized.templatePath = options.templatePath;
        return sanitized;
    }
    extractTitleFromMarkdown(content) {
        // Try to extract title from first H1 heading
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match) {
            return h1Match[1].trim();
        }
        // Try to extract from frontmatter if present
        const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
            const titleMatch = frontmatterMatch[1].match(/^title:\s*(.+)$/m);
            if (titleMatch) {
                return titleMatch[1].trim().replace(/^["'](.+)["']$/, '$1');
            }
        }
        return null;
    }
    getOutputPath(inputPath, format) {
        const dir = path.dirname(inputPath);
        const basename = path.basename(inputPath, '.md');
        switch (format) {
            case 'xml':
                return path.join(dir, `${basename}_confluence.xml`);
            case 'package':
                return path.join(dir, `${basename}_confluence.zip`);
            case 'json':
            default:
                return path.join(dir, `${basename}_confluence.json`);
        }
    }
    async processMermaidDiagrams(content, outputDir, progressCallback) {
        const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
        let processedContent = content;
        const matches = [...content.matchAll(mermaidRegex)];
        const cache = diagramCache_js_1.DiagramCache.getInstance();
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const mermaidCode = match[1].trim();
            const diagramId = `mermaid_diagram_${this.mermaidCounter++}`;
            const imagePath = path.join(outputDir, `.temp_${diagramId}.png`);
            const diagramProgress = 15 + (i / matches.length) * 30; // 15-45% range
            progressCallback?.(`🎨 Processing diagram ${i + 1}/${matches.length}...`, diagramProgress);
            try {
                // Use cache to get or render the diagram
                const base64Image = await cache.getOrRender(mermaidCode, imagePath);
                if (this.options.diagramFormat === 'attachment' && this.options.includeAttachments) {
                    // Create attachment for the diagram
                    const attachment = {
                        id: diagramId,
                        title: `${diagramId}.png`,
                        mediaType: 'image/png',
                        data: base64Image,
                        size: Math.round(base64Image.length * 0.75), // Approximate size from base64
                        comment: 'Mermaid diagram generated by Markdown Mermaid Converter'
                    };
                    this.attachments.set(diagramId, attachment);
                    // Replace with placeholder that won't be processed by markdown parser
                    const placeholder = `{{CONFLUENCE_DIAGRAM_${diagramId}}}`;
                    processedContent = processedContent.replace(match[0], placeholder);
                }
                else {
                    // Embed as base64 image  
                    const dataUrl = `data:image/png;base64,${base64Image}`;
                    const placeholder = `{{CONFLUENCE_IMAGE_${diagramId}}}`;
                    // Store the image info for later replacement
                    this.attachments.set(`image_${diagramId}`, {
                        id: `image_${diagramId}`,
                        title: 'Embedded Mermaid Diagram',
                        mediaType: 'image/png',
                        data: base64Image,
                        comment: 'Base64 embedded Mermaid diagram'
                    });
                    processedContent = processedContent.replace(match[0], placeholder);
                }
                console.log(`✅ Processed diagram ${i + 1}: ${(base64Image.length * 0.75 / 1024).toFixed(2)} KB`);
            }
            catch (error) {
                console.error(`❌ Failed to render diagram ${i + 1}:`, error);
                // Create fallback macro for failed diagrams
                const fallbackContent = this.mapper.codeBlock(mermaidCode, 'mermaid');
                processedContent = processedContent.replace(match[0], fallbackContent);
            }
        }
        return processedContent;
    }
    async markdownToConfluence(markdown) {
        // Configure marked for Confluence-compatible parsing
        marked_1.marked.setOptions({
            gfm: true,
            breaks: false,
            pedantic: false
        });
        // Custom renderer for Confluence
        const renderer = new marked_1.marked.Renderer();
        // Override renderer methods to generate Confluence XML
        renderer.heading = (text, level) => this.mapper.heading(level, text);
        renderer.paragraph = (text) => this.mapper.paragraph(text);
        renderer.list = (body, ordered) => {
            const listType = ordered ? 'ol' : 'ul';
            return `<${listType}>${body}</${listType}>`;
        };
        renderer.listitem = (text) => `<li>${text}</li>`;
        renderer.code = (code, language) => this.mapper.codeBlock(code, language);
        renderer.codespan = (code) => this.mapper.inlineCode(code);
        renderer.link = (href, title, text) => this.mapper.link(text, href, title || undefined);
        renderer.image = (href, title, text) => this.mapper.image(text, href, title || undefined);
        renderer.blockquote = (quote) => this.mapper.blockquote(quote);
        renderer.hr = () => this.mapper.horizontalRule();
        renderer.strong = (text) => this.mapper.strong(text);
        renderer.em = (text) => this.mapper.emphasis(text);
        renderer.del = (text) => this.mapper.strikethrough(text);
        marked_1.marked.setOptions({ renderer });
        let confluenceXml = (0, marked_1.marked)(markdown);
        // Post-process to replace diagram placeholders with actual Confluence XML
        confluenceXml = this.replaceDiagramPlaceholders(confluenceXml);
        return confluenceXml;
    }
    replaceDiagramPlaceholders(content) {
        let processedContent = content;
        // Replace diagram placeholders
        for (const [id, attachment] of this.attachments) {
            if (id.startsWith('image_')) {
                // Base64 embedded image placeholder
                const placeholder = `{{CONFLUENCE_IMAGE_${id.replace('image_', '')}}}`;
                const dataUrl = `data:image/png;base64,${attachment.data}`;
                const imageXml = this.mapper.image('Mermaid Diagram', dataUrl, 'Mermaid diagram');
                processedContent = processedContent.replace(placeholder, imageXml);
            }
            else {
                // Attachment reference placeholder
                const placeholder = `{{CONFLUENCE_DIAGRAM_${id}}}`;
                const attachmentXml = this.mapper.mermaidDiagram('', id);
                processedContent = processedContent.replace(placeholder, attachmentXml);
            }
        }
        return processedContent;
    }
    async writeOutput(document, outputPath) {
        const format = this.options.outputFormat;
        switch (format) {
            case 'xml':
                await fs_1.promises.writeFile(outputPath, document.body.storage.value, 'utf-8');
                break;
            case 'package':
                await this.writePackage(document, outputPath);
                break;
            case 'json':
            default:
                await fs_1.promises.writeFile(outputPath, JSON.stringify(document, null, 2), 'utf-8');
                break;
        }
        console.log(`✅ Confluence document created: ${outputPath}`);
    }
    async writePackage(document, outputPath) {
        try {
            // For now, create a directory structure instead of a ZIP file
            const packageDir = outputPath.replace('.zip', '_package');
            await fs_1.promises.mkdir(packageDir, { recursive: true });
            // Write the main document JSON
            const documentPath = path.join(packageDir, 'document.json');
            await fs_1.promises.writeFile(documentPath, JSON.stringify(document, null, 2), 'utf-8');
            // Write attachments if they exist
            if (document.attachments && document.attachments.length > 0) {
                const attachmentsDir = path.join(packageDir, 'attachments');
                await fs_1.promises.mkdir(attachmentsDir, { recursive: true });
                for (const attachment of document.attachments) {
                    if (attachment.data) {
                        const attachmentPath = path.join(attachmentsDir, attachment.title);
                        const buffer = Buffer.from(attachment.data, 'base64');
                        await fs_1.promises.writeFile(attachmentPath, buffer);
                    }
                }
                // Write attachment manifest
                const manifestPath = path.join(packageDir, 'attachments.json');
                const manifest = document.attachments.map(att => ({
                    id: att.id,
                    title: att.title,
                    mediaType: att.mediaType,
                    size: att.size,
                    comment: att.comment
                }));
                await fs_1.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
            }
            // Write README
            const readmePath = path.join(packageDir, 'README.md');
            const readme = `# Confluence Document Package

This package contains:
- \`document.json\`: Main Confluence document in Storage Format
- \`attachments/\`: Directory containing binary attachments
- \`attachments.json\`: Attachment metadata manifest

## Usage
1. Upload \`document.json\` to Confluence via REST API
2. Upload attachments from \`attachments/\` directory
3. Reference attachment metadata from \`attachments.json\`
`;
            await fs_1.promises.writeFile(readmePath, readme, 'utf-8');
            console.log(`📦 Package created: ${packageDir}`);
            console.log(`⚠️  Note: Created directory structure instead of ZIP file. To create ZIP, use external tool or library.`);
        }
        catch (error) {
            console.error('Failed to create package:', error);
            // Fallback to JSON
            const fallbackPath = outputPath.replace('.zip', '.json');
            await fs_1.promises.writeFile(fallbackPath, JSON.stringify(document, null, 2), 'utf-8');
            console.log(`⚠️  Package creation failed, created JSON instead: ${fallbackPath}`);
        }
    }
    async cleanupTempImages(outputDir) {
        const tempImagePattern = /^\.temp_mermaid_diagram_\d+\.png$/;
        try {
            const files = await fs_1.promises.readdir(outputDir);
            // Use Promise.all for concurrent file deletion
            await Promise.all(files
                .filter(file => tempImagePattern.test(file))
                .map(async (file) => {
                try {
                    await fs_1.promises.unlink(path.join(outputDir, file));
                }
                catch (error) {
                    console.error(`Failed to delete temp file ${file}:`, error);
                }
            }));
        }
        catch (error) {
            console.error('Failed to cleanup temp files:', error);
        }
    }
}
exports.ConfluenceConverter = ConfluenceConverter;
