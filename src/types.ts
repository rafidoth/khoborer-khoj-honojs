export type SourceName = "Prothom Alo" | "Somoy News";

export interface NewsSource {
    name: SourceName;
    baseUrl: string;
}

// A raw single news article extracted from a source */
export interface RawArticle {
    title: string;
    url: string;
    source: SourceName;
    publishedAt?: string;
    content?: string;
    imageUrl?: string;
}

export interface ArticleAnchor {
    url: string;
    source: SourceName;
}

// Result returned by a scraper after one run 
export interface ScrapeResult {
    source: SourceName;
    articles: RawArticle[];
    scrapedAt: string;
}

//Contract every scraper must implement
export interface Scraper {
    source: NewsSource;
    scrape(): Promise<RawArticle[]>;
}
