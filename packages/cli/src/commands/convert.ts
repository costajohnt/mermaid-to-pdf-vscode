/**
 * Convert command - Main conversion functionality
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import { 
  createConverter, 
  PDFGenerator, 
  MermaidRenderer,
  ConversionOutput 
} from '@mermaid-converter/core';
import { logger } from '../utils/logger.js';
import { getTemplate, BUILT_IN_TEMPLATES } from '../utils/templates.js';
import { createProgressBar } from '../utils/progress.js';
import { formatBytes, formatDuration } from '../utils/format.js';

interface ConvertOptions {
  format?: string;
  output?: string;
  outputDir?: string;
  template?: string;
  batch?: boolean;
  concurrency?: string;
  overwrite?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

export const convertCommand = new Command('convert')
  .description('Convert Markdown files with Mermaid diagrams')
  .argument('<input>', 'Input file(s) or glob pattern')
  .option('-f, --format <format>', 'Output format', 'pdf')
  .option('-o, --output <file>', 'Output file (single file mode)')
  .option('-d, --output-dir <dir>', 'Output directory (batch mode)', '.')
  .option('-t, --template <name>', 'Template to use', 'default')
  .option('-b, --batch', 'Enable batch processing for multiple files')
  .option('-c, --concurrency <n>', 'Number of concurrent conversions', '3')
  .option('--overwrite', 'Overwrite existing files', false)
  .action(async (input: string, options: ConvertOptions) => {
    const converter = createConverter();
    
    // Register generators and renderers
    converter.registerGenerator(new PDFGenerator());
    converter.registerRenderer(new MermaidRenderer());
    
    try {
      // Find files
      const files = await findFiles(input, options);
      
      if (files.length === 0) {
        logger.error(`No files found matching: ${input}`);
        process.exit(1);
      }
      
      logger.info(`Found ${files.length} file(s) to convert`);
      
      // Get template
      const template = await getTemplate(options.template || 'default');
      
      if (files.length === 1 && !options.batch) {
        // Single file mode
        await convertSingleFile(files[0], converter, options, template);
      } else {
        // Batch mode
        await convertBatch(files, converter, options, template);
      }
      
      logger.success('Conversion completed successfully!');
    } catch (error: any) {
      logger.error('Conversion failed:', error.message);
      if (options.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

async function findFiles(input: string, options: ConvertOptions): Promise<string[]> {
  const stats = await fs.stat(input).catch(() => null);
  
  if (stats?.isFile()) {
    return [path.resolve(input)];
  }
  
  // Treat as glob pattern
  const files = await glob(input, {
    nodir: true,
    absolute: true
  });
  
  return files.filter(file => file.endsWith('.md'));
}

async function convertSingleFile(
  inputFile: string,
  converter: any,
  options: ConvertOptions,
  template: any
) {
  const spinner = ora(`Converting ${path.basename(inputFile)}...`).start();
  
  try {
    // Read input file
    const content = await fs.readFile(inputFile, 'utf-8');
    
    // Determine output file
    const outputFile = options.output || 
      path.join(
        options.outputDir || path.dirname(inputFile),
        path.basename(inputFile, '.md') + `.${options.format || 'pdf'}`
      );
    
    // Check if output exists
    if (!options.overwrite) {
      const exists = await fs.access(outputFile).then(() => true).catch(() => false);
      if (exists) {
        spinner.fail(`Output file already exists: ${outputFile}`);
        logger.info('Use --overwrite to replace existing files');
        process.exit(1);
      }
    }
    
    // Convert
    const startTime = Date.now();
    const result: ConversionOutput = await converter.convert({
      content,
      format: options.format || 'pdf',
      options: template.options
    });
    const duration = Date.now() - startTime;
    
    // Write output
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, result.data);
    
    spinner.succeed(
      `Converted ${chalk.cyan(path.basename(inputFile))} → ${chalk.green(path.basename(outputFile))} ` +
      `(${formatBytes(result.data.length)}, ${formatDuration(duration)})`
    );
    
    logger.info(`Output saved to: ${outputFile}`);
  } catch (error: any) {
    spinner.fail(`Failed to convert ${path.basename(inputFile)}`);
    throw error;
  }
}

async function convertBatch(
  files: string[],
  converter: any,
  options: ConvertOptions,
  template: any
) {
  const concurrency = parseInt(options.concurrency || '3', 10);
  const progressBar = createProgressBar(files.length);
  
  let completed = 0;
  let failed = 0;
  const results: Array<{ file: string; success: boolean; error?: string }> = [];
  
  // Process files in batches
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    
    await Promise.allSettled(
      batch.map(async (file) => {
        try {
          const content = await fs.readFile(file, 'utf-8');
          
          const outputFile = path.join(
            options.outputDir || path.dirname(file),
            path.basename(file, '.md') + `.${options.format || 'pdf'}`
          );
          
          // Check if output exists
          if (!options.overwrite) {
            const exists = await fs.access(outputFile).then(() => true).catch(() => false);
            if (exists) {
              throw new Error(`Output file already exists: ${outputFile}`);
            }
          }
          
          const result = await converter.convert({
            content,
            format: options.format || 'pdf',
            options: template.options
          });
          
          await fs.mkdir(path.dirname(outputFile), { recursive: true });
          await fs.writeFile(outputFile, result.data);
          
          completed++;
          results.push({ file, success: true });
        } catch (error: any) {
          failed++;
          results.push({ file, success: false, error: error.message });
        } finally {
          progressBar.increment();
        }
      })
    );
  }
  
  progressBar.stop();
  
  // Summary
  console.log('\n' + chalk.bold('Batch Conversion Summary:'));
  console.log(chalk.green(`✅ Successful: ${completed}`));
  if (failed > 0) {
    console.log(chalk.red(`❌ Failed: ${failed}`));
    
    console.log('\n' + chalk.bold('Failed files:'));
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(chalk.red(`  • ${path.basename(r.file)}: ${r.error}`));
      });
  }
  
  console.log(chalk.blue(`📊 Total: ${files.length} files`));
}