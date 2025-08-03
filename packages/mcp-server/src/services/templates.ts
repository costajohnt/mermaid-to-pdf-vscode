/**
 * Template Management Service
 */

import { ConversionTemplate, TemplateInput } from '../types.js';
import { CacheService, generateCacheKey } from './cache.js';

export class TemplateService {
  private templates = new Map<string, ConversionTemplate>();
  
  constructor(
    private cache: CacheService,
    private logger: any
  ) {
    this.initializeBuiltInTemplates();
  }

  async createTemplate(input: TemplateInput): Promise<ConversionTemplate> {
    const template: ConversionTemplate = {
      id: this.generateId(),
      name: input.name,
      description: input.description,
      format: input.format,
      options: input.options,
      ...(input.schema && { schema: input.schema }),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(template.id, template);
    
    // Cache the template
    const cacheKey = generateCacheKey('template', template.id);
    await this.cache.set(cacheKey, template);
    
    this.logger.info({ templateId: template.id, name: template.name }, 'Template created');
    
    return template;
  }

  async getTemplate(id: string): Promise<ConversionTemplate | null> {
    // Check cache first
    const cacheKey = generateCacheKey('template', id);
    let template = await this.cache.get(cacheKey);
    
    if (!template) {
      template = this.templates.get(id);
      if (template) {
        await this.cache.set(cacheKey, template);
      }
    }
    
    return template || null;
  }

  async listTemplates(): Promise<ConversionTemplate[]> {
    return Array.from(this.templates.values());
  }

  async updateTemplate(id: string, updates: Partial<TemplateInput>): Promise<ConversionTemplate | null> {
    const existing = this.templates.get(id);
    if (!existing) {
      return null;
    }

    const updated: ConversionTemplate = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    } as ConversionTemplate;

    this.templates.set(id, updated);
    
    // Update cache
    const cacheKey = generateCacheKey('template', id);
    await this.cache.set(cacheKey, updated);
    
    this.logger.info({ templateId: id }, 'Template updated');
    
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const existed = this.templates.has(id);
    
    if (existed) {
      this.templates.delete(id);
      
      // Remove from cache
      const cacheKey = generateCacheKey('template', id);
      await this.cache.del(cacheKey);
      
      this.logger.info({ templateId: id }, 'Template deleted');
    }
    
    return existed;
  }

  async applyTemplate(template: ConversionTemplate, content: string): Promise<any> {
    // Apply template-specific transformations
    let processedOptions = { ...template.options };
    
    // Dynamic variable substitution
    if (typeof processedOptions === 'object') {
      processedOptions = this.substituteVariables(processedOptions, {
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0] || '',
        content: content.slice(0, 100) // First 100 chars for context
      });
    }
    
    return processedOptions;
  }

  private initializeBuiltInTemplates(): void {
    // PDF Report Template
    this.templates.set('pdf-report', {
      id: 'pdf-report',
      name: 'Professional Report',
      description: 'High-quality PDF report with cover page and table of contents',
      format: 'pdf',
      options: {
        quality: 'high',
        theme: 'light',
        pageSize: 'A4',
        margins: {
          top: '25mm',
          right: '20mm',
          bottom: '25mm',
          left: '20mm'
        },
        includeBackground: true,
        landscape: false
      },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01')
    });

    // PDF Presentation Template
    this.templates.set('pdf-presentation', {
      id: 'pdf-presentation',
      name: 'Presentation Slides',
      description: 'Landscape PDF optimized for presentation slides',
      format: 'pdf',
      options: {
        quality: 'high',
        theme: 'light',
        pageSize: 'A4',
        margins: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm'
        },
        includeBackground: true,
        landscape: true
      },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01')
    });

    // Documentation Template
    this.templates.set('documentation', {
      id: 'documentation',
      name: 'Technical Documentation',
      description: 'Standard template for technical documentation with diagrams',
      format: 'pdf',
      options: {
        quality: 'standard',
        theme: 'light',
        pageSize: 'A4',
        margins: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        includeBackground: true,
        landscape: false
      },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01')
    });

    // Dark Theme Template
    this.templates.set('dark-theme', {
      id: 'dark-theme',
      name: 'Dark Theme Document',
      description: 'Document with dark theme and optimized for code/diagrams',
      format: 'pdf',
      options: {
        quality: 'standard',
        theme: 'dark',
        pageSize: 'A4',
        margins: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        includeBackground: true,
        landscape: false
      },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01')
    });

    this.logger.info({ count: this.templates.size }, 'Built-in templates initialized');
  }

  private generateId(): string {
    return `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private substituteVariables(obj: any, variables: Record<string, string>): any {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] ?? match;
      });
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.substituteVariables(item, variables));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteVariables(value, variables);
      }
      return result;
    }
    
    return obj;
  }

  validateTemplate(template: TemplateInput): string[] {
    const errors: string[] = [];
    
    if (!template.name || typeof template.name !== 'string' || template.name.trim().length === 0) {
      errors.push('Template name is required and must be a non-empty string');
    }
    
    if (!template.description || typeof template.description !== 'string') {
      errors.push('Template description is required and must be a string');
    }
    
    if (!template.format || typeof template.format !== 'string') {
      errors.push('Template format is required and must be a string');
    }
    
    if (!template.options || typeof template.options !== 'object') {
      errors.push('Template options are required and must be an object');
    }
    
    // Validate format-specific options
    if (template.format === 'pdf' && template.options) {
      const { quality, theme, pageSize, margins } = template.options;
      
      if (quality && !['draft', 'standard', 'high'].includes(quality)) {
        errors.push('PDF quality must be one of: draft, standard, high');
      }
      
      if (theme && !['light', 'dark', 'auto'].includes(theme)) {
        errors.push('PDF theme must be one of: light, dark, auto');
      }
      
      if (pageSize && !['A4', 'Letter', 'Legal'].includes(pageSize)) {
        errors.push('PDF page size must be one of: A4, Letter, Legal');
      }
      
      if (margins && typeof margins === 'object') {
        const marginKeys = ['top', 'right', 'bottom', 'left'];
        for (const key of marginKeys) {
          if (margins[key] && typeof margins[key] !== 'string') {
            errors.push(`PDF margin ${key} must be a string (e.g., "20mm")`);
          }
        }
      }
    }
    
    return errors;
  }
}