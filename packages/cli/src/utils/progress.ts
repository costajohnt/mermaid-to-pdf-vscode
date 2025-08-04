/**
 * Progress bar utilities
 */

import cliProgress from 'cli-progress';
import chalk from 'chalk';

export function createProgressBar(total: number) {
  const bar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} files | {eta_formatted}',
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
    clearOnComplete: false,
    stopOnComplete: true
  }, cliProgress.Presets.shades_classic);

  bar.start(total, 0);
  
  return bar;
}

export function createSpinner(message: string) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i]} ${message}`);
    i = (i + 1) % frames.length;
  }, 80);
  
  return {
    stop: () => {
      clearInterval(interval);
      process.stdout.write('\r' + ' '.repeat(message.length + 3) + '\r');
    }
  };
}