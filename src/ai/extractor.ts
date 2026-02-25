import type { ProviderRegistry } from "./provider.js";
import type { ProviderName } from "./types.js";
import { RawArticle, ScrapeResult } from "../types.js";
import { generateText, Output } from "ai";
import { ArticleExtractionSchema } from "./extractionOutputSchema.js";
import { insertOne } from "../database/db.js";
import { loadCache, hasURL, addURL } from "../database/url-cache.js";

function getCollectionName(): string {
    return process.env.MONGO_COLLECTION || 'articles';
}

const RETRY_DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Filter out articles whose URLs already exist in the local cache.
export async function filterNewArticles(scrapeResults: ScrapeResult[]): Promise<RawArticle[]> {
    await loadCache();

    const allArticles: RawArticle[] = [];
    for (const result of scrapeResults) {
        for (const article of result.articles) {
            allArticles.push(article);
        }
    }

    const newArticles: RawArticle[] = [];
    let skipped = 0;

    for (const article of allArticles) {
        if (await hasURL(article.url)) {
            skipped++;
        } else {
            newArticles.push(article);
        }
    }

    console.log(`[Extractor] ${allArticles.length} total articles, ${skipped} already extracted, ${newArticles.length} new`);
    return newArticles;
}

export class Extractor {
    private registry: ProviderRegistry;

    constructor(registry: ProviderRegistry) {
        this.registry = registry;
    }

    private buildPrompt(article: RawArticle): string {
        return `
    You are a structured data extraction engine for a Bengali news aggregator.

    RULES:
    - Never invent or infer information not explicitly present in the article.
    - All text output must be in English. Translate or transliterate from Bengali.
    - For casualties, monetary figures, and statements: only extract what is 
      explicitly written. Do not estimate or assume.
    - For government_action: return null if the article is not primarily about 
      a government decision, policy, or regulatory action.
    - For statements: skip any statement where the speaker is not named.
    - sentiment reflects the factual tone of the content, not moral judgment. 
      A corruption arrest is neutral. A flood with deaths is negative.
    - tags must match the category you select. Do not mix tag structures.
    - For publish_date: convert Bengali numerals if needed (১=1, ২=2, ৩=3, 
      ৪=4, ৫=5, ৬=6, ৭=7, ৮=8, ৯=9, ০=0). Return YYYY-MM-DD format.

    ---

    ARTICLE:

    TITLE: ${article.title}
    PUBLISH DATE: ${article.publishedAt ?? "Not provided"}
    CONTENT:
    ${article.content}
      `.trim();
    }

    async extract(articles: ScrapeResult[]) {
        const providerOrder = this.registry.getProviderOrder();
        console.log("provider order :", providerOrder);

        const newArticles = await filterNewArticles(articles);

        if (newArticles.length === 0) {
            console.log("[Extractor] No new articles to extract. Skipping.");
            return;
        }

        const skippedProviders = new Set<ProviderName>();
        let extracted = 0;
        let failed = 0;

        for (const article of newArticles) {
            console.log(`[Extractor] Extracting: ${article.title}`);
            let articleDone = false;

            for (const provider of providerOrder) {
                if (skippedProviders.has(provider)) continue;

                try {
                    const { model, model_name } = this.registry.createModel({ provider });
                    console.log(`[Extractor] Trying provider: ${provider} (model: ${model_name})`);

                    const { output } = await generateText({
                        model: model,
                        output: Output.object({
                            schema: ArticleExtractionSchema,
                        }),
                        prompt: this.buildPrompt(article),
                    });

                    if (output) {
                        const doc = {
                            ...output,
                            url: article.url,
                            source: article.source,
                            scrapedAt: new Date().toISOString(),
                            extractedAt: new Date().toISOString(),
                        };

                        await insertOne(getCollectionName(), doc);
                        await addURL(article.url);
                        extracted++;
                        console.log(`[Extractor] Saved: ${output.title_english}`);
                        articleDone = true;
                        break;
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error(`[Extractor] Provider ${provider} failed for "${article.title}": ${message}`);
                    skippedProviders.add(provider);
                    console.log(`[Extractor] Skipping provider ${provider} for remaining articles`);

                    // Delay before trying the next provider, if any remain
                    const remainingProviders = providerOrder.filter(p => !skippedProviders.has(p));
                    if (remainingProviders.length > 0) {
                        console.log(`[Extractor] Waiting ${RETRY_DELAY_MS}ms before trying next provider...`);
                        await delay(RETRY_DELAY_MS);
                    }
                }
            }

            if (!articleDone) {
                failed++;
                console.error(`[Extractor] All providers failed for "${article.title}"`);
            }
        }

        const skippedList = skippedProviders.size > 0 ? `, Skipped providers: [${[...skippedProviders].join(', ')}]` : '';
        console.log(`[Extractor] Done. Extracted: ${extracted}, Failed: ${failed}${skippedList}`);
    }
}
