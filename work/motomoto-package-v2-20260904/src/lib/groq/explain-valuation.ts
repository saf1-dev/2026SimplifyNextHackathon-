import Groq from "groq-sdk";
import type { MotorcycleListing, ValuationResult } from "@/lib/motorcycles/types";
import { label } from "@/lib/format";

export function deterministicExplanation(listing: MotorcycleListing, valuation: ValuationResult): string {
  const direction = listing.askingPriceSgd > valuation.estimatedMid ? "above" : "below";
  const difference = Math.abs(listing.askingPriceSgd - valuation.estimatedMid);
  const fallback = valuation.filtersRelaxed.length ? ` The comparison broadened by relaxing ${valuation.filtersRelaxed.map(label).join(", ").toLowerCase()}.` : "";
  return `This ${listing.brand} ${listing.model} is listed S$${difference.toLocaleString("en-SG")} ${direction} the estimated comparable-market midpoint, based on ${valuation.comparableCount} relevant asking-price listings.${fallback}`;
}

export async function explainValuation(listing: MotorcycleListing, valuation: ValuationResult): Promise<string> {
  if (!process.env.GROQ_API_KEY) return deterministicExplanation(listing, valuation);
  const verified = {
    target: { model: listing.model, brand: listing.brand, listed_price: listing.askingPriceSgd, mileage: listing.mileageKm, coe_remaining: listing.coeRemainingYears, condition: listing.conditionScore },
    valuation: { estimated_low: valuation.estimatedLow, estimated_mid: valuation.estimatedMid, estimated_high: valuation.estimatedHigh, confidence: valuation.confidence },
    comparables: { count: valuation.comparableCount, search_level: valuation.searchLevel, average_similarity: valuation.averageSimilarity, filters_relaxed: valuation.filtersRelaxed },
  };
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({ model: "llama-3.3-70b-versatile", temperature: 0.1, max_tokens: 120, messages: [
      { role: "system", content: "Explain this motorcycle asking-price valuation in two concise sentences. Use only the supplied facts. Do not claim actual sale price, true value, guarantees, or add motorcycle knowledge." },
      { role: "user", content: JSON.stringify(verified) },
    ] });
    return response.choices[0]?.message?.content?.trim() || deterministicExplanation(listing, valuation);
  } catch { return deterministicExplanation(listing, valuation); }
}
