import { z } from "zod";

const StatementSchema = z.object({
    speaker: z.string().describe(
        "Full name of the person making the statement. Transliterate from Bengali."
    ),
    affiliation: z.string().nullable().describe(
        "Their organization, party, or title as mentioned in the article. null if not mentioned."
    ),
    statement_summary: z.string().describe(
        "Concise English summary of what they said. Max 20 words. Do not quote verbatim."
    ),
    statement_type: z.enum([
        "promise",
        "denial",
        "accusation",
        "announcement",
        "warning",
        "demand",
        "apology",
        "threat",
        "other",
    ]).describe(
        "The nature of the statement."
    ),
});

const CasualtiesSchema = z.object({
    killed: z.number().int().nullable(),
    injured: z.number().int().nullable(),
    missing: z.number().int().nullable(),
    arrested: z.number().int().nullable(),
    victim_gender: z.enum(["male", "female", "mixed", "unknown"]).nullable().describe(
        "Only if victims are specifically mentioned in the article."
    ),
    victim_age_group: z.enum(["child", "adult", "elderly", "mixed"]).nullable().describe(
        "Only if explicitly mentioned in the article."
    ),
    victim_profession: z.array(z.string()).nullable().describe(
        "Only if explicitly mentioned. e.g. garment worker, student."
    ),
});

const MonetaryFigureSchema = z.object({
    amount: z.number().describe(
        "Numeric value. Convert Bengali numerals to ASCII."
    ),
    unit: z.enum([
        "taka",
        "crore",
        "lakh",
        "thousand",
        "million",
        "billion",
        "dollar",
        "euro",
        "other",
    ]),
    currency: z.string().describe(
        "ISO currency code. Default BDT if not specified in article."
    ),
    context: z.string().describe(
        "What this money refers to. Max 15 words. e.g. allocated for flood relief in Sylhet."
    ),
});

const GovernmentActionSchema = z.object({
    action_type: z.enum([
        "policy_announcement",
        "policy_implementation",
        "policy_reversal",
        "project_approval",
        "project_completion",
        "project_delay",
        "law_passed",
        "law_repealed",
        "appointment",
        "removal",
        "ban",
        "subsidy",
        "tax_change",
        "regulatory_action",
        "other",
    ]),
    ministry_or_body: z.string().nullable().describe(
        "The government entity taking the action."
    ),
    action_status: z.enum([
        "announced",
        "approved",
        "implemented",
        "cancelled",
        "delayed",
        "under_review",
    ]),
    beneficiary_group: z.string().nullable().describe(
        "Who this action targets or benefits. e.g. small farmers, RMG workers."
    ),
    geographic_scope: z.enum([
        "national",
        "divisional",
        "district",
        "local",
    ]).nullable(),
});

const PoliticsTagsSchema = z.object({
    political_parties: z.array(z.string()).describe(
        "All political party names in English. Some current popular parties are BNP, Awami League, NCP, Jamat"
    ),
    politicians: z.array(z.string()).describe(
        "Names of politicians mentioned, even if already in the people field."
    ),
    government_bodies: z.array(z.string()).describe(
        "e.g. Parliament, Election Commission, High Court, Cabinet."
    ),
    event_type: z.array(z.enum([
        "election",
        "protest",
        "rally",
        "policy_announcement",
        "corruption_allegation",
        "arrest",
        "diplomatic_meeting",
        "court_verdict",
        "parliamentary_session",
        "resignation",
        "appointment",
        "violence",
        "statement",
        "strike",
        "other",
    ])),
});

const BangladeshTagsSchema = z.object({
    incident_type: z.array(z.enum([
        "murder",
        "rape",
        "sexual_assault",
        "robbery",
        "theft",
        "kidnapping",
        "arson",
        "road_accident",
        "fire",
        "flood",
        "cyclone",
        "stampede",
        "building_collapse",
        "strike",
        "protest",
        "mob_violence",
        "drug_related",
        "corruption",
        "child_abuse",
        "trafficking",
        "suicide",
        "industrial_accident",
        "other_crime",
        "other_disaster",
        "other_social",
    ])),
    affected_locations: z.array(z.string()).describe(
        "Specific localities where the incident occurred. As granular as the article allows."
    ),
    involved_institutions: z.array(z.string()).describe(
        "e.g. Police, RAB, Fire Service, DGHS."
    ),
});

const BusinessTagsSchema = z.object({
    sector: z.array(z.enum([
        "banking",
        "telecom",
        "garments_rmg",
        "real_estate",
        "agriculture",
        "energy",
        "import_export",
        "stock_market",
        "microfinance",
        "technology",
        "pharmaceuticals",
        "shipping",
        "aviation",
        "retail",
        "food",
        "tourism",
        "other",
    ])),
    companies: z.array(z.string()).describe(
        "Names of companies or brands mentioned, in English."
    ),
    economic_indicators: z.array(z.enum([
        "inflation",
        "remittance",
        "taka_exchange_rate",
        "gdp",
        "trade_deficit",
        "interest_rate",
        "dse_index",
        "cse_index",
        "foreign_reserve",
        "export_earnings",
        "import_cost",
        "other",
    ])),
    event_type: z.array(z.enum([
        "merger_acquisition",
        "bankruptcy_closure",
        "investment_announcement",
        "policy_change",
        "price_change",
        "earnings_report",
        "loan_default",
        "export_deal",
        "regulatory_action",
        "market_movement",
        "job_cut",
        "expansion",
        "fraud",
        "other",
    ])),
});

export const ArticleExtractionSchema = z.object({
    title_english: z.string().describe(
        "Translated English title. Not necessarily has to be translated from the original title, Should be based on the actual content. Max 15 words."
    ),
    title_original: z.string().nullable().describe(
        "The Bengali title exactly as provided."
    ),
    publish_date: z.string().nullable().describe(
        "Publication date in YYYY-MM-DD. Convert Bengali numerals. null if unparseable."
    ),
    category: z.enum([
        "politics",
        "bangladesh",
        "business",
        "international",
    ]).describe(
        "Choose the dominant category if the article spans more than one."
    ),
    sentiment: z.enum([
        "positive",
        "negative",
        "neutral",
    ]).describe(
        "Factual tone of the content. Not your moral judgment of the event."
    ),
    importance_score: z.number().int().min(1).max(5).describe(
        "5=national significance. 4=regional/sectoral. 3=routine newsworthy. 2=minor/incremental. 1=negligible."
    ),
    is_update: z.boolean().describe(
        "true if this is a follow-up to an already ongoing story."
    ),
    summary: z.string().describe(
        "3-sentence English summary. S1: what happened. S2: who and where. S3: outcome or significance. Max 80 words. No editorializing."
    ),
    locations: z.array(z.string()).describe(
        "All geographic locations mentioned. Transliterated to English."
    ),
    people: z.array(z.string()).max(8).describe(
        "Full names of named individuals. No unnamed references. Max 8."
    ),
    organizations: z.array(z.string()).max(8).describe(
        "All named organizations, institutions, ministries, companies. Max 8."
    ),
    statements: z.array(StatementSchema).describe(
        "Named attributed statements only. Skip any statement where the speaker is unnamed."
    ),
    casualties: CasualtiesSchema.describe(
        "Only figures explicitly stated. All null if article has no casualty information."
    ),
    monetary_figures: z.array(MonetaryFigureSchema).describe(
        "Every specific financial figure mentioned. Empty array if none."
    ),
    government_action: GovernmentActionSchema.nullable().describe(
        "Populate only if the article is primarily about a government decision, policy, or regulatory action. null otherwise."
    ),
    tags: z.discriminatedUnion("category", [
        z.object({ category: z.literal("politics"), ...PoliticsTagsSchema.shape }),
        z.object({ category: z.literal("bangladesh"), ...BangladeshTagsSchema.shape }),
        z.object({ category: z.literal("business"), ...BusinessTagsSchema.shape }),
    ]).describe(
        "Use the block matching the category you selected above."
    ),
});

export type ArticleExtraction = z.infer<typeof ArticleExtractionSchema>;
