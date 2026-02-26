// src/diagramTypes.test.ts
// Issue #53: Expand Mermaid diagram type coverage
//
// Verifies that the markdown parser correctly extracts mermaid code blocks
// for a wide variety of diagram types.  Does NOT require Puppeteer — only
// tests the regex-based extraction logic used by the Converter._convert()
// pipeline.
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * The same regex the converter uses to locate mermaid code blocks.
 * Duplicated here intentionally so the test stays independent of the
 * module's internal exports.
 */
const MERMAID_REGEX = /```mermaid\r?\n([\s\S]*?)```/g;

/** Extract trimmed mermaid code blocks from a markdown string. */
function extractMermaidBlocks(markdown: string): string[] {
    return [...markdown.matchAll(MERMAID_REGEX)].map(m => m[1].trim());
}

// -----------------------------------------------------------------------
// Diagram samples — each one is a minimal valid example of its type.
// -----------------------------------------------------------------------

const DIAGRAM_SAMPLES: Record<string, string> = {
    'state diagram': [
        'stateDiagram-v2',
        '    [*] --> Idle',
        '    Idle --> Processing : start',
        '    Processing --> Done : finish',
        '    Done --> [*]',
    ].join('\n'),

    'entity relationship (ER)': [
        'erDiagram',
        '    CUSTOMER ||--o{ ORDER : places',
        '    ORDER ||--|{ LINE-ITEM : contains',
        '    CUSTOMER {',
        '        string name',
        '        int id',
        '    }',
    ].join('\n'),

    'gantt chart': [
        'gantt',
        '    title A Gantt Chart',
        '    dateFormat YYYY-MM-DD',
        '    section Section',
        '    Task A :a1, 2024-01-01, 30d',
        '    Task B :after a1, 20d',
    ].join('\n'),

    'git graph': [
        'gitGraph',
        '    commit',
        '    branch develop',
        '    checkout develop',
        '    commit',
        '    checkout main',
        '    merge develop',
        '    commit',
    ].join('\n'),

    'timeline': [
        'timeline',
        '    title Timeline of Events',
        '    2020 : Event A',
        '    2021 : Event B',
        '    2022 : Event C',
    ].join('\n'),

    'mindmap': [
        'mindmap',
        '    root((Central Idea))',
        '        Branch A',
        '            Leaf 1',
        '            Leaf 2',
        '        Branch B',
        '            Leaf 3',
    ].join('\n'),

    'quadrant chart': [
        'quadrantChart',
        '    title Reach and engagement',
        '    x-axis Low Reach --> High Reach',
        '    y-axis Low Engagement --> High Engagement',
        '    quadrant-1 We should expand',
        '    quadrant-2 Need to promote',
        '    quadrant-3 Re-evaluate',
        '    quadrant-4 May be improved',
        '    Campaign A: [0.3, 0.6]',
        '    Campaign B: [0.45, 0.23]',
    ].join('\n'),
};

describe('Diagram type extraction', () => {
    for (const [typeName, diagramCode] of Object.entries(DIAGRAM_SAMPLES)) {
        test(`extracts ${typeName} from markdown`, () => {
            const md = `# ${typeName}\n\nSome text.\n\n\`\`\`mermaid\n${diagramCode}\n\`\`\`\n\nMore text.\n`;
            const blocks = extractMermaidBlocks(md);

            assert.equal(blocks.length, 1, `should find exactly 1 mermaid block for ${typeName}`);
            assert.equal(blocks[0], diagramCode, `extracted code should match the ${typeName} input`);
        });
    }

    test('extracts multiple different diagram types from a single document', () => {
        const entries = Object.entries(DIAGRAM_SAMPLES);
        const md = entries
            .map(([name, code]) => `## ${name}\n\n\`\`\`mermaid\n${code}\n\`\`\`\n`)
            .join('\n');

        const blocks = extractMermaidBlocks(md);
        assert.equal(blocks.length, entries.length, `should find ${entries.length} mermaid blocks`);

        for (let i = 0; i < entries.length; i++) {
            assert.equal(blocks[i], entries[i][1], `block ${i} should match ${entries[i][0]}`);
        }
    });

    test('does not extract non-mermaid fenced code blocks', () => {
        const md = [
            '# Code Examples',
            '',
            '```javascript',
            'console.log("hello");',
            '```',
            '',
            '```python',
            'print("hello")',
            '```',
            '',
            '```',
            'plain code block',
            '```',
        ].join('\n');

        const blocks = extractMermaidBlocks(md);
        assert.equal(blocks.length, 0, 'should not match non-mermaid blocks');
    });

    test('handles Windows-style line endings (CRLF) in mermaid blocks', () => {
        const code = 'flowchart LR\r\n    A --> B';
        const md = '```mermaid\r\n' + code + '\r\n```\r\n';
        const blocks = extractMermaidBlocks(md);

        assert.equal(blocks.length, 1, 'should extract block with CRLF endings');
        assert.ok(blocks[0].includes('flowchart'), 'extracted block should contain the diagram');
    });

    test('handles empty mermaid block', () => {
        const md = '```mermaid\n\n```\n';
        const blocks = extractMermaidBlocks(md);
        assert.equal(blocks.length, 1, 'should extract the empty block');
        assert.equal(blocks[0], '', 'extracted block should be empty string after trim');
    });
});
