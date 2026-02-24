import { generateObject, type LanguageModelUsage, type FlexibleSchema, type InferSchema } from "ai";
import type { ProviderRegistry } from "./provider.js";

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
}
