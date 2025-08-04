# Enhanced MCP Server - Testing Guide

This guide explains how to test your Enhanced MCP Server to ensure it's working correctly and is ready for deployment.

## Quick Start

```bash
# Build the server first
npm run build

# Run all tests
npm run test:all
```

## Available Test Suites

### 1. Basic Tests (`npm run test:basic`)
- **Purpose**: Verify core server functionality and startup
- **Duration**: ~30 seconds
- **What it tests**:
  - Server build verification
  - Template system (4 built-in templates)
  - Health monitoring setup
  - Batch processing capability
  - Server startup and shutdown

**Sample Output**:
```
🚀 Enhanced MCP Server - Basic Test Suite

✅ Server build found
📋 Available templates: pdf-report, pdf-presentation, documentation, dark-theme
📊 Health monitoring ready
📦 Batch processing ready
✅ Server started successfully!
```

### 2. Integration Tests (`npm run test:integration`)
- **Purpose**: Test MCP protocol communication
- **Duration**: ~60 seconds
- **What it tests**:
  - MCP tool registration (10 tools)
  - Template listing and management
  - Health status reporting
  - Cache statistics
  - Single file conversion
  - Batch processing workflow

**Sample Output**:
```
🧪 Enhanced MCP Server - Integration Test Suite

✅ Found 10 tools
✅ Template system: 4 built-in templates
🏥 Health status: healthy
📊 Cache statistics available
✅ Single conversion successful
📦 Batch processing: 3 files processed
```

### 3. Performance Tests (`npm run test:performance`)
- **Purpose**: Benchmark server performance under load
- **Duration**: ~2-5 minutes
- **What it tests**:
  - Light load (3 files, 1 concurrent)
  - Medium load (5 files, 2 concurrent)
  - Heavy load (10 files, 3 concurrent)
  - Response times and throughput
  - Memory usage patterns
  - Cache hit rates

**Sample Output**:
```
📊 Light Load Results:
   • Average duration: 854ms
   • Throughput: 2.34 docs/sec
   • Success rate: 95.0%
   • Cache hit rate: 30.0%
```

### 4. Docker Tests (`npm run test:docker`)
- **Purpose**: Verify containerized deployment
- **Duration**: ~3-10 minutes (depending on Docker setup)
- **What it tests**:
  - Docker availability
  - Image building
  - Container startup and health
  - Resource usage monitoring
  - Docker Compose functionality

**Sample Output**:
```
🐳 Enhanced MCP Server - Docker Deployment Test Suite

✅ Docker is available
🔨 Building Docker image...
✅ Docker image built successfully
🚀 Container started and healthy
📊 CPU Usage: 2.1%, Memory: 128MB / 512MB
```

### 5. Comprehensive Test Suite (`npm run test:all`)
- **Purpose**: Run all tests with detailed reporting
- **Duration**: ~5-15 minutes
- **What it includes**:
  - All individual test suites
  - Prerequisites checking
  - Comprehensive reporting
  - Performance analysis
  - Recommendations

## Test Results and Reports

### Success Indicators
- ✅ **All tests passed**: Ready for production deployment
- ⚠️ **Some tests failed**: Review specific failures, may still be usable
- ❌ **Many tests failed**: Significant issues, requires debugging

### Generated Reports
- **Console output**: Real-time test progress and results
- **test-report.json**: Detailed JSON report with timing and error details
- **Performance metrics**: Throughput, response times, resource usage

### Common Test Failures and Solutions

#### "Server not built"
```bash
npm run build
```

#### "Docker tests failed"
- Install Docker Desktop
- Ensure Docker is running
- Check Dockerfile exists

#### "Integration tests timeout"
- Server may be slow to start
- Check for port conflicts (port 3000)
- Verify dependencies are installed

#### "Performance tests show poor results"
- Normal for first runs (cold start)
- Check available system resources
- Consider adjusting test parameters

## Testing in Different Environments

### Development Environment
```bash
# Quick verification
npm run test:basic

# Full functionality test
npm run test:integration
```

### CI/CD Pipeline
```bash
# Skip Docker tests in CI if Docker not available
npm run test:all -- --skip docker
```

### Production Readiness
```bash
# Full test suite including Docker
npm run test:all

# Performance benchmarking
npm run test:performance
```

## Interpreting Results

### Performance Benchmarks
- **Excellent**: >2 docs/sec throughput, <1000ms avg response
- **Good**: 1-2 docs/sec throughput, 1000-2000ms avg response  
- **Needs optimization**: <1 docs/sec throughput, >2000ms avg response

### Memory Usage
- **Efficient**: <200MB peak usage
- **Acceptable**: 200-500MB peak usage
- **High**: >500MB peak usage (investigate memory leaks)

### Success Rates
- **Production Ready**: >95% success rate
- **Acceptable**: 90-95% success rate
- **Needs Work**: <90% success rate

## Troubleshooting

### Server Won't Start
1. Check TypeScript compilation: `npm run build`
2. Verify dependencies: `npm install`
3. Check port availability: `lsof -i :3000`

### Tests Hang or Timeout
1. Kill existing processes: `pkill -f "node.*mcp-server"`
2. Clear Node.js cache: `rm -rf node_modules/.cache`
3. Restart with clean environment

### Docker Issues
1. Check Docker is running: `docker --version`
2. Clean Docker cache: `docker system prune`
3. Rebuild image: `npm run docker:build`

## Advanced Testing

### Custom Test Parameters
```bash
# Run specific performance test
node test-performance.cjs

# Run integration tests with custom timeout
TIMEOUT=60000 npm run test:integration

# Skip Docker tests
npm run test:all -- --skip docker
```

### Manual MCP Testing
```bash
# Start server manually
npm start

# In another terminal, test with MCP client
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | nc localhost 3000
```

### Load Testing
For production load testing, consider using tools like:
- **Apache Bench**: `ab -n 100 -c 10 http://localhost:3000/health`
- **Artillery**: For more sophisticated load testing
- **k6**: For API performance testing

## Continuous Integration

### GitHub Actions Example
```yaml
- name: Test MCP Server
  run: |
    cd packages/mcp-server
    npm install
    npm run build
    npm run test:all -- --skip docker
```

### Local Pre-commit Hook
```bash
#!/bin/sh
cd packages/mcp-server && npm run test:basic
```

## Next Steps After Testing

1. **All tests pass**: Deploy with Docker Compose
2. **Performance issues**: Optimize bottlenecks identified in tests
3. **Integration issues**: Debug MCP protocol implementation
4. **Docker issues**: Review containerization setup

## Support

If tests consistently fail:
1. Check this guide for common solutions
2. Review error messages and test output
3. Ensure system requirements are met
4. Consider environment-specific issues

Happy testing! 🧪✨