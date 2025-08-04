"use strict";
/**
 * Browser Pool Manager for the Core Library
 *
 * Manages browser instances for rendering operations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserPool = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
class BrowserPool {
    static instance;
    pool = [];
    maxPoolSize;
    launchOptions;
    constructor(options = {}) {
        this.maxPoolSize = options.maxPoolSize || 2;
        this.launchOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ],
            timeout: 30000,
            ...options.launchOptions
        };
    }
    static getInstance(options) {
        if (!BrowserPool.instance) {
            BrowserPool.instance = new BrowserPool(options);
        }
        return BrowserPool.instance;
    }
    async getBrowser() {
        const availableBrowser = this.pool.find(pb => !pb.inUse && pb.browser.connected);
        if (availableBrowser) {
            availableBrowser.inUse = true;
            return availableBrowser.browser;
        }
        if (this.pool.length < this.maxPoolSize) {
            const browser = await puppeteer_1.default.launch(this.launchOptions);
            const pooledBrowser = {
                browser,
                inUse: true
            };
            this.pool.push(pooledBrowser);
            browser.on('disconnected', () => {
                const index = this.pool.findIndex(pb => pb.browser === browser);
                if (index !== -1) {
                    this.pool.splice(index, 1);
                }
            });
            return browser;
        }
        throw new Error('Browser pool exhausted');
    }
    async releaseBrowser(browser) {
        const pooledBrowser = this.pool.find(pb => pb.browser === browser);
        if (pooledBrowser) {
            pooledBrowser.inUse = false;
            const pages = await browser.pages();
            const pagesToClose = pages.slice(1);
            await Promise.all(pagesToClose.map((page) => page.close().catch(() => { })));
        }
    }
    async destroy() {
        await Promise.all(this.pool.map(pb => pb.browser.close().catch(() => { })));
        this.pool = [];
        BrowserPool.instance = null;
    }
}
exports.BrowserPool = BrowserPool;
//# sourceMappingURL=browser.js.map