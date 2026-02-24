export { KeyManager } from "./key-manager.js";
export { ProviderRegistry, DEFAULT_MODELS } from "./provider.js";
export { Extractor } from "./extractor.js";
export type {
    ProviderName,
    PROVIDER_NAMES,
    APIKeyEntry,
    ProviderKeyConfig,
    ProviderModelConfig,
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
