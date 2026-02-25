import puppeteer, { type Browser, type Page } from 'puppeteer';
import type { RawArticle, SourceName, Scraper } from '../types.js';

const SUB_TOPICS = ['bangladesh', 'politics', 'business'];

const CHROME_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--no-first-run',
];

function isValidArticleLink(href: string): boolean {
    try {
        const url = new URL(href);
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length < 2) return false;

        const lastSegment = segments[segments.length - 1];
        return /^[a-z0-9]+$/.test(lastSegment) && /[0-9]/.test(lastSegment) && lastSegment.length === 10;
    } catch {
        return false;
    }
}

async function scrollToBottom(page: Page): Promise<void> {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 300;
            const timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 200);
        });
    });
}

async function collectLinks(page: Page, subTopics: string[]): Promise<string[]> {
    return page.evaluate((topics: string[]): string[] => {
        const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href]');
        const result: string[] = [];
        anchors.forEach((a) => {
            const matchesTopic = topics.some((topic) => a.href.includes(`/${topic}/`));
            if (matchesTopic && !result.includes(a.href)) {
                result.push(a.href);
            }
        });
        return result;
    }, subTopics);
}

async function collectIndividualArticle(page: Page, url: string, sourceName: SourceName): Promise<RawArticle> {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

    const article = await page.evaluate((): { title: string; publishedAt: string; content: string } => {
        const titleEl = document.querySelector<HTMLHeadingElement>('h1[data-title-0]');
        const title = titleEl?.textContent?.trim() ?? '';

        const timeEl = document.querySelector<HTMLTimeElement>('time[dateTime]');
        const publishedAt = timeEl?.getAttribute('dateTime') ?? '';

        const paragraphs = document.querySelectorAll<HTMLParagraphElement>(
            '.story-element-text:not(.story-element-text-also-read) p',
        );
        const content = Array.from(paragraphs)
            .map((p) => p.textContent?.trim() ?? '')
            .filter(Boolean)
            .join('\n\n');

        return { title, publishedAt, content };
    });

    return {
        title: article.title,
        url,
        source: sourceName,
        publishedAt: article.publishedAt || undefined,
        content: article.content || undefined,
    };
}

async function closeBrowser(browser: Browser): Promise<void> {
    try {
        await browser.close();
    } catch {
        // Browser already closed or crashed, nothing to do.
    }
}

export class ProthomAloScraper implements Scraper {
    source = {
        name: 'Prothom Alo' as const,
        baseUrl: 'https://www.prothomalo.com',
    };

    async scrape(): Promise<RawArticle[]> {
        const browser = await puppeteer.launch({
            headless: true,
            args: CHROME_ARGS,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        });

        try {
            const scrapedLinks = new Set<string>();

            for (const subTopic of SUB_TOPICS) {
                const page = await browser.newPage();
                const targetUrl = `${this.source.baseUrl}/${subTopic}`;

                try {
                    console.log(`[${this.source.name}] loading ${targetUrl}`);
                    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60_000 });
                    await scrollToBottom(page);
                    await new Promise((r) => setTimeout(r, 2000));

                    const links = await collectLinks(page, SUB_TOPICS);
                    for (const link of links) {
                        if (isValidArticleLink(link)) {
                            scrapedLinks.add(link);
                        }
                    }

                    console.log(`[${this.source.name}] ${subTopic}: ${links.length} raw links, ${scrapedLinks.size} valid total`);
                } catch (err) {
                    console.error(`[${this.source.name}] failed to collect links from ${subTopic}:`, err);
                } finally {
                    await page.close();
                }
            }

            const allLinks = Array.from(scrapedLinks);
            const articles: RawArticle[] = [];

            for (const link of allLinks) {
                const page = await browser.newPage();
                try {
                    console.log(`[${this.source.name}] reading article ${link}`);
                    const article = await collectIndividualArticle(page, link, this.source.name);
                    if (article.content) {
                        articles.push(article);
                    }
                } catch (err) {
                    console.error(`[${this.source.name}] failed to read ${link}:`, err);
                } finally {
                    await page.close();
                }
            }

            console.log(`[${this.source.name}] collected ${articles.length} articles from ${allLinks.length} links`);
            return articles;
        } finally {
            await closeBrowser(browser);
        }
    }
}
