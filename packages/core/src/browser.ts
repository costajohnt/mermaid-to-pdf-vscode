/**
 * Browser Pool Manager for the Core Library
 * 
 * Manages browser instances for rendering operations
 */

import puppeteer, { Browser, LaunchOptions } from 'puppeteer';

export interface BrowserPoolOptions {
  maxPoolSize?: number;
  launchOptions?: LaunchOptions;
}

interface PooledBrowser {
  browser: Browser;
  inUse: boolean;
}

export class BrowserPool {
  private static instance: BrowserPool;
  private pool: PooledBrowser[] = [];
  private readonly maxPoolSize: number;
  private readonly launchOptions: LaunchOptions;

  private constructor(options: BrowserPoolOptions = {}) {
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

  public static getInstance(options?: BrowserPoolOptions): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool(options);
    }
    return BrowserPool.instance;
  }

  public async getBrowser(): Promise<Browser> {
    const availableBrowser = this.pool.find(pb => !pb.inUse && pb.browser.connected);
    
    if (availableBrowser) {
      availableBrowser.inUse = true;
      return availableBrowser.browser;
    }

    if (this.pool.length < this.maxPoolSize) {
      const browser = await puppeteer.launch(this.launchOptions);
      const pooledBrowser: PooledBrowser = {
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

  public async releaseBrowser(browser: Browser): Promise<void> {
    const pooledBrowser = this.pool.find(pb => pb.browser === browser);
    
    if (pooledBrowser) {
      pooledBrowser.inUse = false;
      
      const pages = await browser.pages();
      const pagesToClose = pages.slice(1);
      
      await Promise.all(pagesToClose.map((page: any) => 
        page.close().catch(() => {})
      ));
    }
  }

  public async destroy(): Promise<void> {
    await Promise.all(
      this.pool.map(pb => 
        pb.browser.close().catch(() => {})
      )
    );
    
    this.pool = [];
    BrowserPool.instance = null as any;
  }
}