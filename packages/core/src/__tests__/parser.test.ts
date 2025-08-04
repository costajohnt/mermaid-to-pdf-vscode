/**
 * Tests for MarkdownParser
 */

import { MarkdownParser } from '../parser';

describe('MarkdownParser', () => {
  let parser: MarkdownParser;

  beforeEach(() => {
    parser = new MarkdownParser();
  });

  describe('parse', () => {
    it('should parse simple markdown', async () => {
      const content = `# Test Document

This is a paragraph.

## Section 2

Another paragraph.`;

      const result = await parser.parse(content);

      expect(result.title).toBe('Test Document');
      expect(result.sections).toHaveLength(4);
      expect(result.sections[0]?.type).toBe('heading');
      expect(result.sections[0]?.level).toBe(1);
      expect(result.sections[0]?.content).toBe('Test Document');
    });

    it('should extract mermaid diagrams', async () => {
      const content = `# Test Document

\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

Some text after diagram.`;

      const result = await parser.parse(content);

      expect(result.diagrams).toHaveLength(1);
      expect(result.diagrams[0]?.type).toBe('mermaid');
      expect(result.diagrams[0]?.code).toContain('graph TD');
      expect(result.diagrams[0]?.id).toBe('diagram_1');
    });

    it('should handle empty content', async () => {
      const result = await parser.parse('');

      expect(result.title).toBe('Untitled Document');
      expect(result.sections).toHaveLength(0);
      expect(result.diagrams).toHaveLength(0);
    });

    it('should parse frontmatter', async () => {
      const content = `---
title: Custom Title
author: John Doe
tags: test, markdown
---

# Content

This is content.`;

      const result = await parser.parse(content);

      expect(result.metadata.title).toBe('Custom Title');
      expect(result.metadata.author).toBe('John Doe');
      expect(result.metadata.tags).toEqual(['test', 'markdown']);
    });
  });
});