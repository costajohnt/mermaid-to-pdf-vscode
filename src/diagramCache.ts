// src/diagramCache.ts
import { createHash } from 'crypto';
import { RenderedDiagram, DiagramCacheEntry } from './types.js';

export class DiagramCache {
    private cache = new Map<string, DiagramCacheEntry>();

    private hash(code: string): string {
        return createHash('sha256').update(code.trim()).digest('hex');
    }

    get(mermaidCode: string): RenderedDiagram | null {
        const entry = this.cache.get(this.hash(mermaidCode));
        return entry ? entry.diagram : null;
    }

    set(mermaidCode: string, diagram: RenderedDiagram): void {
        this.cache.set(this.hash(mermaidCode), {
            diagram,
            timestamp: Date.now(),
        });
    }

    clear(): void {
        this.cache.clear();
    }
}
