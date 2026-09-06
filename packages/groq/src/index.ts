import Groq from "groq-sdk";
import { z } from "zod";
import {
  ExtractedDraftSchema, InterpretResponseSchema, SearchIntentSchema,
  evidenceReliability, identifyMissingCriticalFields,
  type ExtractedDraft, type FieldEvidence, type InterpretResponse, type SearchIntent,
} from "@motomoto/domain";

const AiPatchSchema = z.object({
  maintenanceSummary: z.string().max(2_000).nullable().optional(),
  accidentDisclosure: z.string().max(1_000).nullable().optional(),
  modifications: z.string().max(2_000).nullable().optional(),
  modificationImpact: z.enum(["STOCK_NONE", "MINOR", "FUNCTIONAL", "PERFORMANCE", "SIGNIFICANT", "UNKNOWN"]).optional(),
  priceType: z.enum(["FULL_PRICE", "DOWNPAYMENT", "MONTHLY_INSTALLMENT", "TOTAL_INSTALLMENT_PRICE", "UNKNOWN"]).optional(),
  redFlags: z.array(z.string().max(200)).max(10).optional(),
});

function groqClient(): Groq | null {
  return process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
}

function fallbackPatch(description: string) {
  const maintenance = description.match(/[^.]*\b(?:servic(?:e|ed|ing)|maintenance|oil change|valve clearance)\b[^.]*/i)?.[0]?.trim() ?? null;
  const accident = description.match(/[^.]*\b(?:accident|collision|drop(?:ped)?)\b[^.]*/i)?.[0]?.trim() ?? null;
  const modifications = description.match(/[^.]*\b(?:modified|aftermarket|exhaust|tune|stock)\b[^.]*/i)?.[0]?.trim() ?? null;
  return {
    maintenanceSummary: maintenance,
    accidentDisclosure: accident,
    modifications,
    modificationImpact: /\b(?:tune|bore|engine swap|turbo)\b/i.test(modifications ?? "") ? "PERFORMANCE" as const : /\b(?:aftermarket|exhaust)\b/i.test(modifications ?? "") ? "MINOR" as const : /\bstock\b/i.test(modifications ?? "") ? "STOCK_NONE" as const : "UNKNOWN" as const,
    redFlags: /\b(?:urgent sale|no viewing|deposit first|no test)\b/i.test(description) ? ["Seller wording merits extra verification"] : [],
  };
}

function evidenceForPatch(patch: Record<string, unknown>, description: string, source: "GROQ_INTERPRETED" | "MARKETPLACE_DESCRIPTION", capturedAt: string): FieldEvidence[] {
  return Object.entries(patch)
    .filter(([, value]) => value !== null && value !== undefined && !(Array.isArray(value) && !value.length))
    .map(([field, value]) => ({ field, value, source, confidence: evidenceReliability(source), evidenceSnippet: description.slice(0, 500), userConfirmed: false, observedAt: capturedAt }));
}

export async function interpretDraft(input: ExtractedDraft): Promise<InterpretResponse> {
  const draft = ExtractedDraftSchema.parse(input);
  const description = draft.descriptionText ?? "";
  const client = groqClient();
  let patch: z.infer<typeof AiPatchSchema> = fallbackPatch(description);
  let source: "GROQ_INTERPRETED" | "MARKETPLACE_DESCRIPTION" = "MARKETPLACE_DESCRIPTION";
  let traceOutcome = "RULE_BASED_FALLBACK_NO_API_KEY";
  if (client && description) {
    const response = await client.chat.completions.create({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Extract only facts explicitly present in this sanitized Singapore motorcycle listing description. Never infer missing facts. Return JSON with maintenanceSummary, accidentDisclosure, modifications, modificationImpact, priceType, redFlags." },
        { role: "user", content: description },
      ],
    });
    patch = AiPatchSchema.parse(JSON.parse(response.choices[0]?.message?.content ?? "{}"));
    source = "GROQ_INTERPRETED";
    traceOutcome = "GROQ_SCHEMA_VALIDATED";
  }
  const merged = ExtractedDraftSchema.parse({ ...draft, ...patch, redFlags: [...draft.redFlags, ...(patch.redFlags ?? [])] });
  return InterpretResponseSchema.parse({
    draft: merged,
    aiEvidence: evidenceForPatch(patch as Record<string, unknown>, description, source, draft.capturedAt),
    conflicts: [],
    missingCriticalFields: identifyMissingCriticalFields(merged),
    trace: [{ action: "SANITIZE_DESCRIPTION", outcome: "CONTACT_DETAILS_REMOVED_BY_EXTENSION" }, { action: "INTERPRET_DESCRIPTION", outcome: traceOutcome }],
  });
}

function parseMoney(text: string): number | undefined {
  const match = text.match(/(?:under|max(?:imum)?|below|budget(?: of)?)\s*(?:S\s*)?\$?\s*([\d,.]+)\s*k?/i);
  if (!match) return undefined;
  const value = Number(match[1]?.replace(/,/g, ""));
  return /k/i.test(match[0]) ? value * 1_000 : value;
}

export function fallbackSearchIntent(query: string): SearchIntent {
  const lower = query.toLowerCase();
  const classMatch = lower.match(/\b(?:class\s*)?(2b|2a|2)\b/i)?.[1]?.toUpperCase() as "2B" | "2A" | "2" | undefined;
  const brandNames = ["Honda", "Yamaha", "Suzuki", "Kawasaki", "KTM", "Royal Enfield", "Triumph", "BMW", "Ducati"];
  const brands = brandNames.filter((brand) => lower.includes(brand.toLowerCase()));
  return SearchIntentSchema.parse({
    hardFilters: { engineClass: classMatch, brands: brands.length ? brands : undefined, maxPriceSgd: parseMoney(query) },
    softPreferences: { preferLowerMileage: /low(?:er)? mileage/i.test(query), preferMoreCoe: /(?:more|long) coe/i.test(query), usage: /commut/i.test(query) ? "commuting" : /tour/i.test(query) ? "touring" : /sport/i.test(query) ? "sport" : "general" },
    summary: query.slice(0, 300) || "All available motorcycles",
    source: "fallback",
  });
}

export async function parseSearchIntent(query: string): Promise<SearchIntent> {
  const client = groqClient();
  if (!client) return fallbackSearchIntent(query);
  const response = await client.chat.completions.create({
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile", temperature: 0, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Convert the search to JSON: hardFilters(engineClass,brands,maxPriceSgd,minCoeYears,maxMileageKm,minEngineCc,maxEngineCc), softPreferences(preferredBrands,preferLowerMileage,preferMoreCoe,preferBetterCondition,usage), summary, source='groq'. Omit unknown fields." },
      { role: "user", content: query.slice(0, 1_000) },
    ],
  });
  return SearchIntentSchema.parse(JSON.parse(response.choices[0]?.message?.content ?? "{}"));
}
