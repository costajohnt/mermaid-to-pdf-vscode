/**
 * Logger utility for CLI output
 */

import chalk from 'chalk';
import winston from 'winston';

// Console logger for user-facing messages
class CLILogger {
  private quiet = false;
  private verbose = false;

  setQuiet(quiet: boolean) {
    this.quiet = quiet;
  }

  setVerbose(verbose: boolean) {
    this.verbose = verbose;
  }

  info(...args: any[]) {
    if (!this.quiet) {
      console.log(chalk.blue('ℹ'), ...args);
    }
  }

  success(...args: any[]) {
    if (!this.quiet) {
      console.log(chalk.green('✓'), ...args);
    }
  }

  warn(...args: any[]) {
    console.warn(chalk.yellow('⚠'), ...args);
  }

  error(...args: any[]) {
    console.error(chalk.red('✖'), ...args);
  }

  debug(...args: any[]) {
    if (this.verbose) {
      console.log(chalk.gray('🐛'), ...args);
    }
  }

  log(...args: any[]) {
    if (!this.quiet) {
      console.log(...args);
    }
  }
}

// File logger for detailed debugging
const fileLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'mermaid-convert-error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'mermaid-convert.log'
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  fileLogger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export const logger = new CLILogger();
export { fileLogger };