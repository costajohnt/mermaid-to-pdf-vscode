# SVG-First Rendering Redesign

**Date:** 2026-02-24
**Status:** Approved

## Problem

The current rendering pipeline converts Mermaid diagrams to PNG screenshots and embeds them as base64 data URIs in HTML before converting to PDF. This causes:

- Diagrams are often too small or have excessive whitespace
- Fixed `max-height: 400px` constraint doesn't adapt to diagram complexity
- PNG rasterization loses quality at different zoom levels
- Sizing is guessed upfront rather than measured after rendering
- CDN dependency on mermaid.js (fragile, no offline support)
- MCP server has a duplicate, divergent rendering pipeline

## Solution

Switch to SVG-based rendering with post-render measurement and width-first scaling.

## Architecture

### Pipeline

```
For each mermaid code block:
  1. Render in Puppeteer page with mermaid.run()
  2. Extract SVG string via page.evaluate() (outerHTML)
  3. Measure actual dimensions via getBBox()
  4. Apply width-first scaling (fit to page width, never upscale)
  5. Set viewBox + width/height attributes on SVG
  6. Cache SVG string + dimensions

Then:
  7. Replace mermaid blocks in markdown with sized SVG divs
  8. Convert markdown to HTML with marked
  9. Wrap in HTML document with print-optimized CSS
  10. page.pdf() on the complete document
```

### Sizing Algorithm

```
Given: svgWidth, svgHeight (from getBBox)
Given: pageContentWidth (page width minus margins)
Given: pageContentHeight (page height minus margins)
Given: MIN_SCALE = 0.6

1. widthScale = pageContentWidth / svgWidth (capped at 1.0, no upscaling)
2. displayWidth = svgWidth * widthScale
3. displayHeight = svgHeight * widthScale
4. If widthScale < MIN_SCALE: use MIN_SCALE instead (readability floor)
5. If displayHeight <= pageContentHeight: page-break-inside: avoid
6. If displayHeight > pageContentHeight: page-break-inside: auto (allow overflow)
```

Horizontal overflow is unacceptable in PDF. Vertical overflow is fine — that's how printed documents work.

### Module Structure

| Module | Role |
|--------|------|
| `src/cli.ts` | CLI entry point, arg parsing, stdin support |
| `src/converter.ts` | Main converter: orchestrates parse → render → assemble → PDF |
| `src/mermaidRenderer.ts` | Renders mermaid → SVG string + dimensions |
| `src/browserPool.ts` | Puppeteer browser pool (unchanged) |
| `src/diagramCache.ts` | Caches SVG strings + dimensions |
| `src/types.ts` | Shared TypeScript interfaces |

### MCP Server

Thin wrapper that calls the CLI. The duplicate rendering pipeline, DiagramAnalyzer, and browser fallback are removed.

### Key Decisions

- **SVG not PNG**: Vector graphics scale perfectly in PDF, no resolution trade-offs
- **Measure after render**: getBBox() gives exact dimensions, eliminates whitespace
- **useMaxWidth: false**: Prevents Mermaid from expanding diagrams to fill container
- **Bundle mermaid.js**: Pin version locally, no CDN dependency, works offline
- **Remove scale: 0.9**: No artificial shrinking of the entire document
- **Remove quality option**: SVG is resolution-independent, quality setting is meaningless
- **Remove engine option**: pdfkit was never implemented, dead code
- **Add stdin support**: LLMs and scripts can pipe markdown content directly

### Error Handling

- Per-diagram error isolation: failed diagram shows error box, rest of document continues
- Puppeteer launch failure: clear error about Chrome/Chromium availability
- No mermaid diagrams: still produces PDF (plain markdown-to-PDF)

### What Gets Removed

- `finalConverter.ts` (replaced by `converter.ts`)
- MCP `diagramAnalyzer.ts` (measurement replaces estimation)
- MCP duplicate rendering pipeline
- `max-height: 400px` image constraint
- `deviceScaleFactor`-based quality scaling
- CDN mermaid.js loading
- `scale: 0.9` in PDF generation
- `preferCSSPageSize: true`
- 1000ms arbitrary sleep after setContent
