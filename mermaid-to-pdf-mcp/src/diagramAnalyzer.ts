import { ConversionOptions } from './types.js';

export interface DiagramAnalysis {
  type: DiagramType;
  complexity: ComplexityLevel;
  estimatedDimensions: {
    width: number;
    height: number;
  };
  recommendedViewport: {
    width: number;
    height: number;
    deviceScaleFactor: number;
  };
  mermaidConfig: any;
}

export type DiagramType = 
  | 'flowchart' 
  | 'sequence' 
  | 'classDiagram' 
  | 'stateDiagram' 
  | 'erDiagram' 
  | 'gantt' 
  | 'pie' 
  | 'journey' 
  | 'gitgraph'
  | 'mindmap'
  | 'timeline'
  | 'unknown';

export type ComplexityLevel = 'simple' | 'medium' | 'complex' | 'very-complex';

export class DiagramAnalyzer {
  
  analyze(mermaidCode: string, pageSize: string = 'A4'): DiagramAnalysis {
    const type = this.detectDiagramType(mermaidCode);
    const complexity = this.calculateComplexity(mermaidCode, type);
    const pageConstraints = this.getPageConstraints(pageSize);
    
    const baseDimensions = this.getBaseDimensions(type, complexity);
    const estimatedDimensions = this.adjustForContent(mermaidCode, type, baseDimensions);
    const constrainedDimensions = this.applyPageConstraints(estimatedDimensions, pageConstraints);
    
    const recommendedViewport = this.calculateViewport(constrainedDimensions, complexity);
    const mermaidConfig = this.generateMermaidConfig(type, constrainedDimensions, complexity);
    
    return {
      type,
      complexity,
      estimatedDimensions: constrainedDimensions,
      recommendedViewport,
      mermaidConfig
    };
  }

  private detectDiagramType(code: string): DiagramType {
    const trimmed = code.trim();
    
    if (trimmed.startsWith('flowchart') || trimmed.startsWith('graph')) return 'flowchart';
    if (trimmed.startsWith('sequenceDiagram')) return 'sequence';
    if (trimmed.startsWith('classDiagram')) return 'classDiagram';
    if (trimmed.startsWith('stateDiagram')) return 'stateDiagram';
    if (trimmed.startsWith('erDiagram')) return 'erDiagram';
    if (trimmed.startsWith('gantt')) return 'gantt';
    if (trimmed.startsWith('pie')) return 'pie';
    if (trimmed.startsWith('journey')) return 'journey';
    if (trimmed.startsWith('gitGraph')) return 'gitgraph';
    if (trimmed.startsWith('mindmap')) return 'mindmap';
    if (trimmed.startsWith('timeline')) return 'timeline';
    
    // Try to detect by content patterns
    if (code.includes('-->') || code.includes('---')) return 'flowchart';
    if (code.includes('participant') || code.includes('->')) return 'sequence';
    if (code.includes('class ') && code.includes('{')) return 'classDiagram';
    
    return 'unknown';
  }

  private calculateComplexity(code: string, type: DiagramType): ComplexityLevel {
    const lines = code.split('\n').filter(line => line.trim() && !line.trim().startsWith('%'));
    const lineCount = lines.length;
    
    // Count nodes/elements based on diagram type
    let elementCount = 0;
    let connectionCount = 0;
    
    switch (type) {
      case 'flowchart':
        elementCount = this.countFlowchartNodes(code);
        connectionCount = this.countConnections(code, ['-->', '---', '-.->']);
        break;
      case 'sequence':
        elementCount = this.countSequenceParticipants(code);
        connectionCount = this.countConnections(code, ['->', '-->>', '-x', '--x']);
        break;
      case 'classDiagram':
        elementCount = this.countClassDiagramClasses(code);
        connectionCount = this.countConnections(code, ['--', '..', '--|>', '..|>']);
        break;
      case 'erDiagram':
        elementCount = this.countEREntities(code);
        connectionCount = this.countERRelationships(code);
        break;
      default:
        elementCount = lineCount; // Fallback
    }
    
    // Calculate total complexity score
    const complexityScore = elementCount + (connectionCount * 0.5) + (lineCount * 0.1);
    
    if (complexityScore < 5) return 'simple';
    if (complexityScore < 15) return 'medium';
    if (complexityScore < 30) return 'complex';
    return 'very-complex';
  }

  private countFlowchartNodes(code: string): number {
    // Match patterns like: A[Text], B(Text), C{Text}, D((Text))
    const nodePattern = /\b[A-Za-z0-9_]+\s*[\[\(\{][^\]\)\}]*[\]\)\}]/g;
    return (code.match(nodePattern) || []).length;
  }

  private countSequenceParticipants(code: string): number {
    const participantPattern = /participant\s+\w+/g;
    return (code.match(participantPattern) || []).length;
  }

  private countClassDiagramClasses(code: string): number {
    const classPattern = /class\s+\w+/g;
    return (code.match(classPattern) || []).length;
  }

  private countEREntities(code: string): number {
    // Count entity definitions (usually uppercase words followed by {)
    const entityPattern = /\b[A-Z][A-Z0-9_]*\s*\{/g;
    return (code.match(entityPattern) || []).length;
  }

  private countERRelationships(code: string): number {
    const relationshipPattern = /\|\|--|\|o--|\|\|\.\.|\|o\.\./g;
    return (code.match(relationshipPattern) || []).length;
  }

  private countConnections(code: string, patterns: string[]): number {
    let total = 0;
    for (const pattern of patterns) {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      total += (code.match(regex) || []).length;
    }
    return total;
  }

  private getBaseDimensions(type: DiagramType, complexity: ComplexityLevel): { width: number; height: number } {
    const complexityMultiplier = {
      'simple': 1,
      'medium': 1.3,
      'complex': 1.6,
      'very-complex': 2
    }[complexity];

    const baseSizes = {
      'flowchart': { width: 400, height: 300 },
      'sequence': { width: 600, height: 400 },
      'classDiagram': { width: 500, height: 600 },
      'stateDiagram': { width: 450, height: 350 },
      'erDiagram': { width: 550, height: 450 },
      'gantt': { width: 700, height: 300 },
      'pie': { width: 300, height: 300 },
      'journey': { width: 600, height: 200 },
      'gitgraph': { width: 500, height: 200 },
      'mindmap': { width: 400, height: 400 },
      'timeline': { width: 700, height: 200 },
      'unknown': { width: 400, height: 300 }
    };

    const base = baseSizes[type];
    return {
      width: Math.round(base.width * complexityMultiplier),
      height: Math.round(base.height * complexityMultiplier)
    };
  }

  private adjustForContent(code: string, type: DiagramType, baseDimensions: { width: number; height: number }): { width: number; height: number } {
    let { width, height } = baseDimensions;
    
    // Adjust for text length (long labels need more space)
    const avgLineLength = code.split('\n').reduce((sum, line) => sum + line.length, 0) / code.split('\n').length;
    if (avgLineLength > 50) {
      width *= 1.2;
    }
    
    // Adjust for specific diagram characteristics
    switch (type) {
      case 'sequence':
        // Wide diagrams for many participants
        const participantCount = this.countSequenceParticipants(code);
        if (participantCount > 4) {
          width = Math.max(width, participantCount * 120);
        }
        break;
        
      case 'flowchart':
        // Check for horizontal vs vertical flow
        if (code.includes('TD') || code.includes('TB')) {
          height *= 1.2; // More height for top-down
        }
        if (code.includes('LR') || code.includes('RL')) {
          width *= 1.3; // More width for left-right
        }
        break;
        
      case 'gantt':
        // Width based on task count
        const taskCount = (code.match(/section/g) || []).length * 3; // Estimate
        width = Math.max(width, taskCount * 80);
        break;
    }
    
    return { width: Math.round(width), height: Math.round(height) };
  }

  private getPageConstraints(pageSize: string): { maxWidth: number; maxHeight: number } {
    const constraints = {
      'A4': { maxWidth: 580, maxHeight: 750 },      // A4 minus margins
      'Letter': { maxWidth: 580, maxHeight: 720 },   // US Letter minus margins  
      'Legal': { maxWidth: 580, maxHeight: 950 }     // US Legal minus margins
    };
    
    return constraints[pageSize as keyof typeof constraints] || constraints.A4;
  }

  private applyPageConstraints(
    dimensions: { width: number; height: number }, 
    constraints: { maxWidth: number; maxHeight: number }
  ): { width: number; height: number } {
    let { width, height } = dimensions;
    const { maxWidth, maxHeight } = constraints;
    
    // Scale down if exceeding page constraints
    if (width > maxWidth || height > maxHeight) {
      const widthScale = maxWidth / width;
      const heightScale = maxHeight / height;
      const scale = Math.min(widthScale, heightScale);
      
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    
    return { width, height };
  }

  private calculateViewport(
    dimensions: { width: number; height: number }, 
    complexity: ComplexityLevel
  ): { width: number; height: number; deviceScaleFactor: number } {
    // Add padding for viewport
    const padding = 40;
    const width = dimensions.width + padding;
    const height = dimensions.height + padding;
    
    // Adjust scale factor based on complexity for quality
    const scaleFactors = {
      'simple': 1.2,
      'medium': 1.5, 
      'complex': 1.8,
      'very-complex': 2.0
    };
    
    return {
      width,
      height,
      deviceScaleFactor: scaleFactors[complexity]
    };
  }

  private generateMermaidConfig(
    type: DiagramType, 
    dimensions: { width: number; height: number }, 
    complexity: ComplexityLevel
  ): any {
    const fontSize = complexity === 'very-complex' ? '10px' : 
                    complexity === 'complex' ? '11px' : '12px';
    
    const baseConfig = {
      theme: 'default',
      maxWidth: dimensions.width,
      themeVariables: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
        fontSize
      },
      logLevel: 'error',
      securityLevel: 'loose'
    };

    // Type-specific configurations
    const typeConfigs = {
      flowchart: {
        flowchart: {
          htmlLabels: true,
          useMaxWidth: true,
          nodeSpacing: complexity === 'simple' ? 25 : 20,
          rankSpacing: complexity === 'simple' ? 30 : 25,
          padding: 15,
          curve: 'basis'
        }
      },
      sequence: {
        sequence: {
          diagramMarginX: 20,
          diagramMarginY: 15,
          boxTextMargin: 5,
          noteMargin: 10,
          messageMargin: complexity === 'simple' ? 25 : 20,
          useMaxWidth: true
        }
      },
      classDiagram: {
        class: {
          useMaxWidth: true
        }
      },
      erDiagram: {
        er: {
          useMaxWidth: true,
          entityPadding: 15,
          stroke: '#333',
          fontSize: fontSize
        }
      },
      gantt: {
        gantt: {
          useMaxWidth: true,
          leftPadding: 75,
          rightPadding: 20
        }
      }
    };

    const typeConfig = typeConfigs[type as keyof typeof typeConfigs] || {};
    
    return { ...baseConfig, ...typeConfig };
  }
}