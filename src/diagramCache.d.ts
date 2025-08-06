export declare class DiagramCache {
    private static instance;
    private cache;
    private hits;
    private misses;
    private constructor();
    static getInstance(): DiagramCache;
    generateHash(mermaidCode: string): string;
    getOrRender(mermaidCode: string, tempImagePath: string): Promise<string>;
    getStats(): {
        totalEntries: number;
        hitRate: number;
    };
    destroy(): void;
}
//# sourceMappingURL=diagramCache.d.ts.map