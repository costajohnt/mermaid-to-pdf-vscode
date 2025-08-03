# @mermaid-converter/mcp-server

Enhanced MCP (Model Context Protocol) server for advanced Markdown + Mermaid diagram conversion with batch processing, templates, caching, and production-ready features.

## 🚀 Features

### Core Capabilities
- **Batch Processing**: Convert multiple files concurrently with error handling
- **Template System**: Pre-defined and custom templates for consistent output
- **Advanced Caching**: Memory and Redis-based caching for performance
- **Rate Limiting**: Protect against abuse with configurable limits
- **Health Monitoring**: Comprehensive health checks and metrics
- **Docker Support**: Production-ready containerization

### Enhanced Tools
- `convert_markdown_to_pdf` - Single file conversion with template support
- `convert_multiple_files` - Batch processing with concurrency control
- `create_template` / `list_templates` / `get_template` - Template management
- `extract_and_enhance_diagrams` - Advanced diagram extraction and rendering
- `validate_all_diagrams` - Comprehensive diagram validation
- `get_health_status` - System health and performance metrics
- `get_cache_stats` / `clear_cache` - Cache management

## 📦 Installation

### Using npm
```bash
npm install @mermaid-converter/mcp-server
```

### Using Docker
```bash
# Clone the repository
git clone <repo-url>
cd packages/mcp-server

# Build and run with Docker Compose
docker-compose up -d
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Basic Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Cache Configuration
CACHE_ENABLED=true
CACHE_BACKEND=redis  # 'memory' or 'redis'
REDIS_HOST=localhost
REDIS_PORT=6379

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# Authentication (optional)
AUTH_ENABLED=true
API_KEY=your-secret-key
```

### Cache Backends

#### Memory Cache (Default)
- Fast, in-memory storage
- Suitable for single-instance deployments
- Automatic LRU eviction

#### Redis Cache
- Persistent, distributed caching
- Suitable for production and multi-instance deployments
- Requires Redis server

## 🎯 Usage

### As MCP Server
```bash
# Start the server in MCP mode (stdio transport)
npx @mermaid-converter/mcp-server

# Or run the built version
node dist/index.js
```

### Built-in Templates

The server comes with several built-in templates:

#### `pdf-report`
Professional report template with cover page formatting
```json
{
  "quality": "high",
  "pageSize": "A4",
  "margins": { "top": "25mm", "right": "20mm", "bottom": "25mm", "left": "20mm" }
}
```

#### `pdf-presentation` 
Landscape format optimized for presentations
```json
{
  "quality": "high",
  "pageSize": "A4",
  "landscape": true,
  "margins": { "top": "15mm", "right": "15mm", "bottom": "15mm", "left": "15mm" }
}
```

#### `documentation`
Standard technical documentation template
```json
{
  "quality": "standard",
  "theme": "light",
  "pageSize": "A4"
}
```

#### `dark-theme`
Dark theme template for code-heavy documents
```json
{
  "quality": "standard",
  "theme": "dark",
  "pageSize": "A4"
}
```

## 🔨 Tool Examples

### Single File Conversion
```javascript
{
  "tool": "convert_markdown_to_pdf",
  "arguments": {
    "markdown": "# My Document\n\n```mermaid\ngraph TD\n  A --> B\n```",
    "options": {
      "template": "pdf-report",
      "title": "My Report"
    }
  }
}
```

### Batch Processing
```javascript
{
  "tool": "convert_multiple_files",
  "arguments": {
    "files": [
      {
        "content": "# Doc 1\n\n```mermaid\ngraph TD\n  A --> B\n```",
        "format": "pdf",
        "metadata": { "filename": "doc1.md" }
      },
      {
        "content": "# Doc 2\n\n```mermaid\nsequenceDiagram\n  A->>B: Hello\n```",
        "format": "pdf", 
        "metadata": { "filename": "doc2.md" }
      }
    ],
    "options": {
      "concurrency": 2,
      "continueOnError": true,
      "template": "documentation"
    }
  }
}
```

### Template Management
```javascript
// Create custom template
{
  "tool": "create_template",
  "arguments": {
    "name": "My Custom Template",
    "description": "Custom template with specific formatting",
    "format": "pdf",
    "options": {
      "quality": "high",
      "theme": "light",
      "pageSize": "Letter",
      "margins": { "top": "30mm", "bottom": "30mm" }
    }
  }
}

// List all templates
{
  "tool": "list_templates",
  "arguments": {}
}
```

### Health Monitoring
```javascript
{
  "tool": "get_health_status",
  "arguments": {}
}
```

## 🐳 Docker Deployment

### Basic Deployment
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f mcp-server

# Stop
docker-compose down
```

### Production Deployment with Monitoring
```bash
# Start with Prometheus and Grafana
docker-compose --profile monitoring up -d

# Access Grafana dashboard
open http://localhost:3001  # admin/admin
```

### Environment-specific Configurations

#### Development
```yaml
# docker-compose.override.yml
version: '3.8'
services:
  mcp-server:
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - CACHE_BACKEND=memory
    volumes:
      - ./src:/app/src
    command: npm run dev
```

#### Production
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  mcp-server:
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn
      - CACHE_BACKEND=redis
      - AUTH_ENABLED=true
      - RATE_LIMIT_ENABLED=true
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
```

## 📊 Monitoring

### Health Checks
- Server health status
- Service availability (converter, cache, browser)
- Performance metrics (success rate, processing time)
- Cache statistics (hit rate, size)

### Metrics Endpoints
- `/metrics` - Prometheus metrics (when monitoring enabled)
- Health check via `get_health_status` tool
- Cache statistics via `get_cache_stats` tool

### Logging
- Structured JSON logging with Pino
- Configurable log levels
- Request/response logging
- Error tracking with stack traces

## 🔧 Development

### Setup
```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode with watch
npm run dev

# Run tests
npm test

# Lint
npm run lint
```

### Architecture

```
src/
├── index.ts              # Main MCP server
├── config.ts             # Configuration management
├── types.ts              # TypeScript definitions
└── services/
    ├── batch.ts          # Batch processing service
    ├── cache.ts          # Caching service (Memory/Redis)
    └── templates.ts      # Template management service
```

## 🚨 Security

### Authentication
- Optional API key authentication
- JWT token support for stateless auth
- Rate limiting per IP/key

### Input Validation
- Comprehensive input validation
- XSS protection
- Path traversal prevention
- Size limits on inputs

### Docker Security
- Non-root user execution
- Minimal base image
- Security scanning

## 📈 Performance

### Caching Strategy
- Content-based cache keys
- Configurable TTL
- LRU eviction for memory cache
- Redis persistence for distributed caching

### Batch Processing
- Configurable concurrency (1-10)
- Error isolation (continue on error)
- Progress tracking
- Resource management

### Browser Pool Management
- Reusable browser instances
- Automatic cleanup
- Connection pooling
- Memory optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details