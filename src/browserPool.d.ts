import * as puppeteer from 'puppeteer';
export interface BrowserPoolOptions {
    maxPoolSize?: number;
    launchOptions?: puppeteer.LaunchOptions;
}
export declare class BrowserPool {
    private static instance;
    private pool;
    private readonly maxPoolSize;
    private readonly launchOptions;
    private constructor();
    static getInstance(options?: BrowserPoolOptions): BrowserPool;
    getBrowser(): Promise<puppeteer.Browser>;
    releaseBrowser(browser: puppeteer.Browser): Promise<void>;
    destroy(): Promise<void>;
}
//# sourceMappingURL=browserPool.d.ts.map