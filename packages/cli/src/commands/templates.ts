/**
 * Templates command - List and manage templates
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../utils/logger.js';
import { listTemplates, BUILT_IN_TEMPLATES } from '../utils/templates.js';

export const templatesCommand = new Command('templates')
  .description('List and manage conversion templates')
  .option('-l, --list', 'List all available templates', true)
  .option('-s, --show <name>', 'Show details for a specific template')
  .option('-i, --interactive', 'Interactive template selection')
  .action(async (options) => {
    if (options.show) {
      await showTemplate(options.show);
    } else if (options.interactive) {
      await interactiveTemplateSelection();
    } else {
      await listAllTemplates();
    }
  });

async function listAllTemplates() {
  const templates = listTemplates();
  
  console.log(chalk.bold('\n📋 Available Templates:\n'));
  
  for (const template of templates) {
    console.log(
      chalk.cyan(`  ${template.name.padEnd(20)}`),
      chalk.gray(template.description)
    );
  }
  
  console.log('\n' + chalk.gray('Use "mermaid-convert templates --show <name>" for details'));
}

async function showTemplate(name: string) {
  const template = BUILT_IN_TEMPLATES[name];
  
  if (!template) {
    logger.error(`Template not found: ${name}`);
    console.log('\nAvailable templates:', Object.keys(BUILT_IN_TEMPLATES).join(', '));
    process.exit(1);
  }
  
  console.log(chalk.bold(`\n📋 Template: ${template.name}\n`));
  console.log(chalk.gray(template.description));
  console.log('\n' + chalk.bold('Options:'));
  console.log(JSON.stringify(template.options, null, 2));
}

async function interactiveTemplateSelection() {
  const templates = listTemplates();
  
  const { selectedTemplate } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedTemplate',
      message: 'Select a template:',
      choices: templates.map(t => ({
        name: `${t.name} - ${t.description}`,
        value: t.name
      }))
    }
  ]);
  
  await showTemplate(selectedTemplate);
  
  const { useTemplate } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useTemplate',
      message: 'Would you like to use this template in a conversion?',
      default: false
    }
  ]);
  
  if (useTemplate) {
    console.log('\n' + chalk.cyan('Example usage:'));
    console.log(`  mermaid-convert input.md -t ${selectedTemplate}`);
  }
}