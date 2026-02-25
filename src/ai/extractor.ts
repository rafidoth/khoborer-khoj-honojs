import { type LanguageModelUsage } from "ai";
import type { ProviderRegistry } from "./provider.js";
import { RawArticle, ScrapeResult } from "../types.js";
import { generateText, Output } from "ai";
import { ArticleExtractionSchema } from "./extractionOutputSchema.js";
import { insertOne } from "../database/db.js";
import { loadCache, hasURL, addURL } from "../database/url-cache.js";


function mapUsage(usage: LanguageModelUsage) {
    return {
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
        totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    };
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

    private async filterNewArticles(scrapeResults: ScrapeResult[]): Promise<RawArticle[]> {
        await loadCache();

        const allArticles: RawArticle[] = [];
        // articles from all sources
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

    async extract(articles: ScrapeResult[]) {
        console.log("provider order :", this.registry.getProviderOrder());

        const newArticles = await this.filterNewArticles(articles);

        if (newArticles.length === 0) {
            console.log("[Extractor] No new articles to extract. Skipping.");
            return;
        }

        const { model, provider, model_name } = this.registry.createModel();
        console.log(`[Extractor] Using model: ${model_name}`);

        let extracted = 0;
        let failed = 0;

        for (const article of newArticles) {
            try {
                console.log(`[Extractor] Extracting: ${article.title}`);

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

                    await insertOne("articles", doc);
                    await addURL(article.url);
                    extracted++;
                    console.log(`[Extractor] Saved: ${output.title_english}`);
                }
            } catch (err) {
                failed++;
                console.error(`[Extractor] Failed to extract "${article.title}":`, err);
            }
        }

        console.log(`[Extractor] Done. Extracted: ${extracted}, Failed: ${failed}`);
    }
}
