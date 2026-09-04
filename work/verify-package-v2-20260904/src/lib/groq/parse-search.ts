import Groq from "groq-sdk";
import { z } from "zod";
import type { HardSearchFilters, SearchIntent, SoftPreferences } from "../motorcycles/types";

const engineClass = z.enum(["2B", "2A", "2"]);
const intentSchema = z.object({
  hard_filters: z.object({
    engine_class: engineClass.optional(),
    brands: z.array(z.string()).optional(),
    max_price_sgd: z.number().positive().optional(),
    min_coe_years: z.number().nonnegative().optional(),
    max_mileage_km: z.number().positive().optional(),
    min_engine_cc: z.number().nonnegative().optional(),
    max_engine_cc: z.number().positive().optional(),
    min_age_years: z.number().nonnegative().optional(),
    max_age_years: z.number().positive().optional(),
  }).strict(),
  soft_preferences: z.object({
    preferred_brands: z.array(z.string()).optional(),
    usage: z.enum(["commuting", "touring", "sport", "delivery", "general"]).optional(),
    prefer_lower_mileage: z.boolean().optional(),
    reliability_priority: z.boolean().optional(),
    prefer_more_coe: z.boolean().optional(),
    prefer_better_condition: z.boolean().optional(),
  }).strict(),
  summary: z.string().min(1).max(240),
}).strict();

export function validateGroqIntent(value: unknown): SearchIntent {
  const parsed = intentSchema.parse(value);
  return {
    hardFilters: {
      engineClass: parsed.hard_filters.engine_class,
      brands: parsed.hard_filters.brands,
      maxPriceSgd: parsed.hard_filters.max_price_sgd,
      minCoeYears: parsed.hard_filters.min_coe_years,
      maxMileageKm: parsed.hard_filters.max_mileage_km,
      minEngineCc: parsed.hard_filters.min_engine_cc,
      maxEngineCc: parsed.hard_filters.max_engine_cc,
      minAgeYears: parsed.hard_filters.min_age_years,
      maxAgeYears: parsed.hard_filters.max_age_years,
    },
    softPreferences: {
      preferredBrands: parsed.soft_preferences.preferred_brands,
      usage: parsed.soft_preferences.usage,
      preferLowerMileage: parsed.soft_preferences.prefer_lower_mileage,
      reliabilityPriority: parsed.soft_preferences.reliability_priority,
      preferMoreCoe: parsed.soft_preferences.prefer_more_coe,
      preferBetterCondition: parsed.soft_preferences.prefer_better_condition,
    },
    summary: parsed.summary,
    source: "groq",
  };
}

export function parseSearchFallback(query: string): SearchIntent {
  const lower = query.toLowerCase();
  const hardFilters: HardSearchFilters = {};
  const softPreferences: SoftPreferences = {};
  const classMatch = query.match(/class\s*(2a|2b|2)(?!\w)/i);
  if (classMatch) hardFilters.engineClass = classMatch[1].toUpperCase() as HardSearchFilters["engineClass"];
  const priceMatch = lower.match(/(?:under|below|max(?:imum)?|budget(?:\s+of)?)\s*(?:s\$|\$)?\s*([\d,.]+)\s*(k)?/i);
  if (priceMatch) hardFilters.maxPriceSgd = Number(priceMatch[1].replace(/,/g, "")) * (priceMatch[2] ? 1000 : 1);
  const mileageMatch = lower.match(/(?:under|below|max(?:imum)?)\s*([\d,.]+)\s*(k)?\s*(?:km|kilomet)/i);
  if (mileageMatch) hardFilters.maxMileageKm = Number(mileageMatch[1].replace(/,/g, "")) * (mileageMatch[2] ? 1000 : 1);
  const coeMatch = lower.match(/(?:at least|min(?:imum)?)\s*([\d.]+)\s*years?\s*(?:of\s*)?coe|coe\s*(?:of\s*)?(?:at least|min(?:imum)?)\s*([\d.]+)/i);
  if (coeMatch) hardFilters.minCoeYears = Number(coeMatch[1] ?? coeMatch[2]);
  const knownBrands = ["Honda", "Yamaha", "Suzuki", "Kawasaki", "KTM", "BMW", "CFMoto", "Royal Enfield", "Triumph"];
  const mentioned = knownBrands.filter((brand) => lower.includes(brand.toLowerCase()));
  if (mentioned.length) hardFilters.brands = mentioned;
  if (lower.includes("japanese")) softPreferences.preferredBrands = ["Honda", "Yamaha", "Suzuki", "Kawasaki"];
  if (/commut|daily/.test(lower)) softPreferences.usage = "commuting";
  if (/low(?:er)? mileage|(?:not|don['’]?t want) (?:crazy |very )?high mileage/.test(lower)) softPreferences.preferLowerMileage = true;
  if (/reliab/.test(lower)) softPreferences.reliabilityPriority = true;
  if (/more coe|long(?:er)? coe/.test(lower)) softPreferences.preferMoreCoe = true;
  return { hardFilters, softPreferences, summary: query.trim() || "All available motorcycles", source: "fallback" };
}

export async function parseSearchIntent(query: string): Promise<SearchIntent> {
  if (!process.env.GROQ_API_KEY || !query.trim()) return parseSearchFallback(query);
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only JSON matching this exact shape: {hard_filters:{engine_class?,brands?,max_price_sgd?,min_coe_years?,max_mileage_km?,min_engine_cc?,max_engine_cc?,min_age_years?,max_age_years?},soft_preferences:{preferred_brands?,usage?,prefer_lower_mileage?,reliability_priority?,prefer_more_coe?,prefer_better_condition?},summary}. Treat explicit constraints as hard filters and subjective wishes as soft preferences. Allowed engine classes: 2B, 2A, 2. Allowed usage: commuting, touring, sport, delivery, general. Never invent constraints." },
        { role: "user", content: query.slice(0, 1000) },
      ],
    });
    return validateGroqIntent(JSON.parse(response.choices[0]?.message?.content ?? "{}"));
  } catch (error) {
    console.warn("Groq parsing failed; using deterministic fallback.", error instanceof Error ? error.message : "Unknown error");
    return parseSearchFallback(query);
  }
}

export function applyManualOverrides(intent: SearchIntent, manual: HardSearchFilters): SearchIntent {
  const clean = Object.fromEntries(Object.entries(manual).filter(([, value]) => value !== undefined && value !== "" && (!Array.isArray(value) || value.length)));
  return { ...intent, hardFilters: { ...intent.hardFilters, ...clean }, source: Object.keys(clean).length ? "manual" : intent.source };
}
