/**
 * ## Quick start
 *
 * ```ts
 * import { createAIExtractor } from "./ai/index.js";
 * import { z } from "zod";
 *
 * // 1. Set env vars (or pass keys manually):
 * //    OPENAI_API_KEY=sk-...
 * //    GROQ_API_KEY=gsk_...
 * //    GROQ_API_KEY_1=gsk_...   (rotation — multiple keys per provider)
 *
 * // 2. Create the extractor (auto-loads keys from env)
 * const extractor = createAIExtractor();
 *
 * // 3. Define your schema
 * const schema = z.object({
 *   summary: z.string(),
 *   category: z.enum(["politics", "business", "sports"]),
 * });
 *
 * // 4. Extract
 * const result = await extractor.extract({
 *   schema,
 *   systemPrompt: "Summarize this article.",
 *   userPrompt: article.content,
 * });
 *
 * if (result.ok) {
 *   console.log(result.data.summary);
 * }
 * ```
 */

export { KeyManager } from "./key-manager.js";
export { ProviderRegistry, DEFAULT_MODELS } from "./provider.js";
export { Extractor } from "./extractor.js";
export type {
    ProviderName,
    PROVIDER_NAMES,
    APIKeyEntry,
    ProviderKeyConfig,
    ProviderModelConfig,
    ExtractionOptions,
    ExtractionSuccess,
    ExtractionFailure,
    ExtractionResult,
    ProviderFactory,
} from "./types.js";

import { KeyManager } from "./key-manager.js";
import { ProviderRegistry } from "./provider.js";
import { Extractor } from "./extractor.js";
import type { ProviderName } from "./types.js";


export interface CreateAIExtractorOptions {
    // If true, automatically load API keys from environment variables.
    loadFromEnv?: boolean;
    // providers run on this order 
    providerOrder?: ProviderName[];
}

export function createAIExtractor(options: CreateAIExtractorOptions = {}) {
    const { loadFromEnv = true, providerOrder } = options;

    const keyManager = new KeyManager();
    if (loadFromEnv) {
        keyManager.loadFromEnv();
    }

    const registry = new ProviderRegistry(keyManager, providerOrder);
    const extractor = new Extractor(registry);

    return { extractor, keyManager, registry };
}
