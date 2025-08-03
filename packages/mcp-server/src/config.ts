/**
 * Server Configuration Management
 */

import { ServerConfig } from './types.js';

export function createDefaultConfig(): ServerConfig {
  const config = {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    
    cache: {
      enabled: process.env.CACHE_ENABLED !== 'false',
      ttl: parseInt(process.env.CACHE_TTL || '3600'), // 1 hour
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '100'), // 100MB
      backend: (process.env.CACHE_BACKEND as 'memory' | 'redis') || 'memory'
    },
    
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true'
    },
    
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: process.env.CORS_CREDENTIALS === 'true'
    },
    
    auth: {
      enabled: process.env.AUTH_ENABLED === 'true',
      ...(process.env.API_KEY && { apiKey: process.env.API_KEY }),
      ...(process.env.JWT_SECRET && { 
        jwt: {
          secret: process.env.JWT_SECRET,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      })
    },
    
    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      metricsPath: process.env.METRICS_PATH || '/metrics'
    }
  };

  // Add Redis config if needed
  if (config.cache.backend === 'redis') {
    (config.cache as any).redis = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
      ...(process.env.REDIS_DB && { db: parseInt(process.env.REDIS_DB) })
    };
  }

  return config;
}

export function validateConfig(config: ServerConfig): void {
  // Validate cache configuration
  if (config.cache.enabled && config.cache.backend === 'redis' && !config.cache.redis) {
    throw new Error('Redis configuration is required when cache backend is redis');
  }
  
  // Validate auth configuration
  if (config.auth?.enabled && !config.auth.apiKey && !config.auth.jwt) {
    throw new Error('API key or JWT configuration is required when auth is enabled');
  }
  
  // Validate rate limiting
  if (config.rateLimit.enabled && (config.rateLimit.windowMs <= 0 || config.rateLimit.maxRequests <= 0)) {
    throw new Error('Rate limit window and max requests must be positive numbers');
  }
}

export function logConfig(config: ServerConfig, logger: any): void {
  logger.info({
    port: config.port,
    host: config.host,
    cache: {
      enabled: config.cache.enabled,
      backend: config.cache.backend,
      ttl: config.cache.ttl,
      maxSize: config.cache.maxSize
    },
    rateLimit: {
      enabled: config.rateLimit.enabled,
      windowMs: config.rateLimit.windowMs,
      maxRequests: config.rateLimit.maxRequests
    },
    auth: {
      enabled: config.auth?.enabled || false
    },
    monitoring: {
      enabled: config.monitoring?.enabled || false
    }
  }, 'Server configuration loaded');
}