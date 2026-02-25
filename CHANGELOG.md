# Changelog

All notable changes to Markdown Mermaid Converter will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
