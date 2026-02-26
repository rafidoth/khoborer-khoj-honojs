import type { ProviderRegistry } from "./provider.js";
import type { ProviderName } from "./types.js";
import { RawArticle, ScrapeResult } from "../types.js";
import { generateText, Output } from "ai";
import { ArticleExtractionSchema } from "./extractionOutputSchema.js";
import { insertOne, getCollectionName } from "../database/db.js";

const RETRY_DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class Extractor {
    private registry: ProviderRegistry;
    private articleDelayMs: number;

    constructor(registry: ProviderRegistry, articleDelayMs: number = 3000) {
        this.registry = registry;
        this.articleDelayMs = articleDelayMs;
    }
    private buildPrompt(article: RawArticle): string {
        return `
    You are a data extraction engine for a Bengali news pipeline.

    RULES:
    - All text output must be in English. Translate and transliterate from Bengali.
    - Extract only what is explicitly written. Never infer or invent.
    - For arrays: return empty array [] when not applicable. Never return null for arrays.
    - Bengali numeral conversion: ০=0 ১=1 ২=2 ৩=3 ৪=4 ৫=5 ৬=6 ৭=7 ৮=8 ৯=9
    - incident_type: populate only if category is "bangladesh", else []
    - event_type: populate only if category is "politics", "business", or "international", else []
    - political_parties: populate only if category is "politics", else []
    - sector: populate only if category is "business", else []
    - sentiment: judge the factual tone, not the moral weight of the event.
      A corruption arrest = "neutral". A flood with deaths = "negative".
    - is_update: true only if the article explicitly references a prior incident or case.

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

        const allArticles: RawArticle[] = [];
        for (const result of articles) {
            for (const article of result.articles) {
                allArticles.push(article);
            }
        }

        if (allArticles.length === 0) {
            console.log("[Extractor] No articles to extract. Skipping.");
            return;
        }

        console.log(`[Extractor] ${allArticles.length} articles to extract`);
        const newArticles = allArticles;

        const skippedProviders = new Set<ProviderName>();
        let extracted = 0;
        let failed = 0;

        for (const article of newArticles) {
            console.log(`[Extractor] Extracting: ${article.title}`);
            let articleDone = false;

            for (const provider of providerOrder) {
                if (skippedProviders.has(provider)) continue;

                const keyCount = this.registry.getKeyCount(provider);
                let providerExhausted = false;

                for (let keyAttempt = 0; keyAttempt < keyCount; keyAttempt++) {
                    try {
                        const { model, model_name } = this.registry.createModel({ provider });
                        console.log(`[Extractor] Trying provider: ${provider} (model: ${model_name}, key ${keyAttempt + 1}/${keyCount})`);

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
                            extracted++;
                            console.log(`[Extractor] Saved: ${output.title_english}`);
                            articleDone = true;
                            break;
                        }
                    } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        console.error(`[Extractor] Provider ${provider} (key ${keyAttempt + 1}/${keyCount}) failed for "${article.title}": ${message}`);

                        if (keyAttempt < keyCount - 1) {
                            console.log(`[Extractor] Retrying ${provider} with next API key...`);
                            await delay(RETRY_DELAY_MS);
                        } else {
                            providerExhausted = true;
                        }
                    }
                }

                if (articleDone) break;

                if (providerExhausted) {
                    skippedProviders.add(provider);
                    console.log(`[Extractor] All keys exhausted for ${provider}, skipping for remaining articles`);

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

            // Pause between articles to avoid rate limiting
            if (this.articleDelayMs > 0) {
                await delay(this.articleDelayMs);
            }
        }

        const skippedList = skippedProviders.size > 0 ? `, Skipped providers: [${[...skippedProviders].join(', ')}]` : '';
        console.log(`[Extractor] Done. Extracted: ${extracted}, Failed: ${failed}${skippedList}`);
    }
}
