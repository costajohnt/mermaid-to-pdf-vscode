/**
 * Template management utilities
 */

export interface CLITemplate {
  name: string;
  description: string;
  options: any;
}

export const BUILT_IN_TEMPLATES: Record<string, CLITemplate> = {
  default: {
    name: 'Default',
    description: 'Standard PDF output with professional formatting',
    options: {
      quality: 'standard',
      theme: 'light',
      pageSize: 'A4',
      margins: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      includeBackground: true,
      landscape: false
    }
  },
  report: {
    name: 'Professional Report',
    description: 'High-quality PDF report with generous margins',
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
    }
  },
  presentation: {
    name: 'Presentation',
    description: 'Landscape format optimized for slides',
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
    }
  },
  documentation: {
    name: 'Technical Documentation',
    description: 'Optimized for technical docs with code and diagrams',
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
    }
  },
  dark: {
    name: 'Dark Theme',
    description: 'Dark theme optimized for code and diagrams',
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
    }
  },
  compact: {
    name: 'Compact',
    description: 'Minimal margins for maximum content',
    options: {
      quality: 'standard',
      theme: 'light',
      pageSize: 'A4',
      margins: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      includeBackground: true,
      landscape: false
    }
  }
};

export async function getTemplate(name: string): Promise<CLITemplate> {
  // Check built-in templates
  if (BUILT_IN_TEMPLATES[name]) {
    return BUILT_IN_TEMPLATES[name];
  }

  // TODO: Load custom templates from config file
  
  // Default to 'default' template
  return BUILT_IN_TEMPLATES.default;
}

export function listTemplates(): Array<{ name: string; description: string }> {
  return Object.entries(BUILT_IN_TEMPLATES).map(([key, template]) => ({
    name: key,
    description: template.description
  }));
}