"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownToConfluenceMapper = void 0;
class MarkdownToConfluenceMapper {
    constructor(options) {
        this.options = options;
    }
    heading(level, text, id) {
        // Confluence supports h1-h6 headings
        const headingLevel = Math.min(Math.max(level, 1), 6);
        const anchorId = id ? ` ac:name="${this.escapeXml(id)}"` : '';
        return `<h${headingLevel}${anchorId}>${this.escapeXml(text)}</h${headingLevel}>`;
    }
    paragraph(text) {
        // Handle empty paragraphs
        if (!text.trim()) {
            return '<p />';
        }
        return `<p>${text}</p>`;
    }
    list(items, ordered) {
        const listType = ordered ? 'ol' : 'ul';
        const listItems = items.map(item => this.listItem(item)).join('');
        return `<${listType}>${listItems}</${listType}>`;
    }
    listItem(text) {
        return `<li>${text}</li>`;
    }
    table(headers, rows) {
        const headerRow = headers.map(header => `<th>${this.escapeXml(header)}</th>`).join('');
        const bodyRows = rows.map(row => `<tr>${row.map(cell => `<td>${this.escapeXml(cell)}</td>`).join('')}</tr>`).join('');
        return `<table>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
    }
    codeBlock(code, language) {
        // Use Confluence code macro for syntax highlighting
        const langParam = language ? ` ac:name="language" ac:value="${this.escapeXml(language)}"` : '';
        return `<ac:macro ac:name="code">
      ${language ? `<ac:parameter${langParam} />` : ''}
      <ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body>
    </ac:macro>`;
    }
    inlineCode(code) {
        // Confluence doesn't have a direct inline code equivalent, use monospace formatting
        return `<code>${this.escapeXml(code)}</code>`;
    }
    link(text, url, title) {
        // Handle different types of links
        if (this.isInternalLink(url)) {
            return this.createInternalLink(text, url, title);
        }
        else if (this.isAttachmentLink(url)) {
            return this.createAttachmentLink(text, url, title);
        }
        else {
            return this.createExternalLink(text, url, title);
        }
    }
    image(alt, src, title) {
        if (this.isAttachmentReference(src)) {
            return this.createAttachmentImage(alt, src, title);
        }
        else if (src.startsWith('data:image/')) {
            // Handle base64 images - Confluence doesn't support data URLs directly
            // We'll need to convert these to attachments or external references
            return this.createDataUrlImage(alt, src, title);
        }
        else {
            return this.createExternalImage(alt, src, title);
        }
    }
    blockquote(text) {
        return `<ac:macro ac:name="quote">
      <ac:rich-text-body>${text}</ac:rich-text-body>
    </ac:macro>`;
    }
    horizontalRule() {
        return '<hr />';
    }
    strong(text) {
        return `<strong>${text}</strong>`;
    }
    emphasis(text) {
        return `<em>${text}</em>`;
    }
    strikethrough(text) {
        return `<s>${text}</s>`;
    }
    mermaidDiagram(diagramCode, attachmentId) {
        if (this.options.diagramFormat === 'attachment') {
            return `<ac:image ac:title="${attachmentId}.png">
        <ri:attachment ri:filename="${attachmentId}.png" />
      </ac:image>`;
        }
        else {
            // Fallback to code block if attachment format not used
            return this.codeBlock(diagramCode, 'mermaid');
        }
    }
    // Utility methods for creating different types of links and images
    createInternalLink(text, url, title) {
        // Extract page title from URL (simple implementation)
        const pageTitle = this.extractPageTitleFromUrl(url);
        const titleAttr = title ? ` ac:title="${this.escapeXml(title)}"` : '';
        return `<ac:link${titleAttr}>
      <ri:page ri:content-title="${this.escapeXml(pageTitle)}" />
      <ac:plain-text-link-body><![CDATA[${text}]]></ac:plain-text-link-body>
    </ac:link>`;
    }
    createAttachmentLink(text, url, title) {
        const filename = this.extractFilenameFromUrl(url);
        const titleAttr = title ? ` ac:title="${this.escapeXml(title)}"` : '';
        return `<ac:link${titleAttr}>
      <ri:attachment ri:filename="${this.escapeXml(filename)}" />
      <ac:plain-text-link-body><![CDATA[${text}]]></ac:plain-text-link-body>
    </ac:link>`;
    }
    createExternalLink(text, url, title) {
        const titleAttr = title ? ` title="${this.escapeXml(title)}"` : '';
        return `<a href="${this.escapeXml(url)}"${titleAttr}>${this.escapeXml(text)}</a>`;
    }
    createAttachmentImage(alt, src, title) {
        const filename = this.extractFilenameFromUrl(src);
        const titleAttr = title ? ` ac:title="${this.escapeXml(title)}"` : '';
        const altAttr = alt ? ` ac:alt="${this.escapeXml(alt)}"` : '';
        return `<ac:image${titleAttr}${altAttr}>
      <ri:attachment ri:filename="${this.escapeXml(filename)}" />
    </ac:image>`;
    }
    createDataUrlImage(alt, src, title) {
        // For data URLs, we need to extract and potentially create an attachment
        // For now, create a placeholder that indicates the image needs to be handled
        const altText = alt || 'Embedded Image';
        return `<ac:macro ac:name="info">
      <ac:parameter ac:name="title">Embedded Image</ac:parameter>
      <ac:rich-text-body>
        <p><strong>${this.escapeXml(altText)}</strong></p>
        <p><em>Note: Base64 embedded image needs to be uploaded as attachment</em></p>
      </ac:rich-text-body>
    </ac:macro>`;
    }
    createExternalImage(alt, src, title) {
        const titleAttr = title ? ` ac:title="${this.escapeXml(title)}"` : '';
        const altAttr = alt ? ` ac:alt="${this.escapeXml(alt)}"` : '';
        return `<ac:image${titleAttr}${altAttr}>
      <ri:url ri:value="${this.escapeXml(src)}" />
    </ac:image>`;
    }
    // Helper methods for URL analysis
    isInternalLink(url) {
        // Simple heuristic: relative URLs or URLs without protocol are internal
        return !url.includes('://') && !url.startsWith('mailto:') && !url.startsWith('#');
    }
    isAttachmentLink(url) {
        // Simple heuristic: URLs ending with file extensions
        const fileExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|tar|gz|png|jpg|jpeg|gif|svg)$/i;
        return fileExtensions.test(url);
    }
    isAttachmentReference(src) {
        // Check if this is a reference to an attachment we created
        return src.startsWith('attachment:') || src.includes('ri:attachment');
    }
    extractPageTitleFromUrl(url) {
        // Extract page title from URL - this is a simplified implementation
        // In a real implementation, you might want to resolve the URL properly
        const parts = url.split('/');
        const lastPart = parts[parts.length - 1];
        return decodeURIComponent(lastPart.replace(/[-_]/g, ' '));
    }
    extractFilenameFromUrl(url) {
        const parts = url.split('/');
        return parts[parts.length - 1];
    }
    // XML escaping utility
    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    // Macro creation utility
    createMacro(name, parameters, body, richTextBody) {
        const params = parameters ?
            Object.entries(parameters)
                .map(([key, value]) => `<ac:parameter ac:name="${this.escapeXml(key)}">${this.escapeXml(value)}</ac:parameter>`)
                .join('') : '';
        let bodyContent = '';
        if (richTextBody) {
            bodyContent = `<ac:rich-text-body>${richTextBody}</ac:rich-text-body>`;
        }
        else if (body) {
            bodyContent = `<ac:plain-text-body><![CDATA[${body}]]></ac:plain-text-body>`;
        }
        return `<ac:macro ac:name="${this.escapeXml(name)}">
      ${params}
      ${bodyContent}
    </ac:macro>`;
    }
    // Layout creation utilities
    createLayout(sections) {
        const layoutSections = sections.map(section => this.createLayoutSection(section.cells)).join('');
        return `<ac:layout>
      ${layoutSections}
    </ac:layout>`;
    }
    createLayoutSection(cells) {
        const layoutCells = cells.map(cell => `<ac:layout-cell>${cell}</ac:layout-cell>`).join('');
        return `<ac:layout-section ac:type="single">
      ${layoutCells}
    </ac:layout-section>`;
    }
    // Table of contents utility
    createTableOfContents(maxHeadingLevel = 6) {
        return this.createMacro('toc', {
            'maxLevel': maxHeadingLevel.toString()
        });
    }
    // Status and info macros
    createStatus(title, color = 'grey') {
        return this.createMacro('status', {
            'colour': color,
            'title': title
        });
    }
    createInfoPanel(title, content, type = 'info') {
        return this.createMacro(type, { 'title': title }, undefined, `<p>${this.escapeXml(content)}</p>`);
    }
}
exports.MarkdownToConfluenceMapper = MarkdownToConfluenceMapper;
