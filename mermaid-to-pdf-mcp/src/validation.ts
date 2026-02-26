import {
    ErrorCode,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ConversionOptions } from './types.js';
import { homedir, tmpdir } from 'os';
import { resolve, sep } from 'path';

/**
 * Sanitize error messages before returning them to MCP clients.
 * Replaces absolute file paths with just the filename to avoid
 * leaking server-side directory structure.
 *
 * Handles:
 * - Unix paths: /home/user/file.txt
 * - Windows paths: C:\Users\user\file.txt
 * - Preserves URLs with schemes (http://, https://, file://)
 */
export function sanitizeErrorMessage(message: string): string {
    return message.replace(
        /(\w+:\/\/[^\s,"']+)|((?:[A-Za-z]:\\|\/)[^\s:,"']+)/g,
        (match, url: string | undefined, filePath: string | undefined) => {
            if (url) return match;
            if (filePath) {
                const basename = filePath.split(/[/\\]/).filter(Boolean).pop();
                return basename || '<path>';
            }
            return match;
        },
    );
}

// Option validation
const VALID_THEMES = new Set(['light', 'dark']);
const VALID_PAGES = new Set(['A4', 'Letter', 'Legal']);

/**
 * Validate and normalize conversion options from raw MCP input.
 */
export function validateOptions(raw: unknown): ConversionOptions {
    if (raw !== null && raw !== undefined && (typeof raw !== 'object' || Array.isArray(raw))) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `"options" must be an object, got ${typeof raw}`
        );
    }
    const obj = (raw ?? {}) as Record<string, unknown>;
    const opts: ConversionOptions = {};
    if (obj.title !== null && obj.title !== undefined) { opts.title = String(obj.title); }
    if (obj.theme !== null && obj.theme !== undefined) {
        if (typeof obj.theme !== 'string' || !VALID_THEMES.has(obj.theme)) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid theme: ${String(obj.theme)}. Must be "light" or "dark".`);
        }
        opts.theme = obj.theme as 'light' | 'dark';
    }
    if (obj.pageSize !== null && obj.pageSize !== undefined) {
        if (typeof obj.pageSize !== 'string' || !VALID_PAGES.has(obj.pageSize)) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid pageSize: ${String(obj.pageSize)}. Must be "A4", "Letter", or "Legal".`);
        }
        opts.pageSize = obj.pageSize as 'A4' | 'Letter' | 'Legal';
    }
    return opts;
}

// Capture cwd at startup — if the server is started with cwd=/, exclude it
const STARTUP_CWD = process.cwd();

/**
 * Validate that a file path is safe to access.
 * Rejects paths that traverse outside the user's home directory, /tmp, or cwd.
 */
export function validatePath(filePath: string, label: string): string {
    const resolved = resolve(filePath);
    const home = homedir();

    // Build allowed roots with proper directory boundary checks
    const allowedRoots = [home, tmpdir()];
    // On non-Windows, also allow /tmp directly (tmpdir() may return e.g. /private/tmp on macOS)
    if (process.platform !== 'win32') {
        allowedRoots.push('/tmp');
    }
    if (STARTUP_CWD !== '/' && STARTUP_CWD.length > 1) {
        allowedRoots.push(STARTUP_CWD);
    }

    const isAllowed = allowedRoots.some(root => {
        const prefix = root.endsWith(sep) ? root : root + sep;
        return resolved === root || resolved.startsWith(prefix);
    });

    if (!isAllowed) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `${label} "${filePath}" is outside allowed directories. Paths must be under the home directory, /tmp, or the current working directory.`
        );
    }

    return resolved;
}
