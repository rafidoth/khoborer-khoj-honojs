import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScrapeResult } from './types.js';

const DATA_DIR = process.env.DATA_DIR || './data';

export async function saveResults(results: ScrapeResult[]): Promise<string> {
	await mkdir(DATA_DIR, { recursive: true });

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filename = `scrape-${timestamp}.json`;
	const filepath = join(DATA_DIR, filename);

	await writeFile(filepath, JSON.stringify(results, null, 2), 'utf-8');
	console.log(`Results saved to ${filepath}`);

	return filepath;
}
