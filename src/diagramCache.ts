import * as crypto from 'crypto';
import { renderMermaid } from './mermaidRenderer';

interface CacheEntry {
    base64Data: string;
    timestamp: number;
}

export class DiagramCache {
    private static instance: DiagramCache;
    private cache = new Map<string, CacheEntry>();
    private hits = 0;
    private misses = 0;

    private constructor() {}

    public static getInstance(): DiagramCache {
        if (!DiagramCache.instance) {
            DiagramCache.instance = new DiagramCache();
        }
        return DiagramCache.instance;
    }

    public generateHash(mermaidCode: string): string {
        return crypto.createHash('sha256').update(mermaidCode.trim()).digest('hex');
    }

    public async getOrRender(mermaidCode: string, tempImagePath: string): Promise<string> {
        const hash = this.generateHash(mermaidCode);
        
        const cached = this.cache.get(hash);
        if (cached) {
            this.hits++;
            return cached.base64Data;
        }

        this.misses++;
        
        await renderMermaid(mermaidCode, tempImagePath);
        
        const { promises: fs } = await import('fs');
        const imageBuffer = await fs.readFile(tempImagePath);
        const base64Data = imageBuffer.toString('base64');
        
        this.cache.set(hash, {
            base64Data,
            timestamp: Date.now()
        });
        
        return base64Data;
    }

    public getStats() {
        const totalRequests = this.hits + this.misses;
        const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

        return {
            totalEntries: this.cache.size,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }

    public destroy(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        DiagramCache.instance = null as any;
    }
}