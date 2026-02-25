// src/diagramCache.ts
import { createHash } from 'crypto';
import { RenderedDiagram } from './types.js';

export class DiagramCache {
    private entries = new Map<string, RenderedDiagram>();

    private hash(code: string, theme: string = ''): string {
        return createHash('sha256').update(`${theme}:${code.trim()}`).digest('hex');
    }

    get(code: string, theme: string = ''): RenderedDiagram | null {
        return this.entries.get(this.hash(code, theme)) ?? null;
    }

    set(code: string, diagram: RenderedDiagram, theme: string = ''): void {
        this.entries.set(this.hash(code, theme), diagram);
    }

    clear(): void {
        this.entries.clear();
    }
}
