// Simple unit test that doesn't require VSCode environment
import * as assert from 'assert';
import * as path from 'path';

describe('Basic Tests', () => {
    it('should have correct file structure', () => {
        // Test that key files exist in the compiled output
        const fs = require('fs');
        const outDir = path.join(__dirname, '../../../out');
        
        assert.ok(fs.existsSync(path.join(outDir, 'extension.js')), 'extension.js should exist');
        assert.ok(fs.existsSync(path.join(outDir, 'finalConverter.js')), 'finalConverter.js should exist');
        assert.ok(fs.existsSync(path.join(outDir, 'mermaidRenderer.js')), 'mermaidRenderer.js should exist');
    });

    it('should load configuration correctly', () => {
        // Test basic configuration
        const packageJson = require('../../../package.json');
        assert.strictEqual(packageJson.name, 'mermaid-to-pdf');
        assert.ok(packageJson.version);
        assert.ok(packageJson.main === './out/extension.js');
    });
});