// src/browserManager.ts
//
// Shared Chromium browser singleton. Both the Mermaid SVG renderer and the
// PDF generator reuse this single instance so only one Chromium process is
// launched per CLI invocation.

import puppeteer, { type Browser } from 'puppeteer';
import { getBrowserArgs } from './types.js';

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

/**
 * Get or create the singleton browser instance.
 * Uses a launch-in-progress promise to prevent duplicate browser launches
 * from concurrent calls.
 */
export async function getBrowser(): Promise<Browser> {
    if (browserInstance && browserInstance.connected) {
        return browserInstance;
    }
    if (browserLaunchPromise) {
        return browserLaunchPromise;
    }
    browserLaunchPromise = puppeteer.launch({
        headless: true,
        args: getBrowserArgs(),
    }).then(browser => {
        browserInstance = browser;
        browserLaunchPromise = null;
        return browser;
    }).catch(err => {
        browserLaunchPromise = null;
        throw err;
    });
    return browserLaunchPromise;
}

/**
 * Close the singleton browser instance. Call this during cleanup.
 * Safe to call multiple times or when no browser was launched.
 */
export async function closeBrowser(): Promise<void> {
    if (browserLaunchPromise) {
        try {
            await browserLaunchPromise;
        } catch {
            // launch failed -- nothing to close
        }
    }
    if (browserInstance) {
        try {
            await browserInstance.close();
        } catch (err) {
            console.error('Warning: Failed to close browser:', err instanceof Error ? err.message : String(err));
        }
        browserInstance = null;
    }
}
