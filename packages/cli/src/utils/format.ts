/**
 * Formatting utilities
 */

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

export function formatList(items: string[], indent = '  '): string {
  return items.map(item => `${indent}• ${item}`).join('\n');
}

export function truncatePath(filePath: string, maxLength = 50): string {
  if (filePath.length <= maxLength) {
    return filePath;
  }
  
  const fileName = filePath.split('/').pop() || '';
  if (fileName.length >= maxLength) {
    return '...' + fileName.slice(-(maxLength - 3));
  }
  
  const remainingLength = maxLength - fileName.length - 3;
  const pathStart = filePath.slice(0, remainingLength);
  
  return pathStart + '...' + fileName;
}