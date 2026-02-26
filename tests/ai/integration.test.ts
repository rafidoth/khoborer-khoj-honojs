import { jest } from '@jest/globals';
import type { ScrapeResult } from '../../src/types';
import type { ArticleExtraction } from '../../src/ai/extractionOutputSchema';

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
        political_parties: null,
        politicians: null,
        government_bodies: null,
        incident_type: ['flood'],
        affected_locations: ['Dhaka'],
        involved_institutions: ['BWDB'],
        sector: null,
        companies: null,
        economic_indicators: null,
        event_type: null,
    },
};

const mockGenerateText = jest.fn().mockResolvedValue({ output: DUMMY_EXTRACTION } as never);

jest.unstable_mockModule('ai', () => ({
    generateText: mockGenerateText,
    Output: { object: jest.fn().mockReturnValue({}) },
}));

// All dynamic imports, same module graph as extractor (after mock is registered)
const { Extractor } = await import('../../src/ai/extractor');
const { connectDB, disconnectDB, getCollection } = await import('../../src/database/db');

const TEST_COLLECTION = '__test_integration';

beforeAll(async () => {
    process.env.MONGO_COLLECTION = TEST_COLLECTION;
    await connectDB();
}, 15000);

afterAll(async () => {
    try {
        const col = getCollection(TEST_COLLECTION);
        await col.drop().catch(() => { });
    } catch {
        // DB may already be disconnected
    }
    await disconnectDB();
    delete process.env.MONGO_COLLECTION;
});

afterEach(async () => {
    const col = getCollection(TEST_COLLECTION);
    await col.deleteMany({});
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
        getKeyCount: () => 1,
        createModel: () => ({
            model: {} as any,
            provider: 'groq' as const,
            model_name: 'test-model',
        }),
    };
}

// --- Helper: multi-provider registry for fallback tests ---
function makeMultiProviderRegistry(providers: string[] = ['groq', 'cerebras', 'google'], keysPerProvider: number = 1) {
    let callIndex = 0;
    return {
        getProviderOrder: () => [...providers],
        getKeyCount: () => keysPerProvider,
        createModel: (config?: { provider?: string }) => {
            const provider = config?.provider ?? providers[0];
            callIndex++;
            return {
                model: {} as any,
                provider: provider as any,
                model_name: `${provider}-model`,
            };
        },
    };
}

function makeMultiArticleScrapeResults(count: number): ScrapeResult[] {
    const articles = Array.from({ length: count }, (_, i) => ({
        title: `Article ${i + 1}`,
        url: `https://prothomalo.com/article-${i + 1}`,
        source: 'Prothom Alo' as const,
        content: `Content for article ${i + 1}`,
    }));
    return [{
        source: 'Prothom Alo' as const,
        scrapedAt: new Date().toISOString(),
        articles,
    }];
}

describe('Provider fallback behavior', () => {
    it('should fall back to the second provider when the first fails', async () => {
        // First call to generateText throws (simulating groq failure),
        // second call succeeds (cerebras fallback)
        mockGenerateText
            .mockRejectedValueOnce(new Error('Rate limit exceeded') as never)
            .mockResolvedValueOnce({ output: DUMMY_EXTRACTION } as never);

        const registry = makeMultiProviderRegistry(['groq', 'cerebras']);
        const extractor = new Extractor(registry as any, 0);
        await extractor.extract(makeFakeScrapeResults());

        // generateText should have been called twice: once for groq (fail), once for cerebras (success)
        expect(mockGenerateText).toHaveBeenCalledTimes(2);

        // Article should still be saved in MongoDB
        const col = getCollection(TEST_COLLECTION);
        const docs = await col.find({}).toArray();
        expect(docs).toHaveLength(1);
        expect(docs[0].title_english).toBe('Test: Dhaka Sees Heavy Rainfall');
    });

    it('should skip a failed provider for all subsequent articles', async () => {
        // 3 articles, 2 providers [groq, cerebras]
        // groq fails on article 1, cerebras succeeds for all 3
        mockGenerateText
            .mockRejectedValueOnce(new Error('groq down') as never)     // article 1, groq → fail
            .mockResolvedValueOnce({ output: DUMMY_EXTRACTION } as never) // article 1, cerebras → ok
            .mockResolvedValueOnce({ output: DUMMY_EXTRACTION } as never) // article 2, cerebras → ok (groq skipped)
            .mockResolvedValueOnce({ output: DUMMY_EXTRACTION } as never); // article 3, cerebras → ok (groq skipped)

        const registry = makeMultiProviderRegistry(['groq', 'cerebras']);
        const extractor = new Extractor(registry as any, 0);
        await extractor.extract(makeMultiArticleScrapeResults(3));

        // 4 calls total: 1 failed groq + 3 successful cerebras
        expect(mockGenerateText).toHaveBeenCalledTimes(4);

        // All 3 articles should be in MongoDB
        const col = getCollection(TEST_COLLECTION);
        const docs = await col.find({}).toArray();
        expect(docs).toHaveLength(3);
    });

    it('should count an article as failed when all providers fail', async () => {
        mockGenerateText
            .mockRejectedValueOnce(new Error('groq down') as never)
            .mockRejectedValueOnce(new Error('cerebras down') as never);

        const registry = makeMultiProviderRegistry(['groq', 'cerebras']);
        const extractor = new Extractor(registry as any, 0);
        await extractor.extract(makeFakeScrapeResults());

        // Both providers tried and failed
        expect(mockGenerateText).toHaveBeenCalledTimes(2);

        // No documents should be in MongoDB
        const col = getCollection(TEST_COLLECTION);
        const docs = await col.find({}).toArray();
        expect(docs).toHaveLength(0);
    });

    it('should try next provider when output is null and succeed', async () => {
        // First provider returns null output (no error), second succeeds
        mockGenerateText
            .mockResolvedValueOnce({ output: null } as never)
            .mockResolvedValueOnce({ output: DUMMY_EXTRACTION } as never);

        const registry = makeMultiProviderRegistry(['groq', 'cerebras']);
        const extractor = new Extractor(registry as any, 0);
        await extractor.extract(makeFakeScrapeResults());

        // groq returned null output — no error thrown, so it falls through to cerebras
        expect(mockGenerateText).toHaveBeenCalledTimes(2);

        // cerebras succeeded, so the article should be saved
        const col = getCollection(TEST_COLLECTION);
        const docs = await col.find({}).toArray();
        expect(docs).toHaveLength(1);
        expect(docs[0].title_english).toBe('Test: Dhaka Sees Heavy Rainfall');
    });

    it('should retry with next API key before falling back to the next provider', async () => {
        // groq has 2 keys: key 1 fails, key 2 succeeds
        mockGenerateText
            .mockRejectedValueOnce(new Error('Rate limit on key 1') as never)  // groq key 1 → fail
            .mockResolvedValueOnce({ output: DUMMY_EXTRACTION } as never);     // groq key 2 → ok

        const registry = makeMultiProviderRegistry(['groq', 'cerebras'], 2);
        const extractor = new Extractor(registry as any, 0);
        await extractor.extract(makeFakeScrapeResults());

        // 2 calls: groq key 1 (fail) + groq key 2 (success). cerebras never tried.
        expect(mockGenerateText).toHaveBeenCalledTimes(2);

        const col = getCollection(TEST_COLLECTION);
        const docs = await col.find({}).toArray();
        expect(docs).toHaveLength(1);
        expect(docs[0].title_english).toBe('Test: Dhaka Sees Heavy Rainfall');
    });

    it('should exhaust all keys of a provider before falling back to the next', async () => {
        // groq has 2 keys, both fail. cerebras succeeds.
        mockGenerateText
            .mockRejectedValueOnce(new Error('groq key 1 down') as never)   // groq key 1 → fail
            .mockRejectedValueOnce(new Error('groq key 2 down') as never)   // groq key 2 → fail
            .mockResolvedValueOnce({ output: DUMMY_EXTRACTION } as never);  // cerebras → ok

        const registry = makeMultiProviderRegistry(['groq', 'cerebras'], 2);
        const extractor = new Extractor(registry as any, 0);
        await extractor.extract(makeFakeScrapeResults());

        // 3 calls: groq key 1 (fail) + groq key 2 (fail) + cerebras (success)
        expect(mockGenerateText).toHaveBeenCalledTimes(3);

        const col = getCollection(TEST_COLLECTION);
        const docs = await col.find({}).toArray();
        expect(docs).toHaveLength(1);
        expect(docs[0].title_english).toBe('Test: Dhaka Sees Heavy Rainfall');
    });
});

describe('Integration: scrape → extract (mocked AI) → MongoDB', () => {
    it('should extract an article and store it in MongoDB', async () => {
        const extractor = new Extractor(makeMockRegistry() as any, 0);
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
});
