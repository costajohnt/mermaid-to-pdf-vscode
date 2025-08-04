# mermaid-converter-cli

> A powerful command-line tool for converting Markdown documents with Mermaid diagrams to various formats including PDF and Google Slides

## Installation

```bash
npm install -g mermaid-converter-cli
```

## Quick Start

```bash
# Convert a single file
mermaid-convert document.md

# Convert with a specific template
mermaid-convert document.md -t report -o professional-report.pdf

# Convert multiple files
mermaid-convert docs/*.md --batch -d output/

# Watch for changes
mermaid-convert watch docs/
```

## Features

- 📄 **PDF Generation** - High-quality PDF output with embedded Mermaid diagrams
- 🎯 **Google Slides Integration** - Convert markdown to presentations with smart slide mapping
- 📊 **Batch Processing** - Convert multiple files concurrently with progress tracking
- 👁️ **Watch Mode** - Auto-convert files when they change
- 🎨 **6 Built-in Templates** - Professional designs for different use cases
- ⚙️ **Configurable** - Project-level configuration with multiple format support
- 🚀 **Fast & Efficient** - Browser pooling and intelligent caching

## Commands

### `convert` - Convert Markdown files

Convert one or more Markdown files to PDF (or other formats).

```bash
mermaid-convert convert input.md [options]
```

**Options:**
- `-f, --format <format>` - Output format: pdf, google-slides (default: pdf)
- `-o, --output <file>` - Output file (single file mode)
- `-d, --output-dir <dir>` - Output directory (batch mode)
- `-t, --template <name>` - Template to use (default: default)
- `-b, --batch` - Enable batch processing for multiple files
- `-c, --concurrency <n>` - Number of concurrent conversions (default: 3)
- `--overwrite` - Overwrite existing files
- `--google-auth <path>` - Path to Google service account JSON file (for Google Slides)
- `--verbose` - Show detailed logs

**Examples:**
```bash
# Basic conversion
mermaid-convert convert README.md

# Use specific template and output location
mermaid-convert convert docs/guide.md -t presentation -o slides.pdf

# Batch convert with custom settings
mermaid-convert convert docs/*.md --batch -d output -t report -c 5

# Convert multiple files with glob pattern
mermaid-convert convert "src/**/*.md" --batch -d dist/

# Convert to Google Slides
mermaid-convert convert presentation.md -f google-slides

# Google Slides with custom theme
mermaid-convert convert slides.md -f google-slides --template '{"theme": "modern"}'
```

### `watch` - Monitor files for changes

Watch Markdown files and automatically convert them when they change.

```bash
mermaid-convert watch <path> [options]
```

**Options:**
- `-f, --format <format>` - Output format (default: pdf)
- `-d, --output-dir <dir>` - Output directory (default: current)
- `-t, --template <name>` - Template to use (default: default)
- `-i, --ignore <pattern>` - Ignore pattern (default: node_modules/**)
- `--debounce <ms>` - Debounce delay in milliseconds (default: 300)

**Examples:**
```bash
# Watch current directory
mermaid-convert watch .

# Watch specific directory with custom template
mermaid-convert watch docs/ -t documentation -d output/

# Watch with custom ignore patterns
mermaid-convert watch . -i "*.tmp,node_modules/**,dist/**"
```

### `templates` - Manage templates

List and inspect available conversion templates.

```bash
mermaid-convert templates [options]
```

**Options:**
- `-l, --list` - List all available templates (default)
- `-s, --show <name>` - Show details for a specific template
- `-i, --interactive` - Interactive template selection

**Examples:**
```bash
# List all templates
mermaid-convert templates

# Show template details
mermaid-convert templates --show report

# Interactive template browser
mermaid-convert templates --interactive
```

### `config` - Configuration management

Create and manage CLI configuration files.

```bash
mermaid-convert config [options]
```

**Options:**
- `-i, --init` - Create a new configuration file
- `-s, --show` - Show current configuration
- `-p, --path` - Show configuration file path

**Examples:**
```bash
# Create configuration file
mermaid-convert config --init

# Show current config
mermaid-convert config --show
```

## Google Slides Setup

To use Google Slides integration:

1. **Create a Google Cloud project**
2. **Enable Google Slides and Drive APIs**
3. **Create a service account with credentials**
4. **Download the JSON key file**
5. Either:
   - Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
   - Use `--google-auth` flag with path to JSON file

For detailed instructions, see the [Google Slides Authentication Guide](https://github.com/costajohnt/mermaid-to-pdf-vscode/blob/main/docs/GOOGLE_SLIDES_AUTH.md).

## Templates

The CLI comes with 6 built-in templates:

| Template | Description | Use Case |
|----------|-------------|----------|
| `default` | Standard PDF with professional formatting | General documents |
| `report` | High-quality with generous margins | Business reports |
| `presentation` | Landscape format for slides | Presentations |
| `documentation` | Optimized for technical docs | API docs, guides |
| `dark` | Dark theme for code/diagrams | Developer documentation |
| `compact` | Minimal margins for maximum content | Reference materials |

### Template Options

Each template includes settings for:
- **Quality**: draft, standard, high
- **Theme**: light, dark
- **Page Size**: A4, Letter, Legal
- **Margins**: Customizable spacing
- **Orientation**: Portrait or landscape

## Configuration

Create a `.mermaid-convertrc.json` file in your project root:

```json
{
  "defaultFormat": "pdf",
  "defaultTemplate": "documentation",
  "outputDirectory": "./dist",
  "overwrite": false,
  "concurrency": 3,
  "templates": {
    "custom": {
      "description": "My custom template",
      "options": {
        "quality": "high",
        "theme": "light",
        "margins": {
          "top": "30mm",
          "bottom": "30mm"
        }
      }
    }
  }
}
```

## Examples

### Basic Usage

```bash
# Convert single file
mermaid-convert convert documentation.md

# Use professional template
mermaid-convert convert report.md -t report
```

### Batch Processing

```bash
# Convert all markdown files in docs/
mermaid-convert convert docs/*.md --batch -d output/

# Process with 5 concurrent conversions
mermaid-convert convert docs/**/*.md --batch -c 5
```

### Development Workflow

```bash
# Watch for changes during development
mermaid-convert watch docs/ -t documentation -d dist/

# Convert on save with custom debounce
mermaid-convert watch . --debounce 1000
```

### Advanced Usage

```bash
# Custom output location and template
mermaid-convert convert api.md -t presentation -o slides/api-overview.pdf

# Batch with overwrite enabled
mermaid-convert convert docs/*.md --batch --overwrite -d output/
```

## Global Options

Available for all commands:

- `-q, --quiet` - Suppress non-error output
- `-v, --verbose` - Enable verbose logging
- `--no-color` - Disable colored output

## Output

### Success Messages
- ✅ File conversion progress and results
- 📊 Processing statistics (file size, duration)
- 📁 Output file locations

### Error Handling
- ❌ Clear error messages with suggestions
- 🐛 Verbose mode for debugging
- 📝 Automatic error logging to files

## Troubleshooting

### Common Issues

**"No files found"**
- Check your glob pattern syntax
- Ensure Markdown files have `.md` extension
- Use absolute paths if relative paths aren't working

**"Diagram render failed"**
- Verify Mermaid syntax is valid
- Check for special characters in diagrams
- Try with `--verbose` for detailed error information

**"Permission denied"**
- Ensure write permissions for output directory
- Use `--overwrite` to replace existing files

### Debug Mode

```bash
# Enable verbose logging
mermaid-convert convert file.md --verbose

# Check log files
cat mermaid-convert.log
cat mermaid-convert-error.log
```

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Related Packages

- `mermaid-converter-core` - Core conversion library
- `mermaid-converter-mcp-server` - MCP server for Claude Desktop integration