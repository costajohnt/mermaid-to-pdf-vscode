"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserPool = void 0;
const puppeteer = require("puppeteer");
class BrowserPool {
    constructor(options = {}) {
        this.pool = [];
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
            const browser = await puppeteer.launch(this.launchOptions);
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
            await Promise.all(pagesToClose.map(page => page.close().catch(() => { })));
        }
    }
    async destroy() {
        await Promise.all(this.pool.map(pb => pb.browser.close().catch(() => { })));
        this.pool = [];
        BrowserPool.instance = null;
    }
}
exports.BrowserPool = BrowserPool;
