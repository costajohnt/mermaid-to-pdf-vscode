"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagramCache = void 0;
const crypto = require("crypto");
const mermaidRenderer_js_1 = require("./mermaidRenderer.js");
class DiagramCache {
    constructor() {
        this.cache = new Map();
        this.hits = 0;
        this.misses = 0;
    }
    static getInstance() {
        if (!DiagramCache.instance) {
            DiagramCache.instance = new DiagramCache();
        }
        return DiagramCache.instance;
    }
    generateHash(mermaidCode) {
        return crypto.createHash('sha256').update(mermaidCode.trim()).digest('hex');
    }
    async getOrRender(mermaidCode, tempImagePath) {
        const hash = this.generateHash(mermaidCode);
        const cached = this.cache.get(hash);
        if (cached) {
            this.hits++;
            return cached.base64Data;
        }
        this.misses++;
        await (0, mermaidRenderer_js_1.renderMermaid)(mermaidCode, tempImagePath);
        const { promises: fs } = await Promise.resolve().then(() => require('fs'));
        const imageBuffer = await fs.readFile(tempImagePath);
        const base64Data = imageBuffer.toString('base64');
        this.cache.set(hash, {
            base64Data,
            timestamp: Date.now()
        });
        return base64Data;
    }
    getStats() {
        const totalRequests = this.hits + this.misses;
        const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
        return {
            totalEntries: this.cache.size,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }
    destroy() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        DiagramCache.instance = null;
    }
}
exports.DiagramCache = DiagramCache;
