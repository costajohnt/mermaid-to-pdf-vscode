# Changelog

All notable changes to Markdown Mermaid Converter will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-10

First npm release since 1.0.3 (2025-08-06); it also contains everything listed
under 1.0.0 below, which was never published. The MCP server package
(`markdown-mermaid-converter-mcp`) moves to 3.0.0 for the same Node.js change.

### Breaking

- Requires Node.js 22.12 or later (Puppeteer 25). Node.js 18 and 20 are no
  longer supported.

### Added

- Output formats: HTML (#68) and DOCX (#70)
- Page numbers, custom CSS, font selection (#68)
- `.mermaidrc` config file support, MCP diagram caching, `validate_markdown`
  MCP tool (#69)
- Batch processing, watch mode, KaTeX math, accessibility improvements (#70)
- Image embedding, Mermaid config, page breaks, PDF metadata, progress
  logging (#78)

### Changed

- Browser consolidation and concurrent diagram rendering (#63)
- Upgraded Puppeteer to 25, Mermaid to 11.17, KaTeX to 0.18 and the MCP SDK
  to 1.32 to clear high-severity advisories

### Fixed

- Security hardening (#62)
- The installed `markdown-mermaid-converter` bin did nothing when run through
  npm's `node_modules/.bin` symlink
- Package installs no longer fail: the dev-only `postinstall` vendoring step is
  now `prebuild`
- Published package now includes type declarations and no longer ships
  development files
- The MCP server package installs from npm: it now depends on
  `markdown-mermaid-converter-cli` instead of importing `../../dist` from the
  repo checkout, and the release workflow publishes it after the CLI

## [1.0.0] - 2026-02-24

### Changed

- SVG-first rendering pipeline with measured layout and width-first scaling
- Vendored mermaid.min.js locally (no CDN dependency)

### Added

- stdin support for CLI
- MCP server as separate package (`mermaid-to-pdf-mcp/`)

### Improved

- Performance optimizations (browser pooling, diagram caching)
- Dynamic diagram sizing with minimum scale floor (0.6)

## [0.1.0] - 2025-08-04

### Changed

- Converted from VSCode extension to standalone CLI tool

### Added

- Core library extraction for programmatic use
- CI/CD workflows with GitHub Actions
- Comprehensive test suite

### Removed

- VSCode extension dependencies

## [0.0.1] - 2025-08-03

### Added

- Initial release as VSCode extension
- Convert Markdown files with Mermaid diagrams to PDF
- Automatic Mermaid diagram rendering as embedded images
- Support for all Mermaid diagram types (flowchart, sequence, class, etc.)
- High-performance rendering with Puppeteer
