/**
 * Comprehensive Test Runner for Enhanced MCP Server
 * Orchestrates all test suites and provides detailed reporting
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Import test modules
const { testDirectConversion, testServerStartup } = require('./test-basic.cjs');
const { runIntegrationTests } = require('./test-integration.cjs');
const { runPerformanceTest, PERFORMANCE_TESTS } = require('./test-performance.cjs');
const { runDockerTests } = require('./test-docker.cjs');

class TestSuite {
  constructor() {
    this.results = {};
    this.startTime = Date.now();
  }

  async runTest(name, testFunction, options = {}) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Running ${name}`);
    console.log(`${'='.repeat(60)}`);
    
    const startTime = Date.now();
    let success = false;
    let error = null;
    
    try {
      const result = await testFunction();
      success = result !== false;
      
      if (options.expectedResult !== undefined) {
        success = result === options.expectedResult;
      }
      
    } catch (e) {
      error = e.message;
      console.error(`❌ ${name} failed:`, e.message);
    }
    
    const duration = Date.now() - startTime;
    
    this.results[name] = {
      success,
      duration,
      error,
      timestamp: new Date().toISOString()
    };
    
    console.log(`\n${success ? '✅' : '❌'} ${name} ${success ? 'PASSED' : 'FAILED'} (${duration}ms)`);
    
    return success;
  }

  generateReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    const total = Object.keys(this.results).length;
    const passed = Object.values(this.results).filter(r => r.success).length;
    const failed = total - passed;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 ENHANCED MCP SERVER - COMPREHENSIVE TEST REPORT`);
    console.log(`${'='.repeat(80)}`);
    
    console.log(`\n🎯 Summary:`);
    console.log(`   • Total Tests: ${total}`);
    console.log(`   • Passed: ${passed} ✅`);
    console.log(`   • Failed: ${failed} ❌`);
    console.log(`   • Success Rate: ${total > 0 ? (passed / total * 100).toFixed(1) : 0}%`);
    console.log(`   • Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    
    console.log(`\n📋 Detailed Results:`);
    Object.entries(this.results).forEach(([name, result]) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`;
      console.log(`   ${status.padEnd(8)} ${name.padEnd(30)} ${duration.padStart(8)}`);
      
      if (result.error) {
        console.log(`            Error: ${result.error}`);
      }
    });
    
    // Performance analysis
    const performanceTests = Object.entries(this.results).filter(([name]) => 
      name.includes('Performance') || name.includes('Load')
    );
    
    if (performanceTests.length > 0) {
      console.log(`\n⚡ Performance Analysis:`);
      performanceTests.forEach(([name, result]) => {
        if (result.success) {
          const category = result.duration < 1000 ? 'Fast' : 
                          result.duration < 5000 ? 'Moderate' : 'Slow';
          console.log(`   ${name}: ${category} (${result.duration}ms)`);
        }
      });
    }
    
    // Recommendations
    console.log(`\n💡 Recommendations:`);
    
    if (failed === 0) {
      console.log(`   🎉 Excellent! All tests passed. Your MCP server is production-ready.`);
    } else if (failed <= 2) {
      console.log(`   ⚠️  Good overall, but address the ${failed} failing test${failed > 1 ? 's' : ''}.`);
    } else {
      console.log(`   🔧 Several tests failed. Review and fix issues before deployment.`);
    }
    
    // Specific recommendations based on failures
    const failedTests = Object.entries(this.results)
      .filter(([, result]) => !result.success)
      .map(([name]) => name);
    
    if (failedTests.some(name => name.includes('Docker'))) {
      console.log(`   🐳 Docker issues detected - check Docker installation and Dockerfile`);
    }
    
    if (failedTests.some(name => name.includes('Performance'))) {
      console.log(`   ⚡ Performance issues detected - consider optimizing processing pipeline`);
    }
    
    if (failedTests.some(name => name.includes('Integration'))) {
      console.log(`   🔌 Integration issues detected - verify MCP protocol implementation`);
    }
    
    console.log(`\n📅 Report generated: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}\n`);
    
    return {
      total,
      passed,
      failed,
      successRate: total > 0 ? (passed / total * 100) : 0,
      duration: totalDuration,
      results: this.results
    };
  }
}

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...\n');
  
  const checks = [
    {
      name: 'Package.json exists',
      check: () => fs.existsSync(path.join(__dirname, 'package.json'))
    },
    {
      name: 'Server is built',
      check: () => fs.existsSync(path.join(__dirname, 'dist/index.js'))
    },
    {
      name: 'TypeScript source exists',
      check: () => fs.existsSync(path.join(__dirname, 'src/index.ts'))
    },
    {
      name: 'Dependencies installed',
      check: () => fs.existsSync(path.join(__dirname, 'node_modules'))
    },
    {
      name: 'Basic test files exist',
      check: () => ['test-basic.cjs', 'test-integration.cjs'].every(file => 
        fs.existsSync(path.join(__dirname, file))
      )
    }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    const passed = check.check();
    console.log(`   ${passed ? '✅' : '❌'} ${check.name}`);
    if (!passed) allPassed = false;
  }
  
  if (!allPassed) {
    console.log('\n❌ Prerequisites not met. Please fix the issues above before running tests.');
    return false;
  }
  
  console.log('\n✅ All prerequisites met!\n');
  return true;
}

async function runAllTests(options = {}) {
  console.log('🚀 Enhanced MCP Server - Comprehensive Test Suite');
  console.log('   Testing all components, performance, and deployment readiness\n');
  
  // Check prerequisites
  if (!await checkPrerequisites()) {
    return false;
  }
  
  const testSuite = new TestSuite();
  
  // Test Configuration
  const testConfig = {
    basic: options.skip?.includes('basic') ? false : true,
    integration: options.skip?.includes('integration') ? false : true,
    performance: options.skip?.includes('performance') ? false : true,
    docker: options.skip?.includes('docker') ? false : true
  };
  
  console.log('📋 Test Configuration:');
  Object.entries(testConfig).forEach(([test, enabled]) => {
    console.log(`   ${enabled ? '✅' : '⏭️ '} ${test.charAt(0).toUpperCase() + test.slice(1)} Tests`);
  });
  
  let overallSuccess = true;
  
  // 1. Basic Tests
  if (testConfig.basic) {
    const basicSuccess = await testSuite.runTest('Basic Functionality', async () => {
      const directTest = await testDirectConversion();
      const startupTest = await testServerStartup();
      return directTest && startupTest;
    });
    overallSuccess = overallSuccess && basicSuccess;
  }
  
  // 2. Integration Tests  
  if (testConfig.integration) {
    const integrationSuccess = await testSuite.runTest('MCP Integration', runIntegrationTests);
    overallSuccess = overallSuccess && integrationSuccess;
  }
  
  // 3. Performance Tests
  if (testConfig.performance) {
    // Run a subset of performance tests for the comprehensive suite
    const perfSuccess = await testSuite.runTest('Performance - Light Load', async () => {
      const { runPerformanceTest } = require('./test-performance.cjs');
      const result = await runPerformanceTest({
        name: 'Light Load',
        files: 2,
        concurrent: 1,
        iterations: 1
      });
      return result.summary.successRate > 80; // 80% success rate threshold
    });
    overallSuccess = overallSuccess && perfSuccess;
  }
  
  // 4. Docker Tests
  if (testConfig.docker) {
    const dockerSuccess = await testSuite.runTest('Docker Deployment', runDockerTests);
    // Docker tests are optional - don't fail overall suite if Docker isn't available
    if (!dockerSuccess) {
      console.log('   ℹ️  Docker tests failed but are optional for development');
    }
  }
  
  // Generate comprehensive report
  const report = testSuite.generateReport();
  
  // Save report to file
  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    ...report,
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: __dirname
    }
  }, null, 2));
  
  console.log(`📄 Detailed report saved to: ${reportPath}`);
  
  // Final status
  if (overallSuccess && report.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Your Enhanced MCP Server is ready for production!');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Deploy using Docker: docker-compose up -d');
    console.log('   2. Configure Claude Desktop to use your MCP server');
    console.log('   3. Test with real conversion workflows');
    console.log('   4. Monitor performance and adjust as needed');
    
  } else {
    console.log('\n⚠️  Some tests failed. Review the report and fix issues before deployment.');
  }
  
  return overallSuccess;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    skip: []
  };
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      console.log('Enhanced MCP Server - Test Runner\n');
      console.log('Usage: node run-all-tests.cjs [options]\n');
      console.log('Options:');
      console.log('  --skip <test>    Skip specific test suite (basic|integration|performance|docker)');
      console.log('  --help, -h       Show this help message');
      console.log('\nExamples:');
      console.log('  node run-all-tests.cjs                    # Run all tests');
      console.log('  node run-all-tests.cjs --skip docker      # Skip Docker tests');
      console.log('  node run-all-tests.cjs --skip performance # Skip performance tests');
      return;
    }
    
    if (arg === '--skip' && i + 1 < args.length) {
      options.skip.push(args[i + 1]);
      i++; // Skip next argument as it's the value for --skip
    }
  }
  
  const success = await runAllTests(options);
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests, TestSuite, checkPrerequisites };