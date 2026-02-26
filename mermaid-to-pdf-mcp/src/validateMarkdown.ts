// mermaid-to-pdf-mcp/src/validateMarkdown.ts
// Syntax-level validation of Mermaid diagrams in Markdown content.

/** Recognized Mermaid diagram type keywords. */
const VALID_DIAGRAM_TYPES = new Set([
    'flowchart',
    'graph',
    'sequencediagram',
    'classdiagram',
    'statediagram',
    'statediagram-v2',
    'erdiagram',
    'gantt',
    'pie',
    'gitgraph',
    'journey',
    'mindmap',
    'timeline',
    'quadrantchart',
    'sankey-beta',
    'xychart-beta',
    'block-beta',
    'requirement',
    'requirementdiagram',
    'c4context',
    'c4container',
    'c4component',
    'c4deployment',
    'zenuml',
    'packet-beta',
    'architecture-beta',
    'kanban',
]);

/** Fenced mermaid code block pattern. */
const MERMAID_REGEX = /```mermaid\r?\n([\s\S]*?)```/g;

export interface DiagramValidationResult {
    index: number;
    type: string | null;
    valid: boolean;
    error?: string;
}

export interface ValidationResult {
    valid: boolean;
    diagrams: DiagramValidationResult[];
}

/**
 * Extract the diagram type keyword from the first non-empty, non-directive line.
 *
 * Mermaid diagrams can start with directives like `%%{init: {...}}%%` or
 * comment lines starting with `%%`. We skip those to find the actual type.
 */
function extractDiagramType(code: string): string | null {
    const lines = code.split('\n');
    for (const raw of lines) {
        const line = raw.trim();
        // Skip empty lines
        if (line.length === 0) continue;
        // Skip directive lines %%{ ... }%%
        if (line.startsWith('%%{') || line.startsWith('%%')) continue;
        // The first significant token is the diagram type
        // Mermaid types can be multi-word with hyphen (e.g. "stateDiagram-v2")
        // or followed by whitespace/colon (e.g. "flowchart LR", "graph TD")
        const match = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)/);
        return match ? match[1] : null;
    }
    return null;
}

/**
 * Validate markdown content by extracting mermaid code blocks and checking
 * that each starts with a recognized diagram type keyword.
 *
 * This is a lightweight syntax-level check that does not require Puppeteer.
 */
export function validateMarkdown(markdown: string): ValidationResult {
    const diagrams: DiagramValidationResult[] = [];

    const matches = [...markdown.matchAll(MERMAID_REGEX)];

    for (let i = 0; i < matches.length; i++) {
        const code = matches[i][1].trim();
        const diagramType = extractDiagramType(code);

        if (!diagramType) {
            diagrams.push({
                index: i,
                type: null,
                valid: false,
                error: 'Could not detect a diagram type. The code block appears empty or starts with an unrecognized token.',
            });
            continue;
        }

        const normalizedType = diagramType.toLowerCase();
        if (VALID_DIAGRAM_TYPES.has(normalizedType)) {
            diagrams.push({
                index: i,
                type: diagramType,
                valid: true,
            });
        } else {
            diagrams.push({
                index: i,
                type: diagramType,
                valid: false,
                error: `Unrecognized diagram type "${diagramType}". Expected one of the known Mermaid diagram types.`,
            });
        }
    }

    const allValid = diagrams.length > 0 && diagrams.every(d => d.valid);

    return {
        valid: allValid,
        diagrams,
    };
}
