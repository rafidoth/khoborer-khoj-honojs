import { jest } from '@jest/globals';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ScrapeResult } from '../../src/types';

let testDir: string;

beforeAll(async () => {
    // making a mock local cache`
    testDir = await mkdtemp(join(tmpdir(), 'filter-test-'));
    process.env.DATA_DIR = testDir;
});

afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
});

// Fresh module import per test to reset in-memory cache
async function getModules() {
    jest.resetModules();
    const { filterNewArticles } = await import('../../src/ai/extractor');
    const { addURL, addURLs } = await import('../../src/database/url-cache');
    return { filterNewArticles, addURL, addURLs };
}

function makeScrapeResults(urls: string[]): ScrapeResult[] {
    return [{
        source: 'Prothom Alo',
        scrapedAt: new Date().toISOString(),
        articles: urls.map(url => ({
            title: `Article ${url}`,
            url,
            source: 'Prothom Alo' as const,
            content: 'Some content',
        })),
    }];
}

describe('filterNewArticles', () => {
    beforeEach(async () => {
        const cacheFile = join(testDir, 'extracted-urls.json');
        await rm(cacheFile, { force: true });
    });

    it('should return all articles when cache is empty', async () => {
        const { filterNewArticles } = await getModules();

        const results = makeScrapeResults([
            'https://example.com/1',
            'https://example.com/2',
            'https://example.com/3',
        ]);

        const newArticles = await filterNewArticles(results);
        expect(newArticles).toHaveLength(3);
    });

    it('should filter out articles that are already in cache', async () => {
        const { filterNewArticles, addURLs } = await getModules();

        // Pre-cache 2 of 4 URLs
        await addURLs([
            'https://example.com/cached-1',
            'https://example.com/cached-2',
        ]);

        const results = makeScrapeResults([
            'https://example.com/cached-1',
            'https://example.com/cached-2',
            'https://example.com/new-1',
            'https://example.com/new-2',
        ]);

        const newArticles = await filterNewArticles(results);
        expect(newArticles).toHaveLength(2);
        expect(newArticles.map(a => a.url)).toEqual([
            'https://example.com/new-1',
            'https://example.com/new-2',
        ]);
    });

    it('should return empty array when all articles are cached', async () => {
        const { filterNewArticles, addURLs } = await getModules();

        await addURLs([
            'https://example.com/a',
            'https://example.com/b',
        ]);

        const results = makeScrapeResults([
            'https://example.com/a',
            'https://example.com/b',
        ]);

        const newArticles = await filterNewArticles(results);
        expect(newArticles).toHaveLength(0);
    });

    it('should flatten articles from multiple ScrapeResults', async () => {
        const { filterNewArticles } = await getModules();

        const results: ScrapeResult[] = [
            {
                source: 'Prothom Alo',
                scrapedAt: new Date().toISOString(),
                articles: [
                    { title: 'PA1', url: 'https://pa.com/1', source: 'Prothom Alo', content: 'c' },
                    { title: 'PA2', url: 'https://pa.com/2', source: 'Prothom Alo', content: 'c' },
                ],
            },
            {
                source: 'Somoy News',
                scrapedAt: new Date().toISOString(),
                articles: [
                    { title: 'SN1', url: 'https://sn.com/1', source: 'Somoy News', content: 'c' },
                ],
            },
        ];

        const newArticles = await filterNewArticles(results);
        expect(newArticles).toHaveLength(3);
    });
});
