/**
 * Core types and interfaces for the Mermaid Converter system
 */

// Base conversion input/output types
export interface ConversionInput {
  /** Markdown content to convert */
  content: string;
  /** Output format */
  format: string;
  /** Optional input metadata */
  metadata?: {
    title?: string;
    author?: string;
    filename?: string;
  };
  /** Format-specific options */
  options?: Record<string, any>;
}

export interface ConversionOutput {
  /** Output format */
  format: string;
  /** Output data (could be buffer, base64, file path, etc.) */
  data: Buffer | string;
  /** MIME type of the output */
  mimeType: string;
  /** Additional metadata about the output */
  metadata?: {
    size?: number;
    pages?: number;
    diagrams?: number;
    processingTime?: number;
  };
}

// Parsed content structure
export interface ParsedContent {
  /** Document title (from first H1 or metadata) */
  title: string;
  /** Structured content sections */
  sections: ContentSection[];
  /** All diagrams found in the document */
  diagrams: DiagramInfo[];
  /** Document metadata */
  metadata: DocumentMetadata;
}

export interface ContentSection {
  /** Section type */
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'diagram' | 'table' | 'blockquote';
  /** Section level (for headings: 1-6) */
  level?: number;
  /** Section content */
  content: string;
  /** Original markdown */
  markdown: string;
  /** Children sections (for nested content) */
  children?: ContentSection[];
}

export interface DiagramInfo {
  /** Unique identifier for this diagram */
  id: string;
  /** Diagram type (mermaid, plantuml, etc.) */
  type: 'mermaid' | 'plantuml' | 'graphviz' | 'custom';
  /** Raw diagram code */
  code: string;
  /** Content hash for caching */
  hash: string;
  /** Position in document */
  position: number;
  /** Diagram title/caption if available */
  title?: string;
}

export interface RenderedDiagram {
  /** Diagram info */
  info: DiagramInfo;
  /** Rendered image data */
  imageData: Buffer;
  /** Image format */
  format: 'png' | 'svg' | 'jpg';
  /** Image dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  /** Base64 encoded data URL */
  dataUrl: string;
}

export interface DocumentMetadata {
  /** Document title */
  title?: string;
  /** Document author */
  author?: string;
  /** Creation date */
  createdAt?: Date;
  /** Last modified date */
  modifiedAt?: Date;
  /** Document tags */
  tags?: string[];
  /** Word count */
  wordCount?: number;
  /** Reading time estimate (minutes) */
  readingTime?: number;
}

// Plugin system interfaces
export interface OutputGenerator {
  /** Unique format identifier */
  format: string;
  /** Human-readable format name */
  name: string;
  /** Format description */
  description: string;
  /** Supported options schema */
  optionsSchema?: Record<string, any>;
  /** Generate output from parsed content */
  generate(content: ParsedContent, diagrams: RenderedDiagram[], options?: any): Promise<ConversionOutput>;
}

export interface DiagramRenderer {
  /** Supported diagram types */
  supportedTypes: string[];
  /** Render diagram to image */
  render(diagram: DiagramInfo, options?: RenderOptions): Promise<RenderedDiagram>;
  /** Validate diagram syntax */
  validate(code: string, type: string): Promise<ValidationResult>;
}

export interface RenderOptions {
  /** Output format */
  format?: 'png' | 'svg' | 'jpg';
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
  /** Theme */
  theme?: 'light' | 'dark' | 'neutral';
  /** Background color */
  backgroundColor?: string;
  /** Scale factor for high-DPI */
  scale?: number;
}

export interface ValidationResult {
  /** Is the diagram valid */
  valid: boolean;
  /** Error messages if invalid */
  errors: string[];
  /** Warning messages */
  warnings: string[];
}

// Converter configuration
export interface ConverterConfig {
  /** Default output format */
  defaultFormat: string;
  /** Available output generators */
  generators: Map<string, OutputGenerator>;
  /** Available diagram renderers */
  renderers: Map<string, DiagramRenderer>;
  /** Caching configuration */
  cache?: CacheConfig;
  /** Performance settings */
  performance?: PerformanceConfig;
}

export interface CacheConfig {
  /** Enable caching */
  enabled: boolean;
  /** Maximum cache size in MB */
  maxSize?: number;
  /** Cache TTL in seconds */
  ttl?: number;
  /** Cache directory */
  directory?: string;
}

export interface PerformanceConfig {
  /** Maximum concurrent operations */
  maxConcurrency?: number;
  /** Browser pool size */
  browserPoolSize?: number;
  /** Processing timeout in ms */
  timeout?: number;
}

// Error types
export class ConversionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ConversionError';
  }
}

export class DiagramRenderError extends ConversionError {
  constructor(
    message: string,
    public diagramId: string,
    public diagramType: string,
    details?: any
  ) {
    super(message, 'DIAGRAM_RENDER_ERROR', details);
    this.name = 'DiagramRenderError';
  }
}

export class ValidationError extends ConversionError {
  constructor(
    message: string,
    public validationErrors: string[],
    details?: any
  ) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

// Event system types
export interface ConversionEvent {
  type: 'start' | 'progress' | 'diagram_rendered' | 'complete' | 'error';
  timestamp: Date;
  data?: any;
}

export interface ProgressEvent extends ConversionEvent {
  type: 'progress';
  data: {
    step: string;
    progress: number; // 0-100
    message: string;
  };
}

export interface DiagramRenderedEvent extends ConversionEvent {
  type: 'diagram_rendered';
  data: {
    diagramId: string;
    renderTime: number;
    fromCache: boolean;
  };
}

export type EventHandler = (event: ConversionEvent) => void;