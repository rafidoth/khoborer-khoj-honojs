import type { LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createCerebras } from "@ai-sdk/cerebras";
import type { ProviderName, ProviderFactory, ProviderModelConfig } from "./types.js";
import type { KeyManager } from "./key-manager.js";

const providerFactories: Record<ProviderName, ProviderFactory> = {
    google: (modelId, apiKey, baseURL) => {
        const provider = createGoogleGenerativeAI({ apiKey, baseURL });
        return provider(modelId);
    },
    groq: (modelId, apiKey, baseURL) => {
        const provider = createGroq({ apiKey, baseURL });
        return provider(modelId);
    },
    cerebras: (modelId, apiKey, baseURL) => {
        const provider = createCerebras({ apiKey, baseURL });
        return provider(modelId);
    },
};

// Default models per provider 
const DEFAULT_MODELS: Record<ProviderName, string> = {
    google: "gemini-2.0-flash",
    groq: "openai/gpt-oss-120b",
    cerebras: "gpt-oss-120b",
};

export class ProviderRegistry {
    private keyManager: KeyManager;
    private providerOrder: ProviderName[];
    private modelOverrides = new Map<ProviderName, string>();

    constructor(keyManager: KeyManager, providerOrder?: ProviderName[]) {
        this.keyManager = keyManager;
        this.providerOrder =
            providerOrder ?? keyManager.getAvailableProviders();
    }

    setProviderOrder(order: ProviderName[]): void {
        this.providerOrder = order;
    }

    getModelId(provider: ProviderName): string {
        return this.modelOverrides.get(provider) ?? DEFAULT_MODELS[provider];
    }

    getProviderOrder(): ProviderName[] {
        return [...this.providerOrder];
    }

    createModel(config?: ProviderModelConfig): {
        model: LanguageModel;
        provider: ProviderName;
        model_name: string;
    } {
        const provider = config?.provider ?? this.providerOrder[0];
        if (!provider) {
            throw new Error(
                "No providers available. Register API keys first.",
            );
        }

        const model_name = config?.model ?? this.getModelId(provider);
        const apiKey = this.keyManager.getNextKey(provider);
        const factory = providerFactories[provider];
        const model = factory(model_name, apiKey, config?.baseURL);

        return { model, provider, model_name };
    }
}

export { DEFAULT_MODELS };
