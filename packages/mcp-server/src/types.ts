/**
 * Enhanced MCP Server Types
 */

import { ConversionInput, ConversionOutput } from '@mermaid-converter/core';

// Extended conversion types
export interface BatchConversionInput {
  files: ConversionInput[];
  options?: BatchOptions;
}

export interface BatchOptions {
  concurrency?: number;
  continueOnError?: boolean;
  outputFormat?: string;
  template?: string;
}

export interface BatchConversionResult {
  success: boolean;
  results: ConversionResult[];
  errors: ConversionError[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    processingTime: number;
  };
}

export interface ConversionResult {
  input: ConversionInput;
  output?: ConversionOutput;
  error?: string;
  processingTime: number;
}

export interface ConversionError {
  file: string;
  error: string;
  timestamp: Date;
}

// Template system types
export interface ConversionTemplate {
  id: string;
  name: string;
  description: string;
  format: string;
  options: Record<string, any>;
  schema?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateInput {
  name: string;
  description: string;
  format: string;
  options: Record<string, any>;
  schema?: Record<string, any>;
}

// Enhanced tool results
export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    processingTime?: number;
    cacheHit?: boolean;
    version?: string;
  };
}

// Cache configuration
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // seconds
  maxSize: number; // MB
  backend: 'memory' | 'redis';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

// Rate limiting configuration
export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}

// Server configuration
export interface ServerConfig {
  port?: number;
  host?: string;
  cache: CacheConfig;
  rateLimit: RateLimitConfig;
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  auth?: {
    enabled: boolean;
    apiKey?: string;
    jwt?: {
      secret: string;
      expiresIn: string;
    };
  };
  monitoring?: {
    enabled: boolean;
    metricsPath?: string;
  };
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: {
    converter: ServiceStatus;
    cache: ServiceStatus;
    browser: ServiceStatus;
  };
  metrics: {
    totalConversions: number;
    successRate: number;
    averageProcessingTime: number;
    cacheHitRate: number;
  };
}

export interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  message?: string;
}

// Webhook types
export interface WebhookConfig {
  enabled: boolean;
  url: string;
  secret?: string;
  events: WebhookEvent[];
}

export type WebhookEvent = 
  | 'conversion.started'
  | 'conversion.completed'
  | 'conversion.failed'
  | 'batch.started'
  | 'batch.completed';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: Date;
  data: any;
}

// Metrics types
export interface ConversionMetrics {
  totalConversions: number;
  successfulConversions: number;
  failedConversions: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  uptime: number;
  errorRate: number;
}