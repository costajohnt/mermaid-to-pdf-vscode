export interface ConfluenceDocument {
    type: 'page' | 'blogpost';
    title: string;
    space?: {
        key: string;
        id?: number;
        name?: string;
    };
    body: {
        storage: {
            value: string;
            representation: 'storage';
        };
    };
    version?: {
        number: number;
        minorEdit?: boolean;
        hidden?: boolean;
    };
    ancestors?: ConfluencePageReference[];
    metadata?: Record<string, any>;
    attachments?: ConfluenceAttachment[];
}
export interface ConfluencePageReference {
    id: string;
    type: 'page';
    title?: string;
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
    validateOutput: boolean;
    templatePath?: string;
}
export interface ConfluenceElementMapping {
    heading: (level: number, text: string, id?: string) => string;
    paragraph: (text: string) => string;
    list: (items: string[], ordered: boolean) => string;
    listItem: (text: string) => string;
    table: (headers: string[], rows: string[][]) => string;
    codeBlock: (code: string, language?: string) => string;
    inlineCode: (code: string) => string;
    link: (text: string, url: string, title?: string) => string;
    image: (alt: string, src: string, title?: string) => string;
    blockquote: (text: string) => string;
    horizontalRule: () => string;
    strong: (text: string) => string;
    emphasis: (text: string) => string;
    strikethrough: (text: string) => string;
    mermaidDiagram: (diagramCode: string, attachmentId: string) => string;
}
export interface ConversionResult {
    document: ConfluenceDocument;
    attachments: ConfluenceAttachment[];
    outputPath: string;
    warnings: string[];
}
export interface ConfluenceValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface ConfluenceLayout {
    type: 'layout';
    sections: ConfluenceLayoutSection[];
}
export interface ConfluenceLayoutSection {
    type: 'layout-section';
    cells: ConfluenceLayoutCell[];
}
export interface ConfluenceLayoutCell {
    type: 'layout-cell';
    content: string;
}
export interface ConfluenceMacro {
    name: string;
    parameters?: Record<string, string>;
    body?: string;
    richTextBody?: string;
}
export interface ConfluenceResourceIdentifier {
    type: 'page' | 'blogpost' | 'attachment' | 'user' | 'space';
    identifier: string;
    version?: number;
}
export interface ConfluenceLink {
    resourceIdentifier?: ConfluenceResourceIdentifier;
    anchor?: string;
    linkBody?: string;
}
//# sourceMappingURL=confluence.d.ts.map