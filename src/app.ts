import type { ScrapeResult } from './types.js';
import { scrapers } from './scrapers/index.js';
import { saveResults } from './storage.js';

/**
 * Main orchestrator — runs all registered scrapers concurrently and collects results.
 */
export default async function app(): Promise<ScrapeResult[]> {
	const results: ScrapeResult[] = [];

	const settled = await Promise.allSettled(
		scrapers.map(async (scraper) => {
			console.log(`[${scraper.source.name}] scraping ${scraper.source.baseUrl}`);
			const articles = await scraper.scrape();
			console.log(`[${scraper.source.name}] found ${articles.length} articles`);

			return {
				source: scraper.source.name,
				articles,
				scrapedAt: new Date().toISOString(),
			} satisfies ScrapeResult;
		}),
	);

	for (const result of settled) {
		if (result.status === 'fulfilled') {
			results.push(result.value);
		} else {
			console.error('Scraper failed:', result.reason);
		}
	}

	const totalArticles = results.reduce((sum, r) => sum + r.articles.length, 0);
	console.log(
		`Scrape complete: ${results.length}/${scrapers.length} sources succeeded, ${totalArticles} total articles`,
	);

	if (results.length > 0) {
		await saveResults(results);
	}

	return results;
}
