import * as path from 'path';

export function run(): Promise<void> {
    // Initialize Mocha test globals
    const Mocha = require('mocha');
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 60000
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        try {
            // Add test files to Mocha
            const testFiles = [
                './finalConverter.test.js',
                './mermaidRenderer.test.js',
                './extension.test.js',
                './browserPool.test.js',
                './diagramCache.test.js'
            ];

            testFiles.forEach(file => {
                const testPath = path.resolve(__dirname, file);
                mocha.addFile(testPath);
            });

            // Run the tests
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (error) {
            console.error('Failed to run tests:', error);
            reject(error);
        }
    });
}