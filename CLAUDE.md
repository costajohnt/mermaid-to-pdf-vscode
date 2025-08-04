# Claude Settings for Mermaid to PDF VSCode Extension

## Developer Information
- **GitHub Username**: costajohnt
- **Repository**: https://github.com/costajohnt/mermaid-to-pdf-vscode
- **Main Branch**: main
- **Feature Branch**: feature/improvements-phase1

## Project Context
This is a VSCode extension that converts Markdown files with Mermaid diagrams to PDF format. The extension uses Puppeteer for rendering and includes performance optimizations like browser pooling and diagram caching.

## Development Preferences
- **Node.js Version**: 20.x (required for vsce compatibility)
- **Test Strategy**: Basic unit tests + VSCode integration tests
- **CI/CD**: GitHub Actions with Ubuntu runners
- **Code Style**: ESLint with TypeScript strict mode

## Common Commands
- `npm run compile` - Build TypeScript
- `npm run test:simple` - Run basic tests
- `npm run test:vscode` - Run VSCode integration tests
- `npx @vscode/vsce package` - Package extension

## GitHub Integration
- Pull requests should target the main branch
- CI/CD runs on Node.js 20.x
- Extension packaging requires successful build + tests
- **No Co-Author**: Do not add "Co-Authored-By: Claude" to commit messages or releases