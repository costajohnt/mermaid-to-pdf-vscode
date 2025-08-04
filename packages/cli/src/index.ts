#!/usr/bin/env node

/**
 * Mermaid Converter CLI
 * 
 * Command-line tool for converting Markdown with Mermaid diagrams to various formats
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createConverter } from 'mermaid-converter-core';
import { convertCommand } from './commands/convert.js';
import { watchCommand } from './commands/watch.js';
import { templatesCommand } from './commands/templates.js';
import { configCommand } from './commands/config.js';
import { loadConfig } from './utils/config.js';
import { logger } from './utils/logger.js';
import { VERSION } from './version.js';

// ASCII art logo
const logo = chalk.cyan(`
╔═╗┌─┐┬─┐┌┬┐┌─┐┬┌┬┐  ╔═╗┌─┐┌┐┌┬  ┬┌─┐┬─┐┌┬┐┌─┐┬─┐
║║║├┤ ├┬┘│││├─┤│ ││  ║  │ ││││└┐┌┘├┤ ├┬┘ │ ├┤ ├┬┘
╩ ╩└─┘┴└─┴ ┴┴ ┴┴─┴┘  ╚═╝└─┘┘└┘ └┘ └─┘┴└─ ┴ └─┘┴└─
`);

async function main() {
  // Load configuration
  const config = await loadConfig();
  
  // Create main program
  const program = new Command();
  
  program
    .name('mermaid-convert')
    .description('Convert Markdown with Mermaid diagrams to various formats')
    .version(VERSION)
    .hook('preAction', () => {
      if (!program.opts().quiet) {
        console.log(logo);
      }
    });

  // Global options
  program
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--no-color', 'Disable colored output');

  // Add commands
  program.addCommand(convertCommand);
  program.addCommand(watchCommand);
  program.addCommand(templatesCommand);
  program.addCommand(configCommand);

  // Default action (show help)
  program.action(() => {
    program.help();
  });

  // Error handling
  program.exitOverride();
  
  try {
    await program.parseAsync(process.argv);
  } catch (error: any) {
    if (error.code === 'commander.unknownCommand') {
      logger.error(`Unknown command: ${error.message}`);
      console.log('\nRun', chalk.cyan('mermaid-convert --help'), 'for usage information.');
    } else if (error.code === 'commander.help') {
      // Help was displayed, exit cleanly
      process.exit(0);
    } else {
      logger.error('Command failed:', error.message);
      if (program.opts().verbose) {
        console.error(error);
      }
    }
    process.exit(1);
  }
}

// Run CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Fatal error:', error.message);
    process.exit(1);
  });
}