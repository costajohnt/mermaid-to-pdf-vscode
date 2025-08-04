/**
 * Configuration management
 */

import { cosmiconfigSync } from 'cosmiconfig';
import { logger } from './logger.js';

export interface CLIConfig {
  defaultFormat?: string;
  defaultTemplate?: string;
  outputDirectory?: string;
  overwrite?: boolean;
  concurrency?: number;
  templates?: Record<string, any>;
}

const DEFAULT_CONFIG: CLIConfig = {
  defaultFormat: 'pdf',
  defaultTemplate: 'default',
  outputDirectory: '.',
  overwrite: false,
  concurrency: 3
};

export async function loadConfig(): Promise<CLIConfig> {
  try {
    const explorer = cosmiconfigSync('mermaid-convert');
    const result = explorer.search();
    
    if (result) {
      logger.debug(`Loaded config from: ${result.filepath}`);
      return { ...DEFAULT_CONFIG, ...result.config };
    }
  } catch (error: any) {
    logger.warn(`Failed to load config: ${error.message}`);
  }
  
  return DEFAULT_CONFIG;
}

export function createConfigFile(filePath: string, config: CLIConfig): void {
  const fs = require('fs');
  const configContent = `{
  "defaultFormat": "${config.defaultFormat || 'pdf'}",
  "defaultTemplate": "${config.defaultTemplate || 'default'}",
  "outputDirectory": "${config.outputDirectory || '.'}",
  "overwrite": ${config.overwrite || false},
  "concurrency": ${config.concurrency || 3},
  "templates": {}
}`;

  fs.writeFileSync(filePath, configContent, 'utf-8');
  logger.success(`Config file created: ${filePath}`);
}