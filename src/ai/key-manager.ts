import type { APIKeyEntry, ProviderName } from "./types.js";

export class KeyManager {
    private keys = new Map<ProviderName, APIKeyEntry[]>();
    private indices = new Map<ProviderName, number>();

    addKeys(provider: ProviderName, entries: APIKeyEntry[]): void {
        const existing = this.keys.get(provider) ?? [];
        existing.push(...entries);
        this.keys.set(provider, existing);
        if (!this.indices.has(provider)) {
            this.indices.set(provider, 0);
        }
    }
    /**
     *   Env Key naming should be like this     
     *   google     -> GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY_1, ...
     *   groq       -> GROQ_API_KEY, GROQ_API_KEY_1, ...
     *   cerebras   -> CEREBRAS_API_KEY, CEREBRAS_API_KEY_1, ...
     */
    loadFromEnv(): void {
        const envMap: Record<ProviderName, string> = {
            google: "GOOGLE_GENERATIVE_AI_API_KEY",
            groq: "GROQ_API_KEY",
            cerebras: "CEREBRAS_API_KEY",
        };

        for (const [provider, prefix] of Object.entries(envMap) as Array<
            [ProviderName, string]
        >) {
            const entries: APIKeyEntry[] = [];

            const baseVal = process.env[prefix];
            if (baseVal) {
                entries.push({ key: baseVal, label: `${prefix}` });
            }

            for (let i = 1; i <= 20; i++) {
                const envName = `${prefix}_${i}`;
                const val = process.env[envName];
                if (val) {
                    entries.push({ key: val, label: envName });
                }
            }

            if (entries.length > 0) {
                this.addKeys(provider, entries);
            }
        }
    }
}
