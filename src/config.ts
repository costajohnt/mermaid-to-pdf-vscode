// src/config.ts — Load .mermaidrc.json config files
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import type { ConversionOptions } from './types.js';
import { VALID_THEMES, VALID_PAGE_SIZES } from './types.js';

/**
 * Shape of the .mermaidrc.json config file.
 * Currently supports a subset of CLI options: theme, pageSize, and margins.
 */
export interface MermaidrcConfig {
    theme?: 'light' | 'dark';
    pageSize?: 'A4' | 'Letter' | 'Legal';
    margins?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
    };
}

/**
 * Attempt to read and parse a JSON file at the given path.
 * Returns null if the file does not exist.
 * Throws if the file exists but cannot be read or contains invalid JSON.
 */
function tryReadJsonFile(filePath: string): unknown | null {
    let content: string;
    try {
        content = readFileSync(filePath, 'utf-8');
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return null; // File doesn't exist — expected
        }
        throw new Error(
            `Config file "${filePath}" exists but cannot be read: ${err instanceof Error ? err.message : String(err)}`
        );
    }
    try {
        return JSON.parse(content);
    } catch (err) {
        throw new Error(
            `Config file "${filePath}" contains invalid JSON: ${err instanceof Error ? err.message : String(err)}`
        );
    }
}

/**
 * Validate that a parsed config object has expected types.
 * Throws if any field is present but has an invalid value.
 */
function validateConfig(raw: unknown, filePath: string): MermaidrcConfig {
    if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(
            `Invalid config file "${filePath}": expected a JSON object at the top level.`
        );
    }

    const obj = raw as Record<string, unknown>;
    const config: MermaidrcConfig = {};

    if (obj.theme !== undefined) {
        if (typeof obj.theme !== 'string' ||
            !(VALID_THEMES as readonly string[]).includes(obj.theme)) {
            throw new Error(
                `Invalid config file "${filePath}": theme must be one of: ${VALID_THEMES.join(', ')}. Got "${String(obj.theme)}".`
            );
        }
        config.theme = obj.theme as MermaidrcConfig['theme'];
    }

    if (obj.pageSize !== undefined) {
        if (typeof obj.pageSize !== 'string' ||
            !(VALID_PAGE_SIZES as readonly string[]).includes(obj.pageSize)) {
            throw new Error(
                `Invalid config file "${filePath}": pageSize must be one of: ${VALID_PAGE_SIZES.join(', ')}. Got "${String(obj.pageSize)}".`
            );
        }
        config.pageSize = obj.pageSize as MermaidrcConfig['pageSize'];
    }

    if (obj.margins !== undefined) {
        if (typeof obj.margins !== 'object' || obj.margins === null || Array.isArray(obj.margins)) {
            throw new Error(
                `Invalid config file "${filePath}": margins must be an object with top/right/bottom/left string values.`
            );
        }
        const m = obj.margins as Record<string, unknown>;
        const marginConfig: MermaidrcConfig['margins'] = {};
        const marginRegex = /^\d+(?:\.\d+)?(mm|cm|in|px)$/;

        for (const side of ['top', 'right', 'bottom', 'left'] as const) {
            if (m[side] !== undefined) {
                if (typeof m[side] !== 'string' || !marginRegex.test((m[side] as string).trim())) {
                    throw new Error(
                        `Invalid config file "${filePath}": margins.${side} must be a string like "15mm", "1in", etc. Got "${String(m[side])}".`
                    );
                }
                marginConfig[side] = m[side] as string;
            }
        }
        config.margins = marginConfig;
    }

    return config;
}

/**
 * Search for .mermaidrc.json in the standard locations.
 *
 * Search order:
 * 1. Current working directory
 * 2. Home directory
 *
 * Returns the first valid config found, or an empty object if none exists.
 */
export function loadConfigFile(): MermaidrcConfig {
    const searchPaths = [
        resolve(join(process.cwd(), '.mermaidrc.json')),
        resolve(join(homedir(), '.mermaidrc.json')),
    ];

    for (const filePath of searchPaths) {
        const raw = tryReadJsonFile(filePath);
        if (raw !== null) {
            return validateConfig(raw, filePath);
        }
    }

    return {};
}

/**
 * Merge configuration sources with proper precedence:
 *   defaults <- config file <- CLI flags
 *
 * Only non-undefined values from higher-priority sources override lower ones.
 */
export function mergeConfig(
    fileConfig: MermaidrcConfig,
    cliFlags: Partial<ConversionOptions>,
): Partial<ConversionOptions> {
    const merged: Partial<ConversionOptions> = {};

    // Apply config file values
    if (fileConfig.theme !== undefined) { merged.theme = fileConfig.theme; }
    if (fileConfig.pageSize !== undefined) { merged.pageSize = fileConfig.pageSize; }
    if (fileConfig.margins !== undefined) {
        merged.margins = { ...fileConfig.margins } as ConversionOptions['margins'];
    }

    // Apply CLI flags (highest priority — override config file)
    if (cliFlags.theme !== undefined) { merged.theme = cliFlags.theme; }
    if (cliFlags.pageSize !== undefined) { merged.pageSize = cliFlags.pageSize; }
    if (cliFlags.format !== undefined) { merged.format = cliFlags.format; }
    if (cliFlags.margins !== undefined) {
        // CLI margins merge on top of config file margins
        merged.margins = { ...(merged.margins ?? {}), ...cliFlags.margins } as ConversionOptions['margins'];
    }

    if (cliFlags.pageNumbers !== undefined) { merged.pageNumbers = cliFlags.pageNumbers; }
    if (cliFlags.headerTemplate !== undefined) { merged.headerTemplate = cliFlags.headerTemplate; }
    if (cliFlags.footerTemplate !== undefined) { merged.footerTemplate = cliFlags.footerTemplate; }
    if (cliFlags.customCss !== undefined) { merged.customCss = cliFlags.customCss; }
    if (cliFlags.font !== undefined) { merged.font = cliFlags.font; }
    if (cliFlags.codeFont !== undefined) { merged.codeFont = cliFlags.codeFont; }
    if (cliFlags.math !== undefined) { merged.math = cliFlags.math; }
    if (cliFlags.lang !== undefined) { merged.lang = cliFlags.lang; }

    return merged;
}
