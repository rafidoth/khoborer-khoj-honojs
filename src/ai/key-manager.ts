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

    getNextKey(provider: ProviderName): string {
        const entries = this.keys.get(provider);
        if (!entries || entries.length === 0) {
            throw new Error(
                `No API keys registered for provider "${provider}". ` +
                `Call addKeys("${provider}", [...]) first or set the corresponding env vars.`,
            );
        }

        const idx = this.indices.get(provider) ?? 0;
        const entry = entries[idx % entries.length];
        this.indices.set(provider, (idx + 1) % entries.length);
        return entry.key;
    }

    getKeyCount(provider: ProviderName): number {
        return this.keys.get(provider)?.length ?? 0;
    }

    hasKeys(provider: ProviderName): boolean {
        return this.getKeyCount(provider) > 0;
    }

    getAvailableProviders(): ProviderName[] {
        return [...this.keys.entries()]
            .filter(([, keys]) => keys.length > 0)
            .map(([name]) => name);
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
