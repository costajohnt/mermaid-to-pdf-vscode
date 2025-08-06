import { 
  ConfluenceConversionOptions, 
  ConfluenceElementMapping,
  ConfluenceMacro 
} from './types/confluence.js';

export class MarkdownToConfluenceMapper implements ConfluenceElementMapping {
  private options: ConfluenceConversionOptions;

  constructor(options: ConfluenceConversionOptions) {
    this.options = options;
  }

  heading(level: number, text: string, id?: string): string {
    // Confluence supports h1-h6 headings
    const headingLevel = Math.min(Math.max(level, 1), 6);
    const anchorId = id ? ` ac:name="${this.escapeXml(id)}"` : '';
    return `<h${headingLevel}${anchorId}>${this.escapeXml(text)}</h${headingLevel}>`;
  }

  paragraph(text: string): string {
    // Handle empty paragraphs
    if (!text.trim()) {
      return '<p />';
    }
    return `<p>${text}</p>`;
  }

  list(items: string[], ordered: boolean): string {
    const listType = ordered ? 'ol' : 'ul';
    const listItems = items.map(item => this.listItem(item)).join('');
    return `<${listType}>${listItems}</${listType}>`;
  }

  listItem(text: string): string {
    return `<li>${text}</li>`;
  }

  table(headers: string[], rows: string[][]): string {
    const headerRow = headers.map(header => 
      `<th>${this.escapeXml(header)}</th>`
    ).join('');
    
    const bodyRows = rows.map(row => 
      `<tr>${row.map(cell => `<td>${this.escapeXml(cell)}</td>`).join('')}</tr>`
    ).join('');

    return `<table>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
  }

  codeBlock(code: string, language?: string): string {
    // Use Confluence code macro for syntax highlighting
    const langParam = language ? ` ac:name="language" ac:value="${this.escapeXml(language)}"` : '';
    
    return `<ac:macro ac:name="code">
      ${language ? `<ac:parameter${langParam} />` : ''}
      <ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body>
    </ac:macro>`;
  }

  inlineCode(code: string): string {
    // Confluence doesn't have a direct inline code equivalent, use monospace formatting
    return `<code>${this.escapeXml(code)}</code>`;
  }

  link(text: string, url: string, title?: string): string {
    // Handle different types of links
    if (this.isInternalLink(url)) {
      return this.createInternalLink(text, url, title);
    } else if (this.isAttachmentLink(url)) {
      return this.createAttachmentLink(text, url, title);
    } else {
      return this.createExternalLink(text, url, title);
    }
  }

  image(alt: string, src: string, title?: string): string {
    if (this.isAttachmentReference(src)) {
      return this.createAttachmentImage(alt, src, title);
    } else if (src.startsWith('data:image/')) {
      // Handle base64 images - Confluence doesn't support data URLs directly
      // We'll need to convert these to attachments or external references
      return this.createDataUrlImage(alt, src, title);
    } else {
      return this.createExternalImage(alt, src, title);
    }
  }

  blockquote(text: string): string {
    return `<ac:macro ac:name="quote">
      <ac:rich-text-body>${text}</ac:rich-text-body>
    </ac:macro>`;
  }

  horizontalRule(): string {
    return '<hr />';
  }

  strong(text: string): string {
    return `<strong>${text}</strong>`;
  }

  emphasis(text: string): string {
    return `<em>${text}</em>`;
  }

  strikethrough(text: string): string {
    return `<s>${text}</s>`;
  }

  mermaidDiagram(diagramCode: string, attachmentId: string): string {
    if (this.options.diagramFormat === 'attachment') {
      return `<ac:image ac:title="${attachmentId}.png">
        <ri:attachment ri:filename="${attachmentId}.png" />
      </ac:image>`;
    } else {
      // Fallback to code block if attachment format not used
      return this.codeBlock(diagramCode, 'mermaid');
    }
  }

  // Utility methods for creating different types of links and images

  private createInternalLink(text: string, url: string, title?: string): string {
    // Extract page title from URL (simple implementation)
    const pageTitle = this.extractPageTitleFromUrl(url);
    const titleAttr = title ? ` ac:title="${this.escapeXml(title)}"` : '';
    
    return `<ac:link${titleAttr}>
      <ri:page ri:content-title="${this.escapeXml(pageTitle)}" />
      <ac:plain-text-link-body><![CDATA[${text}]]></ac:plain-text-link-body>
    </ac:link>`;
  }

  private createAttachmentLink(text: string, url: string, title?: string): string {
    const filename = this.extractFilenameFromUrl(url);
    const titleAttr = title ? ` ac:title="${this.escapeXml(title)}"` : '';
    
    return `<ac:link${titleAttr}>
      <ri:attachment ri:filename="${this.escapeXml(filename)}" />
      <ac:plain-text-link-body><![CDATA[${text}]]></ac:plain-text-link-body>
    </ac:link>`;
  }

  private createExternalLink(text: string, url: string, title?: string): string {
    const titleAttr = title ? ` title="${this.escapeXml(title)}"` : '';
    return `<a href="${this.escapeXml(url)}"${titleAttr}>${this.escapeXml(text)}</a>`;
  }

  private createAttachmentImage(alt: string, src: string, title?: string): string {
    const filename = this.extractFilenameFromUrl(src);
    const titleAttr = title ? ` ac:title="${this.escapeXml(title)}"` : '';
    const altAttr = alt ? ` ac:alt="${this.escapeXml(alt)}"` : '';
    
    return `<ac:image${titleAttr}${altAttr}>
      <ri:attachment ri:filename="${this.escapeXml(filename)}" />
    </ac:image>`;
  }

  private createDataUrlImage(alt: string, src: string, title?: string): string {
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

  private createExternalImage(alt: string, src: string, title?: string): string {
    const titleAttr = title ? ` ac:title="${this.escapeXml(title)}"` : '';
    const altAttr = alt ? ` ac:alt="${this.escapeXml(alt)}"` : '';
    
    return `<ac:image${titleAttr}${altAttr}>
      <ri:url ri:value="${this.escapeXml(src)}" />
    </ac:image>`;
  }

  // Helper methods for URL analysis

  private isInternalLink(url: string): boolean {
    // Simple heuristic: relative URLs or URLs without protocol are internal
    return !url.includes('://') && !url.startsWith('mailto:') && !url.startsWith('#');
  }

  private isAttachmentLink(url: string): boolean {
    // Simple heuristic: URLs ending with file extensions
    const fileExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|tar|gz|png|jpg|jpeg|gif|svg)$/i;
    return fileExtensions.test(url);
  }

  private isAttachmentReference(src: string): boolean {
    // Check if this is a reference to an attachment we created
    return src.startsWith('attachment:') || src.includes('ri:attachment');
  }

  private extractPageTitleFromUrl(url: string): string {
    // Extract page title from URL - this is a simplified implementation
    // In a real implementation, you might want to resolve the URL properly
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return decodeURIComponent(lastPart.replace(/[-_]/g, ' '));
  }

  private extractFilenameFromUrl(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }

  // XML escaping utility

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Macro creation utility

  createMacro(name: string, parameters?: Record<string, string>, body?: string, richTextBody?: string): string {
    const params = parameters ? 
      Object.entries(parameters)
        .map(([key, value]) => `<ac:parameter ac:name="${this.escapeXml(key)}">${this.escapeXml(value)}</ac:parameter>`)
        .join('') : '';
    
    let bodyContent = '';
    if (richTextBody) {
      bodyContent = `<ac:rich-text-body>${richTextBody}</ac:rich-text-body>`;
    } else if (body) {
      bodyContent = `<ac:plain-text-body><![CDATA[${body}]]></ac:plain-text-body>`;
    }

    return `<ac:macro ac:name="${this.escapeXml(name)}">
      ${params}
      ${bodyContent}
    </ac:macro>`;
  }

  // Layout creation utilities

  createLayout(sections: { cells: string[] }[]): string {
    const layoutSections = sections.map(section => 
      this.createLayoutSection(section.cells)
    ).join('');

    return `<ac:layout>
      ${layoutSections}
    </ac:layout>`;
  }

  private createLayoutSection(cells: string[]): string {
    const layoutCells = cells.map(cell => 
      `<ac:layout-cell>${cell}</ac:layout-cell>`
    ).join('');

    return `<ac:layout-section ac:type="single">
      ${layoutCells}
    </ac:layout-section>`;
  }

  // Table of contents utility

  createTableOfContents(maxHeadingLevel: number = 6): string {
    return this.createMacro('toc', {
      'maxLevel': maxHeadingLevel.toString()
    });
  }

  // Status and info macros

  createStatus(title: string, color: 'grey' | 'red' | 'yellow' | 'green' | 'blue' = 'grey'): string {
    return this.createMacro('status', {
      'colour': color,
      'title': title
    });
  }

  createInfoPanel(title: string, content: string, type: 'info' | 'note' | 'warning' | 'tip' = 'info'): string {
    return this.createMacro(type, { 'title': title }, undefined, `<p>${this.escapeXml(content)}</p>`);
  }
}