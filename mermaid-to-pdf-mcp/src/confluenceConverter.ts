import { promises as fs } from 'fs';
import * as path from 'path';
import { marked } from 'marked';

export interface ConfluenceDocument {
  type: 'page' | 'blogpost';
  title: string;
  space?: {
    key: string;
  };
  body: {
    storage: {
      value: string;
      representation: 'storage';
    };
  };
  attachments?: ConfluenceAttachment[];
}

export interface ConfluenceAttachment {
  id: string;
  title: string;
  mediaType: string;
  data?: string;
  size?: number;
  comment?: string;
}

export interface ConfluenceConversionOptions {
  spaceKey?: string;
  title?: string;
  outputFormat: 'json' | 'xml' | 'package';
  includeAttachments: boolean;
  diagramFormat: 'base64' | 'attachment';
}

export interface ConversionResult {
  document: ConfluenceDocument;
  attachments: ConfluenceAttachment[];
  warnings: string[];
}

export class SimplifiedConfluenceConverter {
  private mermaidCounter = 0;
  private attachments: Map<string, ConfluenceAttachment> = new Map();
  private options: ConfluenceConversionOptions;

  constructor(options: Partial<ConfluenceConversionOptions> = {}) {
    this.options = {
      spaceKey: options.spaceKey,
      title: options.title,
      outputFormat: options.outputFormat || 'json',
      includeAttachments: options.includeAttachments !== false,
      diagramFormat: options.diagramFormat || 'attachment'
    };
  }

  async convertMarkdown(markdown: string, converter?: any): Promise<ConversionResult> {
    // Extract title from markdown if not provided
    const documentTitle = this.options.title || this.extractTitleFromMarkdown(markdown) || 'Untitled Document';
    
    // Process Mermaid diagrams with actual rendering if converter provided
    let processedContent: string;
    if (converter) {
      processedContent = await this.processMermaidDiagrams(markdown, converter);
    } else {
      processedContent = await this.processMermaidDiagramsFallback(markdown);
    }
    
    // Convert markdown to Confluence XML
    let confluenceXml = this.markdownToConfluence(processedContent);
    
    // Post-process to replace diagram placeholders
    confluenceXml = this.replaceDiagramPlaceholders(confluenceXml);
    
    // Build document
    const document: ConfluenceDocument = {
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

    return {
      document,
      attachments: Array.from(this.attachments.values()),
      warnings: []
    };
  }

  private async processMermaidDiagramsFallback(content: string): Promise<string> {
    const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
    let processedContent = content;

    let match;
    while ((match = mermaidRegex.exec(content)) !== null) {
      const mermaidCode = match[1].trim();
      const diagramId = `mermaid_diagram_${this.mermaidCounter++}`;
      
      if (this.options.diagramFormat === 'attachment' && this.options.includeAttachments) {
        // Create placeholder attachment
        const attachment: ConfluenceAttachment = {
          id: diagramId,
          title: `${diagramId}.png`,
          mediaType: 'image/png',
          comment: 'Mermaid diagram (rendering not available in simplified converter)'
        };
        
        this.attachments.set(diagramId, attachment);
        
        // Replace with placeholder
        const placeholder = `<!-- CONFLUENCE_DIAGRAM_PLACEHOLDER_${diagramId} -->`;
        processedContent = processedContent.replace(match[0], placeholder);
      } else {
        // Replace with code block
        const placeholder = `{{CONFLUENCE_CODE_PLACEHOLDER_${diagramId}}}`;
        this.attachments.set(`code_${diagramId}`, {
          id: `code_${diagramId}`,
          title: 'Mermaid Code Block',
          mediaType: 'text/plain',
          comment: mermaidCode
        });
        processedContent = processedContent.replace(match[0], placeholder);
      }
    }

    return processedContent;
  }

  private replaceDiagramPlaceholders(content: string): string {
    let processedContent = content;
    
    // Replace diagram placeholders
    for (const [id, attachment] of this.attachments) {
      if (id.startsWith('image_')) {
        // Base64 embedded image placeholder
        const placeholder = `<!-- CONFLUENCE_IMAGE_PLACEHOLDER_${id.replace('image_', '')} -->`;
        const dataUrl = `data:image/png;base64,${attachment.data}`;
        const imageXml = `<ac:image ac:alt="Mermaid Diagram">
      <ri:url ri:value="${this.escapeXml(dataUrl)}" />
    </ac:image>`;
        processedContent = processedContent.replace(placeholder, imageXml);
      } else if (id.startsWith('code_')) {
        // Code block placeholder
        const placeholder = `{{CONFLUENCE_CODE_PLACEHOLDER_${id.replace('code_', '')}}}`;
        const codeXml = `<ac:macro ac:name="code">
      <ac:parameter ac:name="language">mermaid</ac:parameter>
      <ac:plain-text-body><![CDATA[${attachment.comment}]]></ac:plain-text-body>
    </ac:macro>`;
        processedContent = processedContent.replace(placeholder, codeXml);
      } else {
        // Attachment reference placeholder
        const placeholder = `<!-- CONFLUENCE_DIAGRAM_PLACEHOLDER_${id} -->`;
        const attachmentXml = `<ac:image ac:title="${id}.png">
        <ri:attachment ri:filename="${id}.png" />
      </ac:image>`;
        processedContent = processedContent.replace(placeholder, attachmentXml);
      }
    }
    
    return processedContent;
  }

  private extractTitleFromMarkdown(content: string): string | null {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }
    return null;
  }

  async processMermaidDiagrams(content: string, converter: any): Promise<string> {
    const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
    let processedContent = content;
    const matches = [...content.matchAll(mermaidRegex)];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const mermaidCode = match[1].trim();
      const diagramId = `mermaid_diagram_${this.mermaidCounter++}`;
      
      try {
        if (this.options.diagramFormat === 'attachment' && this.options.includeAttachments) {
          // Use the main converter to render the diagram
          const diagrams = await converter.extractMermaidDiagrams(`\`\`\`mermaid\n${mermaidCode}\n\`\`\``, 'png');
          
          if (diagrams && diagrams.length > 0) {
            const diagram = diagrams[0];
            
            // Create actual attachment with rendered image
            const attachment: ConfluenceAttachment = {
              id: diagramId,
              title: `${diagramId}.png`,
              mediaType: 'image/png',
              data: diagram.imageBase64,
              size: Math.round(diagram.imageBase64.length * 0.75),
              comment: 'Mermaid diagram generated by MCP server'
            };
            
            this.attachments.set(diagramId, attachment);
            
            // Replace with placeholder to avoid double-escaping
            const placeholder = `<!-- CONFLUENCE_DIAGRAM_PLACEHOLDER_${diagramId} -->`;
            processedContent = processedContent.replace(match[0], placeholder);
          } else {
            throw new Error('Failed to render diagram');
          }
        } else {
          // Try to render as base64 image
          const diagrams = await converter.extractMermaidDiagrams(`\`\`\`mermaid\n${mermaidCode}\n\`\`\``, 'png');
          
          if (diagrams && diagrams.length > 0) {
            const diagram = diagrams[0];
            const placeholder = `<!-- CONFLUENCE_IMAGE_PLACEHOLDER_${diagramId} -->`;
            
            // Store the image info for later replacement
            this.attachments.set(`image_${diagramId}`, {
              id: `image_${diagramId}`,
              title: 'Embedded Mermaid Diagram',
              mediaType: 'image/png',
              data: diagram.imageBase64,
              comment: 'Base64 embedded Mermaid diagram'
            });
            
            processedContent = processedContent.replace(match[0], placeholder);
          } else {
            throw new Error('Failed to render diagram');
          }
        }
      } catch (error) {
        // Fallback to code block
        const fallbackContent = `<ac:macro ac:name="code">
      <ac:parameter ac:name="language">mermaid</ac:parameter>
      <ac:plain-text-body><![CDATA[${mermaidCode}]]></ac:plain-text-body>
    </ac:macro>`;
        processedContent = processedContent.replace(match[0], fallbackContent);
      }
    }

    return processedContent;
  }

  private markdownToConfluence(markdown: string): string {
    // Configure marked for Confluence-compatible parsing
    marked.setOptions({
      gfm: true,
      breaks: false,
      pedantic: false
    });
    
    // Custom renderer for Confluence
    const renderer = new marked.Renderer();
    
    // Override renderer methods to generate Confluence XML
    renderer.heading = (text: string, level: number) => 
      `<h${Math.min(Math.max(level, 1), 6)}>${this.escapeXml(text)}</h${Math.min(Math.max(level, 1), 6)}>`;
    
    renderer.paragraph = (text: string) => text.trim() ? `<p>${text}</p>` : '<p />';
    
    renderer.list = (body: string, ordered: boolean) => {
      const listType = ordered ? 'ol' : 'ul';
      return `<${listType}>${body}</${listType}>`;
    };
    
    renderer.listitem = (text: string) => `<li>${text}</li>`;
    
    renderer.code = (code: string, language?: string) => {
      const langParam = language ? `<ac:parameter ac:name="language">${this.escapeXml(language)}</ac:parameter>` : '';
      return `<ac:macro ac:name="code">
      ${langParam}
      <ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body>
    </ac:macro>`;
    };
    
    renderer.codespan = (code: string) => `<code>${this.escapeXml(code)}</code>`;
    
    renderer.link = (href: string, title: string | null, text: string) => 
      `<a href="${this.escapeXml(href)}"${title ? ` title="${this.escapeXml(title)}"` : ''}>${this.escapeXml(text)}</a>`;
    
    renderer.image = (href: string, title: string | null, text: string) => {
      const titleAttr = title ? ` ac:title="${this.escapeXml(title)}"` : '';
      const altAttr = text ? ` ac:alt="${this.escapeXml(text)}"` : '';
      return `<ac:image${titleAttr}${altAttr}>
      <ri:url ri:value="${this.escapeXml(href)}" />
    </ac:image>`;
    };
    
    renderer.blockquote = (quote: string) => 
      `<ac:macro ac:name="quote">
      <ac:rich-text-body>${quote}</ac:rich-text-body>
    </ac:macro>`;
    
    renderer.hr = () => '<hr />';
    
    renderer.strong = (text: string) => `<strong>${text}</strong>`;
    renderer.em = (text: string) => `<em>${text}</em>`;
    renderer.del = (text: string) => `<s>${text}</s>`;
    
    renderer.table = (header: string, body: string) => 
      `<table><thead>${header}</thead><tbody>${body}</tbody></table>` as any;
    
    renderer.tablerow = (content: string) => `<tr>${content}</tr>` as any;
    
    renderer.tablecell = (content: string, flags: any) => {
      const tag = flags.header ? 'th' : 'td';
      return `<${tag}>${content}</${tag}>` as any;
    };
    
    marked.setOptions({ renderer });
    
    return marked(markdown) as string;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}