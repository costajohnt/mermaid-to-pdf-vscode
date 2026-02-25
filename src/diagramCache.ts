// src/diagramCache.ts
import { createHash } from 'crypto';
import { RenderedDiagram } from './types.js';

export class DiagramCache {
    private cache = new Map<string, RenderedDiagram>();

    private hash(code: string): string {
        return createHash('sha256').update(code.trim()).digest('hex');
    }

    get(mermaidCode: string): RenderedDiagram | null {
        return this.cache.get(this.hash(mermaidCode)) ?? null;
    }

    set(mermaidCode: string, diagram: RenderedDiagram): void {
        this.cache.set(this.hash(mermaidCode), diagram);
    }

    clear(): void {
        this.cache.clear();
    }
}
