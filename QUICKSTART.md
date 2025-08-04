# Quick Start Guide

## Installation

1. Clone this repository or download the source code
2. Open the project in VSCode
3. Install dependencies:
   ```bash
   npm install
   ```
4. Compile the extension:
   ```bash
   npm run compile
   ```

## Testing the Extension

1. Press `F5` in VSCode to launch a new Extension Development Host window
2. In the new window, open the `sample.md` file included in the project
3. Right-click on the file in the editor or explorer
4. Select "Convert Markdown to PDF with Mermaid"
5. Wait for the conversion to complete
6. The PDF will be created in the same directory as the Markdown file

## Building for Distribution

To create a VSIX package for distribution:

1. Install vsce (Visual Studio Code Extension manager):
   ```bash
   npm install -g @vscode/vsce
   ```
2. Package the extension:
   ```bash
   vsce package
   ```
3. This will create a `.vsix` file that can be installed in VSCode

## Installing the VSIX

1. In VSCode, open the Command Palette (Ctrl/Cmd + Shift + P)
2. Type "Extensions: Install from VSIX..."
3. Select the `.vsix` file you created
4. Reload VSCode when prompted

## Troubleshooting

- **Puppeteer issues**: Make sure you have the necessary system dependencies for Puppeteer. On some systems, you may need to install additional libraries.
- **Permission errors**: Ensure the extension has permission to write files in the target directory.
- **Large diagrams**: Very complex Mermaid diagrams may take longer to render. Be patient!