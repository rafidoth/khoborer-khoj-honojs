import { MongoClient, Db, Collection, OptionalUnlessRequiredId, Filter, WithId, Document } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'khoborer-khoj';

if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
}

let client: MongoClient | null = null;
let db: Db | null = null;

export function getCollectionName(): string {
    return process.env.MONGO_COLLECTION || 'articles';
}

export async function connectDB(): Promise<Db> {
    if (db) return db;

    client = new MongoClient(MONGODB_URI!);
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`Connected to MongoDB database: ${DB_NAME}`);
    return db;
}

export async function disconnectDB(): Promise<void> {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log('Disconnected from MongoDB');
    }
}

export function getCollection<T extends Document>(name: string): Collection<T> {
    if (!db) {
        throw new Error('Database not connected. Call connectDB() first.');
    }
    return db.collection<T>(name);
}

export async function getRecentlyExtractedURLs(
    collectionName: string,
    hoursAgo: number = 34,
): Promise<Set<string>> {
    const col = getCollection(collectionName);
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    const docs = await col
        .find(
            { extractedAt: { $gte: cutoff } },
            { projection: { url: 1, _id: 0 } },
        )
        .toArray();
    return new Set(docs.map(d => d.url as string));
}

export async function insertOne<T extends Document>(
    collectionName: string,
    doc: OptionalUnlessRequiredId<T>,
): Promise<string> {
    const col = getCollection<T>(collectionName);
    const result = await col.insertOne(doc);
    return result.insertedId.toString();
}

export async function insertMany<T extends Document>(
    collectionName: string,
    docs: OptionalUnlessRequiredId<T>[],
): Promise<number> {
    const col = getCollection<T>(collectionName);
    const result = await col.insertMany(docs);
    return result.insertedCount;
}

export async function findOne<T extends Document>(
    collectionName: string,
    filter: Filter<T>,
): Promise<WithId<T> | null> {
    const col = getCollection<T>(collectionName);
    return col.findOne(filter);
}

export async function findMany<T extends Document>(
    collectionName: string,
    filter: Filter<T> = {} as Filter<T>,
    limit = 100,
): Promise<WithId<T>[]> {
    const col = getCollection<T>(collectionName);
    return col.find(filter).limit(limit).toArray();
}

export async function updateOne<T extends Document>(
    collectionName: string,
    filter: Filter<T>,
    update: Partial<T>,
): Promise<boolean> {
    const col = getCollection<T>(collectionName);
    const result = await col.updateOne(filter, { $set: update });
    return result.modifiedCount > 0;
}

export async function deleteOne<T extends Document>(
    collectionName: string,
    filter: Filter<T>,
): Promise<boolean> {
    const col = getCollection<T>(collectionName);
    const result = await col.deleteOne(filter);
    return result.deletedCount > 0;
}
