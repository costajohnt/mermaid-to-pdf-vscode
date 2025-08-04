/**
 * Enhanced Caching Service
 */

import { createHash } from 'crypto';
import Redis from 'ioredis';
import { CacheConfig } from '../types.js';

export interface CacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): CacheStats;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
}

export class MemoryCacheService implements CacheService {
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0 };
  
  constructor(private config: CacheConfig) {}
  
  async get(key: string): Promise<any> {
    const entry = this.cache.get(key);
    
    if (!entry || this.isExpired(entry)) {
      this.stats.misses++;
      this.cache.delete(key);
      return null;
    }
    
    this.stats.hits++;
    entry.lastAccessed = Date.now();
    return entry.value;
  }
  
  async set(key: string, value: any, ttl = this.config.ttl): Promise<void> {
    // Check size limits
    this.evictIfNeeded();
    
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      ttl: ttl * 1000 // Convert to milliseconds
    });
  }
  
  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
  }
  
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      size: this.cache.size,
      maxSize: this.config.maxSize * 1024 * 1024 // Convert MB to bytes estimate
    };
  }
  
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt > entry.ttl;
  }
  
  private evictIfNeeded(): void {
    // Simple LRU eviction - remove oldest accessed entries if we're getting too large
    if (this.cache.size > 1000) { // Arbitrary limit for memory cache
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
        .slice(0, 100); // Remove oldest 100 entries
      
      entries.forEach(([key]) => this.cache.delete(key));
    }
  }
}

export class RedisCacheService implements CacheService {
  private redis: Redis;
  private stats = { hits: 0, misses: 0 };
  
  constructor(private config: CacheConfig) {
    if (!config.redis) {
      throw new Error('Redis configuration is required');
    }
    
    const redisOptions: any = {
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db || 0,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3
    };
    
    if (config.redis.password) {
      redisOptions.password = config.redis.password;
    }
    
    this.redis = new Redis(redisOptions);
  }
  
  async get(key: string): Promise<any> {
    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      return JSON.parse(value);
    } catch (error) {
      this.stats.misses++;
      return null;
    }
  }
  
  async set(key: string, value: any, ttl = this.config.ttl): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      // Log error but don't throw - cache failures shouldn't break conversions
      console.error('Cache set error:', error);
    }
  }
  
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }
  
  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
  
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      size: 0, // Would need Redis INFO command to get actual size
      maxSize: this.config.maxSize * 1024 * 1024
    };
  }
}

interface CacheEntry {
  value: any;
  createdAt: number;
  lastAccessed: number;
  ttl: number;
}

export function createCacheService(config: CacheConfig): CacheService {
  if (!config.enabled) {
    return new NullCacheService();
  }
  
  switch (config.backend) {
    case 'redis':
      return new RedisCacheService(config);
    case 'memory':
    default:
      return new MemoryCacheService(config);
  }
}

class NullCacheService implements CacheService {
  async get(): Promise<any> { return null; }
  async set(): Promise<void> { }
  async del(): Promise<void> { }
  async clear(): Promise<void> { }
  getStats(): CacheStats {
    return { hits: 0, misses: 0, hitRate: 0, size: 0, maxSize: 0 };
  }
}

export function generateCacheKey(prefix: string, data: any): string {
  const hash = createHash('sha256');
  
  if (typeof data === 'string') {
    hash.update(data);
  } else {
    hash.update(JSON.stringify(data));
  }
  
  return `${prefix}:${hash.digest('hex').substring(0, 16)}`;
}