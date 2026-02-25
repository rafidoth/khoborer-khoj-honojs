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

    extract(articles: ScrapeResult[]) {
        console.log("provider order :", this.registry.getProviderOrder())
        const { model, provider, model_name } = this.registry.createModel()
        console.log(model_name)
        console.log("scraped ", articles[0].articles[0].title)
    }
}
