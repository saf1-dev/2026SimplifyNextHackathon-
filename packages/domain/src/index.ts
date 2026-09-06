import { z } from "zod";

export const MarketplaceSchema = z.enum(["CAROUSELL", "SGBIKEMART", "UNKNOWN"]);
export type Marketplace = z.infer<typeof MarketplaceSchema>;

export const ListingStatusSchema = z.enum(["AVAILABLE", "RESERVED", "SOLD", "EXPIRED", "REMOVED", "UNKNOWN"]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const EngineClassSchema = z.enum(["2B", "2A", "2"]);
export type EngineClass = z.infer<typeof EngineClassSchema>;

export const PriceTypeSchema = z.enum(["FULL_PRICE", "DOWNPAYMENT", "MONTHLY_INSTALLMENT", "TOTAL_INSTALLMENT_PRICE", "UNKNOWN"]);
export type PriceType = z.infer<typeof PriceTypeSchema>;

export const EvidenceSourceSchema = z.enum([
  "MARKETPLACE_STRUCTURED",
  "MARKETPLACE_JSON_LD",
  "MARKETPLACE_META",
  "MARKETPLACE_DOM",
  "MARKETPLACE_DESCRIPTION",
  "GROQ_INTERPRETED",
  "USER_PROVIDED",
  "USER_CONFIRMED",
  "MIGRATED_LEGACY",
  "UNKNOWN",
]);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const ModificationImpactSchema = z.enum(["STOCK_NONE", "MINOR", "FUNCTIONAL", "PERFORMANCE", "SIGNIFICANT", "UNKNOWN"]);
export type ModificationImpact = z.infer<typeof ModificationImpactSchema>;

export const ConditionDimensionSchema = z.enum(["maintenance", "tyres", "chainSprocket", "rustCorrosion", "visibleDamage"]);
export type ConditionDimension = z.infer<typeof ConditionDimensionSchema>;

export const FieldEvidenceSchema = z.object({
  field: z.string().min(1).max(80),
  value: z.unknown().nullable(),
  source: EvidenceSourceSchema,
  confidence: z.number().min(0).max(1),
  evidenceSnippet: z.string().max(500).nullable().default(null),
  userConfirmed: z.boolean().default(false),
  observedAt: z.string().datetime().optional(),
});
export type FieldEvidence = z.infer<typeof FieldEvidenceSchema>;

export const ConditionEvidenceSchema = z.object({
  dimension: ConditionDimensionSchema,
  score: z.number().min(1).max(5).nullable(),
  source: EvidenceSourceSchema,
  reliability: z.number().min(0).max(1),
  evidenceSnippet: z.string().max(500).nullable().default(null),
});
export type ConditionEvidence = z.infer<typeof ConditionEvidenceSchema>;

const nullableText = z.string().trim().max(20_000).nullable().default(null);
const nullableNumber = z.number().finite().nullable().default(null);

export const ListingDraftSchema = z.object({
  marketplace: MarketplaceSchema,
  sourceListingId: z.string().trim().max(200).nullable().default(null),
  originalUrl: z.string().trim().max(2_000),
  canonicalUrl: z.string().trim().max(2_000).nullable().default(null),
  listingStatus: ListingStatusSchema.default("UNKNOWN"),
  brand: z.string().trim().min(1).max(100).nullable().default(null),
  model: z.string().trim().min(1).max(200).nullable().default(null),
  engineCc: z.number().int().positive().max(3_000).nullable().default(null),
  engineClass: EngineClassSchema.nullable().default(null),
  askingPriceSgd: z.number().positive().max(1_000_000).nullable().default(null),
  priceType: PriceTypeSchema.default("UNKNOWN"),
  mileageKm: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  registrationDate: z.string().date().nullable().default(null),
  ageYears: z.number().nonnegative().max(100).nullable().default(null),
  coeExpiry: z.string().date().nullable().default(null),
  coeRemainingYears: z.number().min(-20).max(30).nullable().default(null),
  roadTaxExpiry: z.string().date().nullable().default(null),
  numberOfOwners: z.number().int().nonnegative().max(100).nullable().default(null),
  location: z.string().trim().max(500).nullable().default(null),
  paymentOption: z.string().trim().max(500).nullable().default(null),
  sellerType: z.enum(["DIRECT_OWNER", "DEALER", "UNKNOWN"]).default("UNKNOWN"),
  maintenanceSummary: nullableText,
  accidentDisclosure: nullableText,
  modifications: nullableText,
  modificationImpact: ModificationImpactSchema.default("UNKNOWN"),
  descriptionText: nullableText,
  redFlags: z.array(z.string().trim().min(1).max(300)).default([]),
  conditionEvidence: z.array(ConditionEvidenceSchema).default([]),
  conditionScore: nullableNumber,
  conditionGroup: z.string().regex(/^COND(?:-[A-Z]+|[1-5])$/).default("COND-NA"),
  capturedAt: z.string().datetime(),
  extractionEvidence: z.array(FieldEvidenceSchema).default([]),
  dataQualityFlags: z.array(z.string().trim().min(1).max(160)).default([]),
  ingestionSource: z.enum(["EXTENSION", "LEGACY_MIGRATION", "TEST"]).default("EXTENSION"),
});
export type ListingDraft = z.infer<typeof ListingDraftSchema>;

export const ListingRecordSchema = ListingDraftSchema.extend({
  id: z.string().uuid(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  normalizedModel: z.string(),
  canonicalUrlHash: z.string(),
  duplicateFingerprint: z.string(),
  currentObservationId: z.string().uuid(),
});
export type ListingRecord = z.infer<typeof ListingRecordSchema>;

export const ListingObservationSchema = ListingDraftSchema.pick({
  listingStatus: true,
  askingPriceSgd: true,
  priceType: true,
  mileageKm: true,
  coeExpiry: true,
  coeRemainingYears: true,
  descriptionText: true,
  conditionEvidence: true,
  conditionScore: true,
  conditionGroup: true,
  extractionEvidence: true,
  dataQualityFlags: true,
  capturedAt: true,
  ingestionSource: true,
}).extend({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  descriptionHash: z.string(),
  agentTrace: z.array(z.object({ action: z.string(), outcome: z.string() })).default([]),
});
export type ListingObservation = z.infer<typeof ListingObservationSchema>;

export const ExtractedDraftSchema = ListingDraftSchema.extend({
  extractorVersion: z.string().min(1),
  deterministicFieldCount: z.number().int().nonnegative(),
});
export type ExtractedDraft = z.infer<typeof ExtractedDraftSchema>;

export const InterpretRequestSchema = z.object({ draft: ExtractedDraftSchema });
export type InterpretRequest = z.infer<typeof InterpretRequestSchema>;

export const InterpretResponseSchema = z.object({
  draft: ExtractedDraftSchema,
  aiEvidence: z.array(FieldEvidenceSchema),
  conflicts: z.array(z.object({ field: z.string(), selected: FieldEvidenceSchema, alternatives: z.array(FieldEvidenceSchema), material: z.boolean() })),
  missingCriticalFields: z.array(z.string()),
  trace: z.array(z.object({ action: z.string(), outcome: z.string() })),
});
export type InterpretResponse = z.infer<typeof InterpretResponseSchema>;

export const AnalyseRequestSchema = z.object({
  reviewedDraft: ListingDraftSchema,
  aiEvidence: z.array(FieldEvidenceSchema).default([]),
  userOverrides: z.array(z.object({
    field: z.string(),
    previousEvidence: FieldEvidenceSchema.nullable(),
    value: z.unknown().nullable(),
    confirmedAt: z.string().datetime(),
  })).default([]),
});
export type AnalyseRequest = z.infer<typeof AnalyseRequestSchema>;

export const DuplicateResultSchema = z.enum(["NEW_LISTING", "EXACT_DUPLICATE", "POSSIBLE_DUPLICATE"]);
export type DuplicateResult = z.infer<typeof DuplicateResultSchema>;

export const SearchIntentSchema = z.object({
  hardFilters: z.object({
    engineClass: EngineClassSchema.optional(),
    brands: z.array(z.string()).optional(),
    maxPriceSgd: z.number().positive().optional(),
    minCoeYears: z.number().nonnegative().optional(),
    maxMileageKm: z.number().positive().optional(),
    minEngineCc: z.number().nonnegative().optional(),
    maxEngineCc: z.number().positive().optional(),
  }),
  softPreferences: z.object({
    preferredBrands: z.array(z.string()).optional(),
    preferLowerMileage: z.boolean().optional(),
    preferMoreCoe: z.boolean().optional(),
    preferBetterCondition: z.boolean().optional(),
    usage: z.enum(["commuting", "touring", "sport", "delivery", "general"]).optional(),
  }),
  summary: z.string().min(1).max(300),
  source: z.enum(["groq", "fallback", "manual"]),
});
export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export function engineClassFromCc(cc: number | null): EngineClass | null {
  if (cc === null) return null;
  if (cc <= 200) return "2B";
  if (cc <= 400) return "2A";
  return "2";
}

export function normalizeListingStatus(value: string | null | undefined): ListingStatus {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "AVAILABLE" || normalized === "RESERVED" || normalized === "SOLD" || normalized === "EXPIRED" || normalized === "REMOVED") return normalized;
  return "UNKNOWN";
}

export function evidenceReliability(source: EvidenceSource): number {
  const map: Record<EvidenceSource, number> = {
    USER_CONFIRMED: 1,
    USER_PROVIDED: 0.95,
    MARKETPLACE_STRUCTURED: 1,
    MARKETPLACE_JSON_LD: 1,
    MARKETPLACE_META: 0.9,
    MARKETPLACE_DOM: 0.95,
    MARKETPLACE_DESCRIPTION: 0.75,
    GROQ_INTERPRETED: 0.75,
    MIGRATED_LEGACY: 0.45,
    UNKNOWN: 0,
  };
  return map[source];
}

export function identifyMissingCriticalFields(draft: ListingDraft): string[] {
  const missing: string[] = [];
  if (!draft.brand) missing.push("brand");
  if (!draft.model) missing.push("model");
  if (!draft.engineClass && !draft.engineCc) missing.push("engineClassOrCc");
  if (!draft.askingPriceSgd) missing.push("askingPriceSgd");
  if (draft.priceType === "UNKNOWN") missing.push("priceType");
  if (draft.priceType !== "FULL_PRICE" && draft.priceType !== "TOTAL_INSTALLMENT_PRICE") missing.push("fullAskingPrice");
  return [...new Set(missing)];
}
