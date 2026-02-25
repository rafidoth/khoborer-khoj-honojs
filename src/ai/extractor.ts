import { type LanguageModelUsage } from "ai";
import type { ProviderRegistry } from "./provider.js";
import { ScrapeResult } from "../types.js";

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

        console.log("provider order :", this.registry.getProviderOrder())
        const { model, provider, model_name } = this.registry.createModel()
        console.log(model_name)
        console.log("scraped ", articles[0].articles[0].title)
    }
}
