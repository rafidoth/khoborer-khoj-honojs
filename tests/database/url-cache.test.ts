import { jest } from '@jest/globals';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// We need to override DATA_DIR before importing the module.
// The url-cache module reads DATA_DIR at import time, so we set the env var first.
let testDir: string;

beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'url-cache-test-'));
    process.env.DATA_DIR = testDir;
});

afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
});

// Dynamic import so DATA_DIR is set before the module loads
async function getCache() {
    // Jest caches modules, so we need to reset between tests
    // to get a fresh in-memory cache each time
    jest.resetModules();
    const mod = await import('../../src/database/url-cache');
    return mod;
}

describe('URL cache', () => {
    beforeEach(async () => {
        // Clear any files from previous test
        const cacheFile = join(testDir, 'extracted-urls.json');
        await rm(cacheFile, { force: true });
    });

    it('loadCache() should create an empty cache when no file exists', async () => {
        const { loadCache } = await getCache();
        const cache = await loadCache();
        expect(cache).toBeDefined();
        expect(cache.size).toBe(0);
    });

    it('addURL() should add a URL and persist to disk', async () => {
        const { addURL, hasURL } = await getCache();

        await addURL('https://example.com/article-1');

        const exists = await hasURL('https://example.com/article-1');
        expect(exists).toBe(true);

        // Verify file was written
        const cacheFile = join(testDir, 'extracted-urls.json');
        const raw = await readFile(cacheFile, 'utf-8');
        const data = JSON.parse(raw);
        expect(data['https://example.com/article-1']).toBeDefined();
        expect(typeof data['https://example.com/article-1']).toBe('number');
    });

    it('hasURL() should return false for unknown URLs', async () => {
        const { hasURL } = await getCache();

        const exists = await hasURL('https://example.com/never-seen');
        expect(exists).toBe(false);
    });

    it('addURLs() should batch-add multiple URLs in one write', async () => {
        const { addURLs, hasURL } = await getCache();

        await addURLs([
            'https://example.com/batch-1',
            'https://example.com/batch-2',
            'https://example.com/batch-3',
        ]);

        expect(await hasURL('https://example.com/batch-1')).toBe(true);
        expect(await hasURL('https://example.com/batch-2')).toBe(true);
        expect(await hasURL('https://example.com/batch-3')).toBe(true);
    });

    it('pruneExpired() should remove entries older than TTL', async () => {
        const { loadCache, pruneExpired } = await getCache();

        // Manually write a cache file with an old entry
        const cacheFile = join(testDir, 'extracted-urls.json');
        const oldTimestamp = Date.now() - (31 * 60 * 60 * 1000); // 31 hours ago (TTL is 30h)
        const freshTimestamp = Date.now();

        const data = {
            'https://example.com/old-article': oldTimestamp,
            'https://example.com/fresh-article': freshTimestamp,
        };

        const { writeFile: wf } = await import('node:fs/promises');
        await wf(cacheFile, JSON.stringify(data), 'utf-8');

        // Load the cache (this should auto-prune the old entry on load)
        const cache = await loadCache();

        // Old entry should have been pruned during load
        expect(cache.has('https://example.com/old-article')).toBe(false);
        expect(cache.has('https://example.com/fresh-article')).toBe(true);
    });

    it('cache should survive reload from disk', async () => {
        const cache1 = await getCache();
        await cache1.addURL('https://example.com/persist-test');

        // Re-import to simulate process restart
        const cache2 = await getCache();
        const exists = await cache2.hasURL('https://example.com/persist-test');
        expect(exists).toBe(true);
    });
});
