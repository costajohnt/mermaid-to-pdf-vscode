export interface ConversionOptions {
  title?: string;
  quality?: 'draft' | 'standard' | 'high';
  theme?: 'light' | 'dark' | 'auto';
  pageSize?: 'A4' | 'Letter' | 'Legal';
  margins?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
}

export interface ConversionResult {
  pdfBase64: string;
  metadata: {
    pageCount: number;
    fileSize: number;
    diagramCount: number;
    processingTime: number;
  };
}

export interface FileConversionResult {
  outputPath: string;
  metadata: ConversionResult['metadata'];
}

export interface MermaidDiagram {
  index: number;
  code: string;
  imageBase64: string;
  format: 'png' | 'svg';
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface CacheEntry {
  imageBase64: string;
  timestamp: number;
  hash: string;
}