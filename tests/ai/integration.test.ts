import { jest } from '@jest/globals';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ScrapeResult } from '../../src/types';
import type { ArticleExtraction } from '../../src/ai/extractionOutputSchema';

// --- Dummy extraction output conforming to ArticleExtractionSchema ---
const DUMMY_EXTRACTION: ArticleExtraction = {
    title_english: 'Test: Dhaka Sees Heavy Rainfall',
    title_original: null,
    publish_date: '2026-02-25',
    category: 'bangladesh',
    sentiment: 'neutral',
    importance_score: 3,
    is_update: false,
    summary: 'Heavy rainfall hit Dhaka. Several areas were waterlogged. Authorities urged caution.',
    locations: ['Dhaka'],
    people: [],
    organizations: ['BWDB'],
    statements: [],
    casualties: {
        killed: null,
        injured: null,
        missing: null,
        arrested: null,
        victim_gender: null,
        victim_age_group: null,
        victim_profession: null,
    },
    monetary_figures: [],
    government_action: null,
    tags: {
        category: 'bangladesh',
        incident_type: ['flood'],
        affected_locations: ['Dhaka'],
        involved_institutions: ['BWDB'],
    },
};

// --- Mock the `ai` package so generateText never calls a real API ---
const mockGenerateText = jest.fn().mockResolvedValue({ output: DUMMY_EXTRACTION } as never);

jest.unstable_mockModule('ai', () => ({
    generateText: mockGenerateText,
    Output: { object: jest.fn().mockReturnValue({}) },
}));

// All dynamic imports — same module graph as extractor (after mock is registered)
const { Extractor } = await import('../../src/ai/extractor');
const { hasURL, addURL, resetCache } = await import('../../src/database/url-cache');
const { connectDB, disconnectDB, getCollection } = await import('../../src/database/db');

const TEST_COLLECTION = '__test_integration';
let testDir: string;

beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'integration-test-'));
    process.env.DATA_DIR = testDir;
    process.env.MONGO_COLLECTION = TEST_COLLECTION;
    await connectDB();
}, 15000);

afterAll(async () => {
    try {
        const col = getCollection(TEST_COLLECTION);
        await col.drop().catch(() => {});
    } catch {
        // DB may already be disconnected
    }
    await disconnectDB();
    await rm(testDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
    delete process.env.MONGO_COLLECTION;
});

afterEach(async () => {
    const col = getCollection(TEST_COLLECTION);
    await col.deleteMany({});
    const cacheFile = join(testDir, 'extracted-urls.json');
    await rm(cacheFile, { force: true });
    resetCache();
    mockGenerateText.mockClear();
});

function makeFakeScrapeResults(): ScrapeResult[] {
    return [{
        source: 'Prothom Alo',
        scrapedAt: new Date().toISOString(),
        articles: [{
            title: 'ঢাকায় ভারী বৃষ্টিপাত',
            url: 'https://prothomalo.com/test-article-123',
            source: 'Prothom Alo',
            publishedAt: '2026-02-25',
            content: 'ঢাকায় আজ ভারী বৃষ্টিপাত হয়েছে। একাধিক এলাকায় জলাবদ্ধতা সৃষ্টি হয়েছে। কর্তৃপক্ষ সতর্কতা জারি করেছে।',
            imageUrl: 'https://prothomalo.com/test-image.jpg',
        }],
    }];
}

function makeMockRegistry() {
    return {
        getProviderOrder: () => ['groq'],
        createModel: () => ({
            model: {} as any,
            provider: 'groq' as const,
            model_name: 'test-model',
        }),
    };
}

describe('Integration: scrape → extract (mocked AI) → MongoDB + cache', () => {
    it('should extract an article and store it in MongoDB', async () => {
        const extractor = new Extractor(makeMockRegistry() as any);
        await extractor.extract(makeFakeScrapeResults());

        const col = getCollection(TEST_COLLECTION);
        const docs = await col.find({}).toArray();

        expect(docs).toHaveLength(1);
        expect(docs[0].title_english).toBe('Test: Dhaka Sees Heavy Rainfall');
        expect(docs[0].url).toBe('https://prothomalo.com/test-article-123');
        expect(docs[0].source).toBe('Prothom Alo');
        expect(docs[0].extractedAt).toBeDefined();
        expect(docs[0].scrapedAt).toBeDefined();
        expect(docs[0].category).toBe('bangladesh');
    });

    it('should add the URL to the local cache after extraction', async () => {
        const extractor = new Extractor(makeMockRegistry() as any);
        await extractor.extract(makeFakeScrapeResults());

        const cached = await hasURL('https://prothomalo.com/test-article-123');
        expect(cached).toBe(true);
    });

    it('should skip extraction on second run (dedup)', async () => {
        const extractor = new Extractor(makeMockRegistry() as any);
        const scrapeResults = makeFakeScrapeResults();

        // First run — should extract
        await extractor.extract(scrapeResults);
        expect(mockGenerateText).toHaveBeenCalledTimes(1);

        mockGenerateText.mockClear();

        // Second run with the same articles — should skip
        await extractor.extract(scrapeResults);

        // generateText was NOT called on the second run
        expect(mockGenerateText).not.toHaveBeenCalled();

        // Still only 1 document in MongoDB (no duplicate)
        const col = getCollection(TEST_COLLECTION);
        const docs = await col.find({}).toArray();
        expect(docs).toHaveLength(1);
    });

    it('should extract only new articles when mix of cached and new', async () => {
        // Pre-cache one URL
        await addURL('https://prothomalo.com/already-extracted');

        const extractor = new Extractor(makeMockRegistry() as any);

        const scrapeResults: ScrapeResult[] = [{
            source: 'Prothom Alo',
            scrapedAt: new Date().toISOString(),
            articles: [
                {
                    title: 'Already Extracted',
                    url: 'https://prothomalo.com/already-extracted',
                    source: 'Prothom Alo',
                    content: 'Old content',
                },
                {
                    title: 'Brand New Article',
                    url: 'https://prothomalo.com/brand-new',
                    source: 'Prothom Alo',
                    content: 'New content',
                },
            ],
        }];

        mockGenerateText.mockClear();
        await extractor.extract(scrapeResults);

        // generateText should have been called exactly once (only for the new article)
        expect(mockGenerateText).toHaveBeenCalledTimes(1);

        // MongoDB should have exactly 1 new document
        const col = getCollection(TEST_COLLECTION);
        const docs = await col.find({}).toArray();
        expect(docs).toHaveLength(1);
        expect(docs[0].url).toBe('https://prothomalo.com/brand-new');
    });
});
