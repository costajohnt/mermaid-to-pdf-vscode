/**
 * Config command - Manage CLI configuration
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { logger } from '../utils/logger.js';
import { createConfigFile, loadConfig } from '../utils/config.js';
import { listTemplates } from '../utils/templates.js';

export const configCommand = new Command('config')
  .description('Manage CLI configuration')
  .option('-i, --init', 'Create a new configuration file')
  .option('-s, --show', 'Show current configuration')
  .option('-p, --path', 'Show configuration file path')
  .action(async (options) => {
    if (options.init) {
      await initConfig();
    } else if (options.show) {
      await showConfig();
    } else if (options.path) {
      showConfigPath();
    } else {
      // Default to showing config
      await showConfig();
    }
  });

async function initConfig() {
  console.log(chalk.bold('\n🔧 Creating Mermaid Convert Configuration\n'));
  
  const templates = listTemplates();
  
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'defaultFormat',
      message: 'Default output format:',
      choices: ['pdf', 'html', 'png'],
      default: 'pdf'
    },
    {
      type: 'list',
      name: 'defaultTemplate',
      message: 'Default template:',
      choices: templates.map(t => ({
        name: `${t.name} - ${t.description}`,
        value: t.name
      })),
      default: 'default'
    },
    {
      type: 'input',
      name: 'outputDirectory',
      message: 'Default output directory:',
      default: '.'
    },
    {
      type: 'confirm',
      name: 'overwrite',
      message: 'Overwrite existing files by default?',
      default: false
    },
    {
      type: 'number',
      name: 'concurrency',
      message: 'Number of concurrent conversions:',
      default: 3,
      validate: (value) => value > 0 && value <= 10
    },
    {
      type: 'list',
      name: 'configLocation',
      message: 'Where to save the configuration?',
      choices: [
        { name: 'Current directory (.mermaid-convertrc.json)', value: '.mermaid-convertrc.json' },
        { name: 'Package.json (mermaid-convert field)', value: 'package.json' },
        { name: 'Custom location', value: 'custom' }
      ]
    }
  ]);
  
  let configPath = answers.configLocation;
  
  if (configPath === 'custom') {
    const { customPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customPath',
        message: 'Enter configuration file path:',
        default: '.mermaid-convertrc.json'
      }
    ]);
    configPath = customPath;
  }
  
  if (configPath === 'package.json') {
    // TODO: Implement package.json configuration
    logger.warn('Package.json configuration not yet implemented');
    configPath = '.mermaid-convertrc.json';
  }
  
  const config = {
    defaultFormat: answers.defaultFormat,
    defaultTemplate: answers.defaultTemplate,
    outputDirectory: answers.outputDirectory,
    overwrite: answers.overwrite,
    concurrency: answers.concurrency
  };
  
  createConfigFile(configPath, config);
  
  console.log('\n' + chalk.green('✓ Configuration created successfully!'));
  console.log('\n' + chalk.cyan('Example usage with your configuration:'));
  console.log('  mermaid-convert docs/*.md --batch');
}

async function showConfig() {
  const config = await loadConfig();
  
  console.log(chalk.bold('\n⚙️  Current Configuration:\n'));
  console.log(JSON.stringify(config, null, 2));
  
  console.log('\n' + chalk.gray('Run "mermaid-convert config --init" to create or update configuration'));
}

function showConfigPath() {
  const cosmiconfigSync = require('cosmiconfig').cosmiconfigSync;
  const explorer = cosmiconfigSync('mermaid-convert');
  const result = explorer.search();
  
  if (result) {
    console.log(chalk.cyan('Configuration file:'), result.filepath);
  } else {
    console.log(chalk.yellow('No configuration file found'));
    console.log(chalk.gray('Run "mermaid-convert config --init" to create one'));
  }
}