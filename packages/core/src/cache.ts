/**
 * Cache Manager for diagram rendering results
 * 
 * Provides intelligent caching of rendered diagrams to improve performance
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CacheConfig, RenderedDiagram } from './types';

export class CacheManager {
  private config: CacheConfig;
  private cache = new Map<string, CacheEntry>();
  private cacheDir: string;
  private stats = {
    hits: 0,
    misses: 0,
    totalSize: 0
  };

  constructor(config: CacheConfig) {
    this.config = config;
    this.cacheDir = config.directory || join(tmpdir(), 'mermaid-converter-cache');
    this.ensureCacheDir();
  }

  /**
   * Get cached item by hash
   */
  async get(hash: string): Promise<RenderedDiagram | null> {
    const entry = this.cache.get(hash);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      await this.delete(hash);
      this.stats.misses++;
      return null;
    }

    // Update access time
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    // Load from disk if not in memory
    if (!entry.data) {
      try {
        const filePath = join(this.cacheDir, `${hash}.json`);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        entry.data = JSON.parse(fileContent);
      } catch (error) {
        // File not found or corrupted, remove from cache
        await this.delete(hash);
        this.stats.misses++;
        return null;
      }
    }

    return entry.data;
  }

  /**
   * Store item in cache
   */
  async set(hash: string, data: RenderedDiagram): Promise<void> {
    const now = Date.now();
    const size = this.estimateSize(data);

    // Check cache size limits
    if (this.config.maxSize && (this.stats.totalSize + size) > this.config.maxSize * 1024 * 1024) {
      await this.evictOldEntries();
    }

    const entry: CacheEntry = {
      hash,
      data,
      createdAt: now,
      lastAccessed: now,
      size,
      ttl: this.config.ttl || 3600
    };

    // Store in memory
    this.cache.set(hash, entry);
    this.stats.totalSize += size;

    // Store on disk
    try {
      const filePath = join(this.cacheDir, `${hash}.json`);
      await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
    } catch (error) {
      console.warn('Failed to write cache to disk:', error);
      // Continue with memory-only caching
    }
  }

  /**
   * Delete item from cache
   */
  async delete(hash: string): Promise<void> {
    const entry = this.cache.get(hash);
    if (entry) {
      this.cache.delete(hash);
      this.stats.totalSize -= entry.size;

      // Remove from disk
      try {
        const filePath = join(this.cacheDir, `${hash}.json`);
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, ignore error
      }
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, totalSize: 0 };

    // Clear disk cache
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(file => fs.unlink(join(this.cacheDir, file)).catch(() => {}))
      );
    } catch (error) {
      // Directory might not exist, ignore error
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      totalEntries: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      totalSize: this.stats.totalSize,
      memoryUsage: this.formatBytes(this.stats.totalSize),
      hits: this.stats.hits,
      misses: this.stats.misses
    };
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create cache directory:', error);
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.ttl) return false;
    return (Date.now() - entry.createdAt) > (entry.ttl * 1000);
  }

  /**
   * Estimate size of cached data
   */
  private estimateSize(data: RenderedDiagram): number {
    // Rough estimation: base64 string length + metadata
    return data.dataUrl.length + JSON.stringify(data.info).length + 1000;
  }

  /**
   * Evict old entries to make space
   */
  private async evictOldEntries(): Promise<void> {
    // Sort by last accessed time (LRU)
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const entry = entries[i];
      if (entry) {
        const [hash] = entry;
        await this.delete(hash);
      }
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

interface CacheEntry {
  hash: string;
  data: RenderedDiagram;
  createdAt: number;
  lastAccessed: number;
  size: number;
  ttl?: number;
}