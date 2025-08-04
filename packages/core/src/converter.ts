/**
 * Core Markdown + Mermaid Converter
 * 
 * This is the main converter class that orchestrates the conversion process
 * using a plugin-based architecture for extensibility.
 */

import { EventEmitter } from 'events';
import {
  ConversionInput,
  ConversionOutput,
  ConverterConfig,
  OutputGenerator,
  DiagramRenderer,
  ParsedContent,
  RenderedDiagram,
  ConversionEvent,
  EventHandler,
  ConversionError,
  DiagramRenderError
} from './types';
import { MarkdownParser } from './parser';
import { CacheManager } from './cache';

export class MarkdownMermaidConverter extends EventEmitter {
  private config: ConverterConfig;
  private parser: MarkdownParser;
  private cache?: CacheManager;

  constructor(config: ConverterConfig) {
    super();
    this.config = config;
    this.parser = new MarkdownParser();
    
    if (config.cache?.enabled) {
      this.cache = new CacheManager(config.cache);
    }
  }

  /**
   * Convert markdown content to specified format
   */
  async convert(input: ConversionInput): Promise<ConversionOutput> {
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

    } catch (error) {
      this.emit('error', {
        type: 'error',
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : String(error) }
      });
      
      if (error instanceof ConversionError) {
        throw error;
      }
      
      throw new ConversionError(
        `Conversion failed: ${error instanceof Error ? error.message : String(error)}`,
        'CONVERSION_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Register a new output generator
   */
  registerGenerator(generator: OutputGenerator): void {
    this.config.generators.set(generator.format, generator);
  }

  /**
   * Register a new diagram renderer
   */
  registerRenderer(renderer: DiagramRenderer): void {
    for (const type of renderer.supportedTypes) {
      this.config.renderers.set(type, renderer);
    }
  }

  /**
   * Get list of supported output formats
   */
  getSupportedFormats(): string[] {
    return Array.from(this.config.generators.keys());
  }

  /**
   * Get list of supported diagram types
   */
  getSupportedDiagramTypes(): string[] {
    return Array.from(this.config.renderers.keys());
  }

  /**
   * Add event listener with proper typing
   */
  onEvent(handler: EventHandler): void {
    this.on('start', handler);
    this.on('progress', handler);
    this.on('diagram_rendered', handler);
    this.on('complete', handler);
    this.on('error', handler);
  }

  /**
   * Render all diagrams in the document
   */
  private async renderDiagrams(diagrams: ParsedContent['diagrams']): Promise<RenderedDiagram[]> {
    const renderedDiagrams: RenderedDiagram[] = [];
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
          this.emitProgress(
            `Rendered diagram ${diagramIndex}/${diagrams.length}`, 
            30 + (diagramIndex / diagrams.length) * 40
          );
        } else if (result && result.status === 'rejected') {
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
  private async renderSingleDiagram(diagram: ParsedContent['diagrams'][0]): Promise<RenderedDiagram> {
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
          return cached as RenderedDiagram;
        }
      }

      // Get appropriate renderer
      const renderer = this.config.renderers.get(diagram.type);
      if (!renderer) {
        throw new DiagramRenderError(
          `No renderer available for diagram type: ${diagram.type}`,
          diagram.id,
          diagram.type
        );
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

    } catch (error) {
      throw new DiagramRenderError(
        `Failed to render diagram: ${error instanceof Error ? error.message : String(error)}`,
        diagram.id,
        diagram.type,
        { originalError: error }
      );
    }
  }

  /**
   * Generate output using appropriate generator
   */
  private async generateOutput(
    format: string,
    content: ParsedContent,
    diagrams: RenderedDiagram[],
    options?: any
  ): Promise<ConversionOutput> {
    const generator = this.config.generators.get(format);
    if (!generator) {
      throw new ConversionError(
        `No generator available for format: ${format}`,
        'GENERATOR_NOT_FOUND'
      );
    }

    return generator.generate(content, diagrams, options);
  }

  /**
   * Emit progress event
   */
  private emitProgress(message: string, progress: number): void {
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

/**
 * Factory function to create converter with default configuration
 */
export function createConverter(options: Partial<ConverterConfig> = {}): MarkdownMermaidConverter {
  const defaultConfig: ConverterConfig = {
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

export { ConverterConfig };