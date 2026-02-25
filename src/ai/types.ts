import type { LanguageModel } from "ai";

export const PROVIDER_NAMES = [
    "google",
    "groq",
    "cerebras",
] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

//single API key 
export interface APIKeyEntry {
    key: string;
    label?: string;
}

// keys of single provider
export interface ProviderKeyConfig {
    provider: ProviderName;
    keys: APIKeyEntry[];
}

// model config for a provider 
export interface ProviderModelConfig {
    provider: ProviderName;
    model?: string;
    baseURL?: string;
}

export type ProviderFactory = (
    modelId: string,
    apiKey: string,
    baseURL?: string,
) => LanguageModel;
