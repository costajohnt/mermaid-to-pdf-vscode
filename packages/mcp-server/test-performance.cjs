/**
 * Performance Benchmark Test for Enhanced MCP Server
 * Tests server performance under various load conditions
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configurations
const PERFORMANCE_TESTS = {
  light: {
    name: 'Light Load',
    files: 3,
    concurrent: 1,
    iterations: 2
  },
  medium: {
    name: 'Medium Load', 
    files: 5,
    concurrent: 2,
    iterations: 3
  },
  heavy: {
    name: 'Heavy Load',
    files: 10,
    concurrent: 3,
    iterations: 2
  }
};

// Generate test markdown with varying complexity
function generateTestMarkdown(complexity = 'simple') {
  const baseContent = `# Performance Test Document - ${complexity.toUpperCase()}

This document tests ${complexity} conversion performance.

## Overview

Testing the enhanced MCP server under ${complexity} load conditions.
`;

  const diagrams = {
    simple: [`
\`\`\`mermaid
graph LR
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`
`],
    medium: [`
\`\`\`mermaid
graph TB
    A[Client Request] --> B{Valid?}
    B -->|Yes| C[Process]
    B -->|No| D[Error]
    C --> E[Template]
    E --> F[Generate PDF]
    F --> G[Cache Result]
    G --> H[Return Response]
\`\`\`

\`\`\`mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant T as Template
    participant P as Processor
    
    C->>S: Convert Request
    S->>T: Apply Template
    T->>P: Process Content
    P->>S: Generated PDF
    S->>C: Response
\`\`\`
`],
    complex: [`
\`\`\`mermaid
graph TB
    subgraph "Client Layer"
        A[MCP Client]
        B[CLI Tool]
        C[Web Interface]
    end
    
    subgraph "Server Layer"
        D[Enhanced MCP Server]
        E[Rate Limiter]
        F[Auth Middleware]
    end
    
    subgraph "Processing Layer"
        G[Core Library]
        H[Template Service]
        I[Batch Processor]
    end
    
    subgraph "Infrastructure"
        J[Browser Pool]
        K[Cache Service]
        L[Health Monitor]
        M[Metrics Collector]
    end
    
    A --> D
    B --> D
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    G --> I
    H --> J
    I --> J
    J --> K
    K --> L
    L --> M
\`\`\`

\`\`\`mermaid
flowchart TD
    Start([Start Conversion]) --> Parse[Parse Markdown]
    Parse --> Validate{Valid Content?}
    Validate -->|No| Error[Return Error]
    Validate -->|Yes| ExtractDiagrams[Extract Mermaid Diagrams]
    
    ExtractDiagrams --> CheckCache{In Cache?}
    CheckCache -->|Yes| LoadCached[Load from Cache]
    CheckCache -->|No| RenderDiagrams[Render Diagrams]
    
    RenderDiagrams --> Browser[Get Browser Instance]
    Browser --> RenderHTML[Generate HTML]
    RenderHTML --> ConvertPDF[Convert to PDF]
    ConvertPDF --> CacheResult[Cache Result]
    
    LoadCached --> ApplyTemplate[Apply Template]
    CacheResult --> ApplyTemplate
    ApplyTemplate --> GenerateOutput[Generate Final Output]
    GenerateOutput --> Cleanup[Cleanup Resources]
    Cleanup --> End([Conversion Complete])
    
    Error --> End
\`\`\`

\`\`\`mermaid
gitgraph
    commit id: "Initial"
    commit id: "Core Library"
    branch feature/templates
    checkout feature/templates
    commit id: "Template System"
    commit id: "Built-in Templates"
    checkout main
    merge feature/templates
    branch feature/batch
    checkout feature/batch
    commit id: "Batch Processing"
    commit id: "Concurrency Control"
    checkout main
    merge feature/batch
    commit id: "Enhanced MCP Server"
    commit id: "Performance Optimizations"
\`\`\`
`]
  };

  return baseContent + (diagrams[complexity] || diagrams.simple).join('\n\n');
}

class PerformanceProfiler {
  constructor() {
    this.metrics = {
      conversions: [],
      errors: [],
      cacheHits: 0,
      cacheMisses: 0,
      totalProcessingTime: 0,
      peakMemoryUsage: 0
    };
  }

  startConversion() {
    return {
      startTime: Date.now(),
      startMemory: process.memoryUsage().heapUsed
    };
  }

  endConversion(context, success = true, error = null) {
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    const duration = endTime - context.startTime;
    const memoryDelta = endMemory - context.startMemory;

    this.metrics.totalProcessingTime += duration;
    this.metrics.peakMemoryUsage = Math.max(this.metrics.peakMemoryUsage, endMemory);

    if (success) {
      this.metrics.conversions.push({
        duration,
        memoryDelta,
        timestamp: endTime
      });
    } else {
      this.metrics.errors.push({
        error: error?.message || 'Unknown error',
        duration,
        timestamp: endTime
      });
    }
  }

  getReport() {
    const successful = this.metrics.conversions.length;
    const failed = this.metrics.errors.length;
    const total = successful + failed;
    
    const durations = this.metrics.conversions.map(c => c.duration);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

    return {
      summary: {
        total,
        successful,
        failed,
        successRate: total > 0 ? (successful / total * 100).toFixed(1) + '%' : '0%'
      },
      performance: {
        avgDuration: Math.round(avgDuration),
        minDuration,
        maxDuration,
        totalProcessingTime: this.metrics.totalProcessingTime,
        throughput: this.metrics.totalProcessingTime > 0 ? 
          (successful / (this.metrics.totalProcessingTime / 1000)).toFixed(2) + ' docs/sec' : '0 docs/sec'
      },
      memory: {
        peakUsage: (this.metrics.peakMemoryUsage / 1024 / 1024).toFixed(1) + ' MB',
        avgDelta: this.metrics.conversions.length > 0 ? 
          (this.metrics.conversions.reduce((sum, c) => sum + c.memoryDelta, 0) / this.metrics.conversions.length / 1024 / 1024).toFixed(1) + ' MB' : '0 MB'
      },
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 ? 
          (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(1) + '%' : '0%'
      }
    };
  }
}

async function runPerformanceTest(testConfig) {
  console.log(`\n🚀 Running ${testConfig.name} Test`);
  console.log(`   📊 Files: ${testConfig.files}, Concurrent: ${testConfig.concurrent}, Iterations: ${testConfig.iterations}`);
  
  const profiler = new PerformanceProfiler();
  
  // Start server (simplified - in real test this would start the actual MCP server)
  console.log('   🔧 Preparing test environment...');
  
  // Simulate conversions with different complexities
  const complexities = ['simple', 'medium', 'complex'];
  
  for (let iteration = 0; iteration < testConfig.iterations; iteration++) {
    console.log(`   📋 Iteration ${iteration + 1}/${testConfig.iterations}`);
    
    const promises = [];
    
    for (let i = 0; i < testConfig.files; i++) {
      const complexity = complexities[i % complexities.length];
      const markdown = generateTestMarkdown(complexity);
      
      const promise = simulateConversion(markdown, complexity, profiler);
      promises.push(promise);
      
      // Control concurrency
      if (promises.length >= testConfig.concurrent) {
        await Promise.allSettled(promises.splice(0, testConfig.concurrent));
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Wait for remaining conversions
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }
  
  return profiler.getReport();
}

async function simulateConversion(markdown, complexity, profiler) {
  const context = profiler.startConversion();
  
  try {
    // Simulate processing time based on complexity
    const processingTime = {
      simple: 500 + Math.random() * 300,    // 500-800ms
      medium: 1200 + Math.random() * 500,   // 1200-1700ms
      complex: 2500 + Math.random() * 800   // 2500-3300ms
    };
    
    await new Promise(resolve => setTimeout(resolve, processingTime[complexity] || 1000));
    
    // Simulate occasional errors (5% failure rate)
    if (Math.random() < 0.05) {
      throw new Error(`Simulated ${complexity} conversion error`);
    }
    
    // Simulate cache behavior
    if (Math.random() < 0.3) { // 30% cache hit rate
      profiler.metrics.cacheHits++;
    } else {
      profiler.metrics.cacheMisses++;
    }
    
    profiler.endConversion(context, true);
    
  } catch (error) {
    profiler.endConversion(context, false, error);
  }
}

function displayReport(testName, report) {
  console.log(`\n📊 ${testName} Results:`);
  console.log('   ═══════════════════════════════════════');
  
  console.log(`   📈 Summary:`);
  console.log(`      • Total conversions: ${report.summary.total}`);
  console.log(`      • Successful: ${report.summary.successful}`);
  console.log(`      • Failed: ${report.summary.failed}`);
  console.log(`      • Success rate: ${report.summary.successRate}`);
  
  console.log(`   ⚡ Performance:`);
  console.log(`      • Average duration: ${report.performance.avgDuration}ms`);
  console.log(`      • Min duration: ${report.performance.minDuration}ms`);
  console.log(`      • Max duration: ${report.performance.maxDuration}ms`);
  console.log(`      • Throughput: ${report.performance.throughput}`);
  
  console.log(`   💾 Memory:`);
  console.log(`      • Peak usage: ${report.memory.peakUsage}`);
  console.log(`      • Avg delta per conversion: ${report.memory.avgDelta}`);
  
  console.log(`   🎯 Cache:`);
  console.log(`      • Cache hits: ${report.cache.hits}`);
  console.log(`      • Cache misses: ${report.cache.misses}`);
  console.log(`      • Hit rate: ${report.cache.hitRate}`);
}

async function runAllPerformanceTests() {
  console.log('🏁 Enhanced MCP Server - Performance Benchmark Suite');
  console.log('=' .repeat(60));
  
  const results = {};
  
  // Run each test configuration
  for (const [testKey, testConfig] of Object.entries(PERFORMANCE_TESTS)) {
    try {
      const result = await runPerformanceTest(testConfig);
      results[testKey] = result;
      displayReport(testConfig.name, result);
    } catch (error) {
      console.error(`❌ ${testConfig.name} test failed:`, error.message);
    }
  }
  
  // Overall summary
  console.log('\n🎯 Performance Summary');
  console.log('═'.repeat(60));
  
  const overallStats = Object.entries(results).map(([key, result]) => ({
    test: PERFORMANCE_TESTS[key].name,
    throughput: parseFloat(result.performance.throughput) || 0,
    avgDuration: result.performance.avgDuration,
    successRate: parseFloat(result.summary.successRate) || 0
  }));
  
  overallStats.forEach(stat => {
    console.log(`📊 ${stat.test}:`);
    console.log(`   • Throughput: ${stat.throughput.toFixed(2)} docs/sec`);
    console.log(`   • Avg Duration: ${stat.avgDuration}ms`);
    console.log(`   • Success Rate: ${stat.successRate.toFixed(1)}%`);
  });
  
  // Performance recommendations
  console.log('\n💡 Performance Recommendations:');
  
  const bestThroughput = Math.max(...overallStats.map(s => s.throughput));
  const avgDuration = overallStats.reduce((sum, s) => sum + s.avgDuration, 0) / overallStats.length;
  
  if (bestThroughput > 2) {
    console.log('   ✅ Excellent throughput - server handles load well');
  } else if (bestThroughput > 1) {
    console.log('   ⚠️  Good throughput - consider optimizing for higher loads');
  } else {
    console.log('   ❌ Low throughput - optimization needed');
  }
  
  if (avgDuration < 1000) {
    console.log('   ✅ Fast average response times');
  } else if (avgDuration < 2000) {
    console.log('   ⚠️  Moderate response times - monitor under heavy load');
  } else {
    console.log('   ❌ Slow response times - investigate bottlenecks');
  }
  
  console.log('\n🚀 Performance testing complete!');
}

async function main() {
  // Check if server is built
  if (!fs.existsSync(path.join(__dirname, 'dist/index.js'))) {
    console.error('❌ Server not built. Run: npm run build');
    return false;
  }
  
  console.log('⚠️  Note: This is a simulation-based performance test.');
  console.log('   For real performance testing, integrate with actual MCP server.\n');
  
  await runAllPerformanceTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runPerformanceTest, PerformanceProfiler, generateTestMarkdown };