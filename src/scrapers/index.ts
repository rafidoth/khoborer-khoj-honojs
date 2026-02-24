import type { Scraper } from '../types.js';
import { ProthomAloScraper } from './prothom-alo.js';

export const scrapers: Scraper[] = [
	new ProthomAloScraper(),
];
