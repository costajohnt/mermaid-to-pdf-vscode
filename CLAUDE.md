# Claude Settings for Markdown Mermaid Converter

## Developer Information
- **GitHub Username**: costajohnt
- **Repository**: https://github.com/costajohnt/markdown-mermaid-converter
- **Main Branch**: main

## Project Context
This is a CLI tool and MCP server that converts Markdown files with Mermaid diagrams to various formats (PDF, etc.). The tools use Puppeteer for rendering and include performance optimizations like browser pooling and diagram caching.

## Development Preferences
- **Node.js Version**: 20.x for CLI, 18.x+ for MCP server
- **Test Strategy**: Basic unit tests for core functionality
- **CI/CD**: GitHub Actions with Ubuntu runners
- **Code Style**: ESLint with TypeScript strict mode

## Common Commands
- `npm run build` - Build TypeScript for both CLI and MCP server
- `npm run compile` - Build TypeScript (alias)
- `npm test` - Run tests

## GitHub Integration
- Pull requests should target the main branch
- CI/CD runs on Node.js 20.x
- Extension packaging requires successful build + tests
- **No Co-Author**: Do not add "Co-Authored-By: Claude" to commit messages or releases