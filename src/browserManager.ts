// src/browserManager.ts
//
// Shared Chromium browser singleton. Both the Mermaid SVG renderer and the
// PDF generator reuse this single instance so only one Chromium process is
// launched per CLI invocation.

import puppeteer, { type Browser } from 'puppeteer';
import { getBrowserArgs } from './types.js';

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;
let exitHandlerRegistered = false;

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

        // Register process-exit cleanup once per browser lifetime.
        // This ensures the Chromium process is killed if the Node process
        // exits unexpectedly (crash, SIGTERM, etc.).
        if (!exitHandlerRegistered) {
            exitHandlerRegistered = true;
            const cleanup = () => {
                if (browserInstance && browserInstance.process()) {
                    browserInstance.process()?.kill('SIGKILL');
                }
            };
            process.on('exit', cleanup);
            process.on('SIGINT', () => { cleanup(); process.exit(130); });
            process.on('SIGTERM', () => { cleanup(); process.exit(143); });
        }

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
    // Grab and clear the launch promise so concurrent getBrowser() calls
    // after close don't return the stale in-flight promise.
    const pendingLaunch = browserLaunchPromise;
    browserLaunchPromise = null;

    if (pendingLaunch) {
        try {
            await pendingLaunch;
        } catch {
            // launch failed -- nothing to close
        }
    }
    if (browserInstance) {
        const instance = browserInstance;
        browserInstance = null;
        try {
            await instance.close();
        } catch (err) {
            console.error('Warning: Failed to close browser:', err instanceof Error ? err.message : String(err));
        }
    }
}
