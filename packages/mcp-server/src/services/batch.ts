/**
 * Batch Processing Service
 */

import { MarkdownMermaidConverter, ConversionInput, ConversionOutput } from 'mermaid-converter-core';
import { 
  BatchConversionInput,
  BatchConversionResult,
  ConversionResult,
  ConversionError,
  BatchOptions 
} from '../types.js';
import { CacheService, generateCacheKey } from './cache.js';

export class BatchProcessor {
  constructor(
    private converter: MarkdownMermaidConverter,
    private cache: CacheService,
    private logger: any
  ) {}

  async processBatch(input: BatchConversionInput): Promise<BatchConversionResult> {
    const startTime = Date.now();
    const { files, options = {} } = input;
    
    this.logger.info({
      fileCount: files.length,
      concurrency: options.concurrency || 3,
      continueOnError: options.continueOnError || false
    }, 'Starting batch conversion');

    const results: ConversionResult[] = [];
    const errors: ConversionError[] = [];
    
    // Process files in batches for better performance
    const concurrency = Math.min(options.concurrency || 3, files.length);
    const batches = this.createBatches(files, concurrency);
    
    for (const batch of batches) {
      const batchPromises = batch.map(file => this.processFile(file, options));
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const file = batch[i];
        
        if (result?.status === 'fulfilled') {
          results.push(result.value);
        } else if (result?.status === 'rejected') {
          const error: ConversionError = {
            file: file?.metadata?.filename || `file_${results.length + errors.length}`,
            error: result.reason?.message || String(result.reason),
            timestamp: new Date()
          };
          errors.push(error);
          
          // Stop processing if continueOnError is false
          if (!options.continueOnError) {
            this.logger.error({ error }, 'Batch processing stopped due to error');
            break;
          }
        }
      }
    }

    const processingTime = Date.now() - startTime;
    const batchResult: BatchConversionResult = {
      success: errors.length === 0,
      results,
      errors,
      summary: {
        total: files.length,
        successful: results.length,
        failed: errors.length,
        processingTime
      }
    };

    this.logger.info({
      total: batchResult.summary.total,
      successful: batchResult.summary.successful,
      failed: batchResult.summary.failed,
      processingTime: batchResult.summary.processingTime
    }, 'Batch conversion completed');

    return batchResult;
  }

  private async processFile(input: ConversionInput, options: BatchOptions): Promise<ConversionResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = generateCacheKey('conversion', {
        content: input.content,
        format: input.format,
        options: input.options
      });
      
      let output = await this.cache.get(cacheKey);
      let fromCache = false;
      
      if (!output) {
        // Apply template if specified
        const processedInput = options.template 
          ? await this.applyTemplate(input, options.template)
          : input;
        
        output = await this.converter.convert(processedInput);
        await this.cache.set(cacheKey, output);
      } else {
        fromCache = true;
      }
      
      const processingTime = Date.now() - startTime;
      
      this.logger.debug({
        filename: input.metadata?.filename,
        format: input.format,
        processingTime,
        fromCache
      }, 'File processed successfully');
      
      return {
        input,
        output,
        processingTime
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error({
        filename: input.metadata?.filename,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      }, 'File processing failed');
      
      return {
        input,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      };
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  private async applyTemplate(input: ConversionInput, templateId: string): Promise<ConversionInput> {
    // TODO: Implement template application logic
    // For now, just return the input unchanged
    this.logger.debug({ templateId }, 'Template application not yet implemented');
    return input;
  }

  async validateBatchInput(input: BatchConversionInput): Promise<string[]> {
    const errors: string[] = [];
    
    if (!input.files || !Array.isArray(input.files)) {
      errors.push('files must be an array');
    } else {
      if (input.files.length === 0) {
        errors.push('files array cannot be empty');
      }
      
      if (input.files.length > 100) {
        errors.push('batch size cannot exceed 100 files');
      }
      
      // Validate each file
      input.files.forEach((file, index) => {
        if (!file.content || typeof file.content !== 'string') {
          errors.push(`files[${index}].content is required and must be a string`);
        }
        
        if (!file.format || typeof file.format !== 'string') {
          errors.push(`files[${index}].format is required and must be a string`);
        }
      });
    }
    
    // Validate options
    if (input.options) {
      const { concurrency, continueOnError, outputFormat, template } = input.options;
      
      if (concurrency !== undefined) {
        if (typeof concurrency !== 'number' || concurrency < 1 || concurrency > 10) {
          errors.push('options.concurrency must be a number between 1 and 10');
        }
      }
      
      if (continueOnError !== undefined && typeof continueOnError !== 'boolean') {
        errors.push('options.continueOnError must be a boolean');
      }
      
      if (outputFormat !== undefined && typeof outputFormat !== 'string') {
        errors.push('options.outputFormat must be a string');
      }
      
      if (template !== undefined && typeof template !== 'string') {
        errors.push('options.template must be a string');
      }
    }
    
    return errors;
  }
}