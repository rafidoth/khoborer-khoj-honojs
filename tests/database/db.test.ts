import { connectDB, disconnectDB, getCollection, insertOne, findOne, findMany, updateOne, deleteOne } from '../../src/database/db';

const TEST_COLLECTION = '__test_db_crud';

beforeAll(async () => {
    await connectDB();
}, 15000);

afterAll(async () => {
    // Clean up: drop the test collection entirely
    const col = getCollection(TEST_COLLECTION);
    await col.drop().catch(() => { }); // ignore if doesn't exist
    await disconnectDB();
});

afterEach(async () => {
    // Clear test data between tests
    const col = getCollection(TEST_COLLECTION);
    await col.deleteMany({});
});

describe('MongoDB connection', () => {
    it('connectDB() should return a Db instance', async () => {
        const db = await connectDB();
        expect(db).toBeDefined();
        expect(db.databaseName).toBe(process.env.DB_NAME || 'khoborer-khoj');
    });

    it('getCollection() should return a collection reference', () => {
        const col = getCollection(TEST_COLLECTION);
        expect(col).toBeDefined();
        expect(col.collectionName).toBe(TEST_COLLECTION);
    });
});

describe('CRUD operations', () => {
    it('insertOne() should insert a document and return its ID', async () => {
        const id = await insertOne(TEST_COLLECTION, {
            title: 'Test Article',
            category: 'politics',
        });
        expect(id).toBeDefined();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    it('findOne() should retrieve an inserted document', async () => {
        await insertOne(TEST_COLLECTION, {
            title: 'Find Me',
            category: 'bangladesh',
        });

        const doc = await findOne(TEST_COLLECTION, { title: 'Find Me' });
        expect(doc).not.toBeNull();
        expect(doc!.title).toBe('Find Me');
        expect(doc!.category).toBe('bangladesh');
    });

    it('findOne() should return null for non-existent document', async () => {
        const doc = await findOne(TEST_COLLECTION, { title: 'Does Not Exist' });
        expect(doc).toBeNull();
    });

    it('findMany() should return matching documents', async () => {
        await insertOne(TEST_COLLECTION, { title: 'A', category: 'politics' });
        await insertOne(TEST_COLLECTION, { title: 'B', category: 'politics' });
        await insertOne(TEST_COLLECTION, { title: 'C', category: 'business' });

        const politicsDocs = await findMany(TEST_COLLECTION, { category: 'politics' });
        expect(politicsDocs).toHaveLength(2);

        const allDocs = await findMany(TEST_COLLECTION);
        expect(allDocs).toHaveLength(3);
    });

    it('findMany() should respect the limit parameter', async () => {
        await insertOne(TEST_COLLECTION, { title: 'A' });
        await insertOne(TEST_COLLECTION, { title: 'B' });
        await insertOne(TEST_COLLECTION, { title: 'C' });

        const docs = await findMany(TEST_COLLECTION, {}, 2);
        expect(docs).toHaveLength(2);
    });

    it('updateOne() should modify a document and return true', async () => {
        await insertOne(TEST_COLLECTION, {
            title: 'Old Title',
            category: 'politics',
        });

        const updated = await updateOne(
            TEST_COLLECTION,
            { title: 'Old Title' },
            { title: 'New Title' },
        );
        expect(updated).toBe(true);

        const doc = await findOne(TEST_COLLECTION, { title: 'New Title' });
        expect(doc).not.toBeNull();
        expect(doc!.title).toBe('New Title');
        // Original field should still be there
        expect(doc!.category).toBe('politics');
    });

    it('updateOne() should return false when no document matches', async () => {
        const updated = await updateOne(
            TEST_COLLECTION,
            { title: 'Ghost' },
            { title: 'Still Ghost' },
        );
        expect(updated).toBe(false);
    });

    it('deleteOne() should remove a document and return true', async () => {
        await insertOne(TEST_COLLECTION, { title: 'Delete Me' });

        const deleted = await deleteOne(TEST_COLLECTION, { title: 'Delete Me' });
        expect(deleted).toBe(true);

        const doc = await findOne(TEST_COLLECTION, { title: 'Delete Me' });
        expect(doc).toBeNull();
    });

    it('deleteOne() should return false when no document matches', async () => {
        const deleted = await deleteOne(TEST_COLLECTION, { title: 'Ghost' });
        expect(deleted).toBe(false);
    });
});
