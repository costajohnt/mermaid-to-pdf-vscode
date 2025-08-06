"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMermaid = renderMermaid;
const fs = require("fs");
const path = require("path");
const browserPool_js_1 = require("./browserPool.js");
async function renderMermaid(mermaidCode, outputPath) {
    // Validate inputs
    await validateMermaidInput(mermaidCode, outputPath);
    const browserPool = browserPool_js_1.BrowserPool.getInstance();
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();
    // Set viewport for consistent rendering - smaller for more compact diagrams
    await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });
    // Increase timeout for complex diagrams
    page.setDefaultTimeout(60000);
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        }
        #mermaid-container {
            display: inline-block;
            min-width: 100px;
            min-height: 100px;
        }
        .mermaid {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        }
        /* Ensure SVG is visible */
        .mermaid svg {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
    <div id="mermaid-container">
        <div class="mermaid" id="diagram">
${mermaidCode}
        </div>
    </div>
    
    <script>
        // Initialize mermaid with better error handling
        mermaid.initialize({ 
            startOnLoad: false,
            theme: 'default',
            themeVariables: {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                fontSize: '14px'
            },
            logLevel: 'error',
            securityLevel: 'loose',
            flowchart: {
                htmlLabels: true,
                useMaxWidth: true,
                nodeSpacing: 30,
                rankSpacing: 30,
                padding: 10
            },
            sequence: {
                diagramMarginX: 25,
                diagramMarginY: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 25
            }
        });
        
        // Manual initialization with error handling
        window.addEventListener('DOMContentLoaded', async function() {
            try {
                const element = document.getElementById('diagram');
                if (element) {
                    await mermaid.run({
                        nodes: [element]
                    });
                    
                    // Mark as complete for Puppeteer to detect
                    window.mermaidRenderComplete = true;
                    
                    // Ensure proper sizing
                    const svg = element.querySelector('svg');
                    if (svg) {
                        const bbox = svg.getBBox();
                        svg.setAttribute('width', Math.max(bbox.width + 40, 100));
                        svg.setAttribute('height', Math.max(bbox.height + 40, 100));
                        svg.style.maxWidth = 'none';
                        svg.style.height = 'auto';
                    }
                }
            } catch (error) {
                console.error('Mermaid rendering failed:', error);
                window.mermaidRenderError = error.message;
                
                // Create fallback content
                const element = document.getElementById('diagram');
                if (element) {
                    element.innerHTML = '<div style="border: 2px dashed #ccc; padding: 20px; text-align: center; color: #666;">Mermaid diagram failed to render:<br>' + error.message + '</div>';
                }
                window.mermaidRenderComplete = true;
            }
        });
    </script>
</body>
</html>`;
    try {
        await page.setContent(html, {
            waitUntil: ['networkidle0', 'domcontentloaded']
        });
        // Wait for mermaid library to load
        await page.waitForFunction(() => typeof window.mermaid !== 'undefined' && typeof window.mermaid.run === 'function', { timeout: 30000 });
        // Wait for render to complete (either success or error)
        await page.waitForFunction(() => window.mermaidRenderComplete === true, { timeout: 45000 });
        // Check if there was an error
        const renderError = await page.evaluate(() => window.mermaidRenderError);
        if (renderError) {
            console.warn(`Mermaid render warning: ${renderError}`);
        }
        // Wait for SVG to be present and have dimensions, or for error fallback
        await page.waitForFunction(() => {
            const container = document.getElementById('mermaid-container');
            if (!container) {
                return false;
            }
            // Check for error fallback content
            const errorDiv = container.querySelector('div[style*="border: 2px dashed"]');
            if (errorDiv) {
                return true; // Error fallback is ready
            }
            const svg = container.querySelector('svg');
            if (!svg) {
                return false;
            }
            const bbox = svg.getBoundingClientRect();
            return bbox.width > 0 && bbox.height > 0;
        }, { timeout: 30000 });
        // Additional wait to ensure fonts are loaded
        await new Promise(resolve => setTimeout(resolve, 2000));
        const element = await page.$('#mermaid-container');
        if (element) {
            await element.screenshot({
                path: outputPath,
                type: 'png',
                omitBackground: false
            });
        }
        else {
            throw new Error('Failed to find Mermaid diagram container');
        }
    }
    catch (error) {
        console.error('Mermaid rendering error:', error);
        throw new Error(`Failed to render Mermaid diagram: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        // Close the page and release browser back to pool
        try {
            await page.close();
        }
        catch (error) {
            console.warn('Failed to close page:', error);
        }
        const browserPool = browserPool_js_1.BrowserPool.getInstance();
        await browserPool.releaseBrowser(browser);
    }
}
async function validateMermaidInput(mermaidCode, outputPath) {
    // Validate mermaid code input
    if (!mermaidCode || typeof mermaidCode !== 'string') {
        throw new Error('Invalid mermaid code: Code must be a non-empty string');
    }
    if (mermaidCode.length > 50000) { // 50KB limit for diagram code
        throw new Error('Mermaid code too large: Maximum size is 50KB');
    }
    // Basic validation to prevent potentially dangerous content
    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /<iframe/i,
        /<object/i,
        /<embed/i
    ];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(mermaidCode)) {
            throw new Error('Security violation: Potentially dangerous content detected in mermaid code');
        }
    }
    // Validate output path
    if (!outputPath || typeof outputPath !== 'string') {
        throw new Error('Invalid output path: Path must be a non-empty string');
    }
    // Ensure output path is absolute and safe
    const normalizedPath = path.normalize(outputPath);
    if (normalizedPath.includes('..')) {
        throw new Error('Invalid output path: Path traversal detected');
    }
    if (!normalizedPath.toLowerCase().endsWith('.png')) {
        throw new Error('Invalid output format: Only PNG output is supported');
    }
    // Ensure output directory exists and is writable
    const outputDir = path.dirname(outputPath);
    try {
        await fs.promises.access(outputDir);
    }
    catch (error) {
        throw new Error(`Output directory does not exist: ${outputDir}`);
    }
    try {
        await fs.promises.access(outputDir, fs.constants.W_OK);
    }
    catch (error) {
        throw new Error(`Cannot write to output directory: ${outputDir}. Check permissions.`);
    }
}
