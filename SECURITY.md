# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | Yes                |
| < 1.0   | No                 |

## Reporting a Vulnerability

**Please do not open public issues for security vulnerabilities.**

Instead, use [GitHub Security Advisories](https://github.com/costajohnt/markdown-mermaid-converter/security/advisories/new) to report vulnerabilities privately. You will receive a response within 7 days acknowledging the report, and we will work with you to understand and address the issue before any public disclosure.

## Security Considerations

This project launches headless Chromium processes and processes user-provided input. The following measures are in place:

### Puppeteer / Chromium Sandboxing

- Chromium runs with default sandbox protections enabled in production.
- The `--no-sandbox` flag is **only** added when running in CI environments or as root (common in Docker), where the kernel sandbox is unavailable. See `getBrowserArgs()` in `src/types.ts`.
- `--disable-dev-shm-usage` is always set to prevent shared memory issues in constrained environments.

### Mermaid Rendering

- Mermaid is initialized with `securityLevel: 'strict'`, which disables click events and sanitizes HTML output within diagrams.
- Mermaid is bundled locally (`src/vendor/mermaid.min.js`) rather than loaded from a CDN, eliminating supply-chain risks at runtime.

### Input Validation and Size Limits

- Markdown input is limited to **10 MB**.
- Individual Mermaid diagram code blocks are limited to **50 KB**.
- These limits prevent memory exhaustion and excessive rendering times.

### File System Access

- The CLI reads the input file specified by the user and writes the output PDF to the specified path.
- The MCP server (`mermaid-to-pdf-mcp/`) reads and writes files as directed by the calling application. It does not expose a network server or accept arbitrary file paths beyond what the MCP protocol provides.

## Scope

The following **are** considered security vulnerabilities:

- Remote code execution via crafted Markdown or Mermaid input
- Sandbox escape from the Chromium rendering process
- Path traversal allowing reads/writes outside intended directories
- Denial of service that bypasses the existing size limits

The following are **not** in scope:

- Vulnerabilities in Chromium itself (report those to the [Chromium project](https://www.chromium.org/Home/chromium-security/reporting-security-bugs/))
- Issues requiring local access to the machine where the tool is already running with user privileges
- Resource usage within the documented size limits

## Dependencies

We monitor dependencies for known vulnerabilities via `npm audit`. If you discover a vulnerability in a dependency that affects this project, please report it using the process described above.
