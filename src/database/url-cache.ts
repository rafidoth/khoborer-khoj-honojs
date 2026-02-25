import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';
const CACHE_FILE = join(DATA_DIR, 'extracted-urls.json');
const TTL_MS = 30 * 60 * 60 * 1000; // 30 hours

//In-memory map: URL → timestamp (ms) when extraction occurred
let cache: Map<string, number> | null = null;

export async function loadCache(): Promise<Map<string, number>> {
    if (cache) return cache;

    cache = new Map();
    try {
        const raw = await readFile(CACHE_FILE, 'utf-8');
        const entries: Record<string, number> = JSON.parse(raw);
        const now = Date.now();
        for (const [url, ts] of Object.entries(entries)) {
            if (now - ts < TTL_MS) {
                cache.set(url, ts);
            }
        }
    } catch {
        // File doesn't exist yet or is corrupted — start fresh
    }

    return cache;
}

//Check whether a URL has already been extracted (and is within the TTL window).
export async function hasURL(url: string): Promise<boolean> {
    const c = await loadCache();
    const ts = c.get(url);
    if (ts === undefined) return false;

    if (Date.now() - ts >= TTL_MS) {
        c.delete(url);
        return false;
    }
    return true;
}

//Mark a URL as extracted and persist the cache to disk.
export async function addURL(url: string): Promise<void> {
    const c = await loadCache();
    c.set(url, Date.now());
    await persistCache(c);
}

//Mark multiple URLs as extracted in a single disk write.
export async function addURLs(urls: string[]): Promise<void> {
    const c = await loadCache();
    const now = Date.now();
    for (const url of urls) {
        c.set(url, now);
    }
    await persistCache(c);
}

//Remove all expired entries from the cache and persist.
export async function pruneExpired(): Promise<number> {
    const c = await loadCache();
    const now = Date.now();
    let pruned = 0;
    for (const [url, ts] of c) {
        if (now - ts >= TTL_MS) {
            c.delete(url);
            pruned++;
        }
    }
    if (pruned > 0) {
        await persistCache(c);
    }
    return pruned;
}

//Write the in-memory cache to disk as JSON.
async function persistCache(c: Map<string, number>): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    const obj: Record<string, number> = Object.fromEntries(c);
    await writeFile(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
}
