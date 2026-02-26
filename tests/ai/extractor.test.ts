import { connectDB, disconnectDB, getCollection, insertOne, getRecentlyExtractedURLs } from '../../src/database/db';

const TEST_COLLECTION = '__test_extractor_dedup';

beforeAll(async () => {
    await connectDB();
}, 15000);

afterAll(async () => {
    const col = getCollection(TEST_COLLECTION);
    await col.drop().catch(() => {});
    await disconnectDB();
});

afterEach(async () => {
    const col = getCollection(TEST_COLLECTION);
    await col.deleteMany({});
});

describe('getRecentlyExtractedURLs', () => {
    it('should return empty set when collection is empty', async () => {
        const urls = await getRecentlyExtractedURLs(TEST_COLLECTION, 34);
        expect(urls).toBeInstanceOf(Set);
        expect(urls.size).toBe(0);
    });

    it('should return URLs extracted within the time window', async () => {
        const now = new Date();
        await insertOne(TEST_COLLECTION, {
            url: 'https://example.com/recent-1',
            extractedAt: now.toISOString(),
        });
        await insertOne(TEST_COLLECTION, {
            url: 'https://example.com/recent-2',
            extractedAt: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(), // 10 hours ago
        });

        const urls = await getRecentlyExtractedURLs(TEST_COLLECTION, 34);
        expect(urls.size).toBe(2);
        expect(urls.has('https://example.com/recent-1')).toBe(true);
        expect(urls.has('https://example.com/recent-2')).toBe(true);
    });

    it('should exclude URLs extracted outside the time window', async () => {
        const now = new Date();
        // Recent — within 34h
        await insertOne(TEST_COLLECTION, {
            url: 'https://example.com/fresh',
            extractedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        });
        // Old — outside 34h
        await insertOne(TEST_COLLECTION, {
            url: 'https://example.com/stale',
            extractedAt: new Date(now.getTime() - 40 * 60 * 60 * 1000).toISOString(), // 40 hours ago
        });

        const urls = await getRecentlyExtractedURLs(TEST_COLLECTION, 34);
        expect(urls.size).toBe(1);
        expect(urls.has('https://example.com/fresh')).toBe(true);
        expect(urls.has('https://example.com/stale')).toBe(false);
    });

    it('should respect a custom hoursAgo parameter', async () => {
        const now = new Date();
        await insertOne(TEST_COLLECTION, {
            url: 'https://example.com/edge',
            extractedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        });

        // With a 2-hour window, the 3-hour-old doc should be excluded
        const narrow = await getRecentlyExtractedURLs(TEST_COLLECTION, 2);
        expect(narrow.size).toBe(0);

        // With a 4-hour window, it should be included
        const wide = await getRecentlyExtractedURLs(TEST_COLLECTION, 4);
        expect(wide.size).toBe(1);
        expect(wide.has('https://example.com/edge')).toBe(true);
    });
});
