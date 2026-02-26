import { z } from "zod";

export const ArticleExtractionSchema = z.object({

    title_english: z.string().describe(
        "English title based on article content. Max 15 words."
    ),
    title_bangla: z.string().describe("Bengali title based on article content not following the original one."),
    publish_date: z.string().nullable().describe(
        "YYYY-MM-DD. Convert Bengali numerals (১=1 ২=2 ৩=3 ৪=4 ৫=5 ৬=6 ৭=7 ৮=8 ৯=9 ০=0). null if unparseable."
    ),
    category: z.enum(["politics", "bangladesh", "business", "international"]).describe(
        "Dominant category of the article."
    ),
    content_type: z.enum(["news", "opinion", "press_release", "other"]).describe(
        "news=factual event. opinion=personal argument. press_release=issued by institution. other=anything else."
    ),
    sentiment: z.enum(["positive", "negative", "neutral"]).describe(
        "Factual tone of the content, not moral judgment."
    ),
    importance_score: z.number().int().min(1).max(5).describe(
        "5=national significance. 4=regional impact. 3=routine newsworthy. 2=minor. 1=negligible."
    ),
    is_update: z.boolean().describe(
        "true if this is clearly a follow-up to an ongoing story."
    ),
    summary: z.string().describe(
        "3-sentence English summary. S1: what happened. S2: who and where. S3: outcome. Max 80 words. Facts only."
    ),

    // ── Entities ──────────────────────────────────────────────────
    locations: z.array(z.string()).describe(
        "Geographic locations mentioned. English names. e.g. ['Mirpur, Dhaka', 'Chattogram']. Empty array if none."
    ),
    people: z.array(z.string()).max(6).describe(
        "Named individuals only. Transliterated to English. Max 6. Empty array if none."
    ),
    organizations: z.array(z.string()).max(6).describe(
        "Named organizations, institutions, companies. In English. Max 6. Empty array if none."
    ),

    incident_type: z.array(z.enum([
        "murder", "rape", "sexual_assault", "robbery", "kidnapping",
        "arson", "road_accident", "fire", "flood", "cyclone",
        "building_collapse", "mob_violence", "drug_related",
        "corruption", "child_abuse", "trafficking", "suicide",
        "industrial_accident", "protest", "strike", "other",
    ])).describe(
        "Incident types. Populate for 'bangladesh' category. Empty array otherwise."
    ),
    event_type: z.array(z.enum([
        "election", "protest", "rally", "corruption_allegation",
        "arrest", "diplomatic_meeting", "court_verdict",
        "resignation", "appointment", "violence", "statement",
        "merger_acquisition", "investment_announcement", "policy_change",
        "price_change", "loan_default", "regulatory_action",
        "market_movement", "fraud", "other",
    ])).describe(
        "Event types. Populate for 'politics', 'business', 'international'. Empty array otherwise."
    ),
    political_parties: z.array(z.string()).describe(
        "Political party names in English. Populate for 'politics' only. Empty array otherwise."
    ),
    sector: z.array(z.enum([
        "banking", "telecom", "garments_rmg", "real_estate",
        "agriculture", "energy", "import_export", "stock_market",
        "technology", "pharmaceuticals", "other",
    ])).describe(
        "Business sectors. Populate for 'business' only. Empty array otherwise."
    ),

});

export type ArticleExtraction = z.infer<typeof ArticleExtractionSchema>;
