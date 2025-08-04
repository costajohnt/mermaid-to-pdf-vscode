/**
 * Watch command - Monitor files for changes and convert automatically
 */

import { Command } from 'commander';
import chalk from 'chalk';
import chokidar from 'chokidar';
import path from 'path';
import { 
  createConverter, 
  PDFGenerator, 
  MermaidRenderer 
} from 'mermaid-converter-core';
import { logger } from '../utils/logger.js';
import { getTemplate } from '../utils/templates.js';
import { formatBytes, formatDuration } from '../utils/format.js';
import fs from 'fs/promises';

interface WatchOptions {
  format?: string;
  outputDir?: string;
  template?: string;
  ignore?: string;
  debounce?: string;
  verbose?: boolean;
}

export const watchCommand = new Command('watch')
  .description('Watch Markdown files and convert on changes')
  .argument('<path>', 'Directory or file pattern to watch')
  .option('-f, --format <format>', 'Output format', 'pdf')
  .option('-d, --output-dir <dir>', 'Output directory', '.')
  .option('-t, --template <name>', 'Template to use', 'default')
  .option('-i, --ignore <pattern>', 'Ignore pattern', 'node_modules/**')
  .option('--debounce <ms>', 'Debounce delay in milliseconds', '300')
  .action(async (watchPath: string, options: WatchOptions) => {
    const converter = createConverter();
    
    // Register generators and renderers
    converter.registerGenerator(new PDFGenerator());
    converter.registerRenderer(new MermaidRenderer());
    
    const template = await getTemplate(options.template || 'default');
    const debounceMs = parseInt(options.debounce || '300', 10);
    const conversionQueue = new Map<string, NodeJS.Timeout>();
    
    logger.info(`Watching for changes in: ${chalk.cyan(watchPath)}`);
    logger.info(`Output format: ${chalk.cyan(options.format || 'pdf')}`);
    logger.info(`Template: ${chalk.cyan(options.template || 'default')}`);
    logger.info(`Output directory: ${chalk.cyan(options.outputDir || '.')}`);
    console.log(chalk.gray('\nPress Ctrl+C to stop watching...\n'));
    
    // Initialize watcher
    const watcher = chokidar.watch(watchPath, {
      ignored: options.ignore || 'node_modules/**',
      persistent: true,
      ignoreInitial: true
    });
    
    // File change handler
    const handleFileChange = async (filePath: string) => {
      if (!filePath.endsWith('.md')) return;
      
      // Clear existing timeout for this file
      if (conversionQueue.has(filePath)) {
        clearTimeout(conversionQueue.get(filePath)!);
      }
      
      // Debounce conversion
      const timeout = setTimeout(async () => {
        conversionQueue.delete(filePath);
        await convertFile(filePath, converter, options, template);
      }, debounceMs);
      
      conversionQueue.set(filePath, timeout);
    };
    
    // Watch events
    watcher
      .on('add', (filePath) => {
        logger.info(`File added: ${chalk.green(path.basename(filePath))}`);
        handleFileChange(filePath);
      })
      .on('change', (filePath) => {
        logger.info(`File changed: ${chalk.yellow(path.basename(filePath))}`);
        handleFileChange(filePath);
      })
      .on('unlink', (filePath) => {
        logger.info(`File removed: ${chalk.red(path.basename(filePath))}`);
        if (conversionQueue.has(filePath)) {
          clearTimeout(conversionQueue.get(filePath)!);
          conversionQueue.delete(filePath);
        }
      })
      .on('error', (error) => {
        logger.error('Watcher error:', error.message);
      });
    
    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\n\n' + chalk.yellow('Stopping file watcher...'));
      watcher.close();
      
      // Clear all pending conversions
      for (const timeout of conversionQueue.values()) {
        clearTimeout(timeout);
      }
      
      logger.success('Watch mode stopped');
      process.exit(0);
    });
  });

async function convertFile(
  inputFile: string,
  converter: any,
  options: WatchOptions,
  template: any
) {
  const startTime = Date.now();
  const fileName = path.basename(inputFile);
  
  try {
    // Read input file
    const content = await fs.readFile(inputFile, 'utf-8');
    
    // Determine output file
    const outputFile = path.join(
      options.outputDir || path.dirname(inputFile),
      path.basename(inputFile, '.md') + `.${options.format || 'pdf'}`
    );
    
    // Convert
    const result = await converter.convert({
      content,
      format: options.format || 'pdf',
      options: template.options
    });
    
    // Write output
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, result.data);
    
    const duration = Date.now() - startTime;
    
    logger.success(
      `Converted ${chalk.cyan(fileName)} → ${chalk.green(path.basename(outputFile))} ` +
      `(${formatBytes(result.data.length)}, ${formatDuration(duration)})`
    );
  } catch (error: any) {
    logger.error(`Failed to convert ${fileName}: ${error.message}`);
    if (options.verbose) {
      console.error(error);
    }
  }
}