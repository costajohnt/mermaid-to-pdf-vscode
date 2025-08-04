"use strict";
/**
 * Core Markdown + Mermaid Converter
 *
 * This is the main converter class that orchestrates the conversion process
 * using a plugin-based architecture for extensibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownMermaidConverter = void 0;
exports.createConverter = createConverter;
const events_1 = require("events");
const types_1 = require("./types");
const parser_1 = require("./parser");
const cache_1 = require("./cache");
class MarkdownMermaidConverter extends events_1.EventEmitter {
    config;
    parser;
    cache;
    constructor(config) {
        super();
        this.config = config;
        this.parser = new parser_1.MarkdownParser();
        if (config.cache?.enabled) {
            this.cache = new cache_1.CacheManager(config.cache);
        }
    }
    /**
     * Convert markdown content to specified format
     */
    async convert(input) {
        const startTime = Date.now();
        try {
            this.emit('start', {
                type: 'start',
                timestamp: new Date(),
                data: { format: input.format, contentLength: input.content.length }
            });
            // Step 1: Parse markdown content
            this.emitProgress('Parsing markdown content...', 10);
            const parsed = await this.parser.parse(input.content, input.metadata);
            // Step 2: Render diagrams
            this.emitProgress('Rendering diagrams...', 30);
            const renderedDiagrams = await this.renderDiagrams(parsed.diagrams);
            // Step 3: Generate output
            this.emitProgress(`Generating ${input.format} output...`, 70);
            const output = await this.generateOutput(input.format, parsed, renderedDiagrams, input.options);
            // Step 4: Complete
            const processingTime = Date.now() - startTime;
            output.metadata = {
                ...output.metadata,
                processingTime,
                diagrams: renderedDiagrams.length
            };
            this.emit('complete', {
                type: 'complete',
                timestamp: new Date(),
                data: {
                    format: output.format,
                    size: output.data instanceof Buffer ? output.data.length : output.data.length,
                    processingTime
                }
            });
            this.emitProgress('Complete!', 100);
            return output;
        }
        catch (error) {
            this.emit('error', {
                type: 'error',
                timestamp: new Date(),
                data: { error: error instanceof Error ? error.message : String(error) }
            });
            if (error instanceof types_1.ConversionError) {
                throw error;
            }
            throw new types_1.ConversionError(`Conversion failed: ${error instanceof Error ? error.message : String(error)}`, 'CONVERSION_FAILED', { originalError: error });
        }
    }
    /**
     * Register a new output generator
     */
    registerGenerator(generator) {
        this.config.generators.set(generator.format, generator);
    }
    /**
     * Register a new diagram renderer
     */
    registerRenderer(renderer) {
        for (const type of renderer.supportedTypes) {
            this.config.renderers.set(type, renderer);
        }
    }
    /**
     * Get list of supported output formats
     */
    getSupportedFormats() {
        return Array.from(this.config.generators.keys());
    }
    /**
     * Get list of supported diagram types
     */
    getSupportedDiagramTypes() {
        return Array.from(this.config.renderers.keys());
    }
    /**
     * Add event listener with proper typing
     */
    onEvent(handler) {
        this.on('start', handler);
        this.on('progress', handler);
        this.on('diagram_rendered', handler);
        this.on('complete', handler);
        this.on('error', handler);
    }
    /**
     * Render all diagrams in the document
     */
    async renderDiagrams(diagrams) {
        const renderedDiagrams = [];
        const concurrency = this.config.performance?.maxConcurrency || 3;
        // Process diagrams in batches for better performance
        for (let i = 0; i < diagrams.length; i += concurrency) {
            const batch = diagrams.slice(i, i + concurrency);
            const batchPromises = batch.map(diagram => this.renderSingleDiagram(diagram));
            const batchResults = await Promise.allSettled(batchPromises);
            for (let j = 0; j < batchResults.length; j++) {
                const result = batchResults[j];
                const diagramIndex = i + j + 1;
                if (result && result.status === 'fulfilled') {
                    renderedDiagrams.push(result.value);
                    this.emitProgress(`Rendered diagram ${diagramIndex}/${diagrams.length}`, 30 + (diagramIndex / diagrams.length) * 40);
                }
                else if (result && result.status === 'rejected') {
                    console.error(`Failed to render diagram ${diagramIndex}:`, result.reason);
                    // Continue with other diagrams even if one fails
                }
            }
        }
        return renderedDiagrams;
    }
    /**
     * Render a single diagram
     */
    async renderSingleDiagram(diagram) {
        const startTime = Date.now();
        try {
            // Check cache first
            if (this.cache) {
                const cached = await this.cache.get(diagram.hash);
                if (cached) {
                    this.emit('diagram_rendered', {
                        type: 'diagram_rendered',
                        timestamp: new Date(),
                        data: {
                            diagramId: diagram.id,
                            renderTime: Date.now() - startTime,
                            fromCache: true
                        }
                    });
                    return cached;
                }
            }
            // Get appropriate renderer
            const renderer = this.config.renderers.get(diagram.type);
            if (!renderer) {
                throw new types_1.DiagramRenderError(`No renderer available for diagram type: ${diagram.type}`, diagram.id, diagram.type);
            }
            // Render diagram
            const rendered = await renderer.render(diagram, {
                theme: 'light',
                format: 'png',
                scale: 2
            });
            // Cache the result
            if (this.cache) {
                await this.cache.set(diagram.hash, rendered);
            }
            this.emit('diagram_rendered', {
                type: 'diagram_rendered',
                timestamp: new Date(),
                data: {
                    diagramId: diagram.id,
                    renderTime: Date.now() - startTime,
                    fromCache: false
                }
            });
            return rendered;
        }
        catch (error) {
            throw new types_1.DiagramRenderError(`Failed to render diagram: ${error instanceof Error ? error.message : String(error)}`, diagram.id, diagram.type, { originalError: error });
        }
    }
    /**
     * Generate output using appropriate generator
     */
    async generateOutput(format, content, diagrams, options) {
        const generator = this.config.generators.get(format);
        if (!generator) {
            throw new types_1.ConversionError(`No generator available for format: ${format}`, 'GENERATOR_NOT_FOUND');
        }
        return generator.generate(content, diagrams, options);
    }
    /**
     * Emit progress event
     */
    emitProgress(message, progress) {
        this.emit('progress', {
            type: 'progress',
            timestamp: new Date(),
            data: {
                step: message,
                progress: Math.min(100, Math.max(0, progress)),
                message
            }
        });
    }
}
exports.MarkdownMermaidConverter = MarkdownMermaidConverter;
/**
 * Factory function to create converter with default configuration
 */
function createConverter(options = {}) {
    const defaultConfig = {
        defaultFormat: 'pdf',
        generators: new Map(),
        renderers: new Map(),
        cache: {
            enabled: true,
            maxSize: 50, // 50MB
            ttl: 3600 // 1 hour
        },
        performance: {
            maxConcurrency: 3,
            browserPoolSize: 2,
            timeout: 30000 // 30 seconds
        },
        ...options
    };
    return new MarkdownMermaidConverter(defaultConfig);
}
//# sourceMappingURL=converter.js.map