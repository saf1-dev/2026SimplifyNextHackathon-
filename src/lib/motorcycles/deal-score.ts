import { VALUATION_CONFIG } from "../config/valuation";
import type { DealScoreResult, MotorcycleListing, PriceAssessment, ValuationResult } from "./types";

function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }

export function assessPrice(percentageDifference: number): PriceAssessment {
  const t = VALUATION_CONFIG.priceAssessmentThresholds;
  if (percentageDifference <= t.strongDeal) return "strong_deal";
  if (percentageDifference <= t.goodDeal) return "good_deal";
  if (percentageDifference <= t.fair) return "fairly_priced";
  if (percentageDifference <= t.slightlyOverpriced) return "slightly_overpriced";
  if (percentageDifference <= t.overpriced) return "overpriced";
  return "significantly_overpriced";
}

export function calculateDealScore(listing: MotorcycleListing, valuation: ValuationResult, preferenceScore: number): DealScoreResult {
  const w = VALUATION_CONFIG.dealScoreWeights;
  const priceDelta = (valuation.estimatedMid - listing.askingPriceSgd) / valuation.estimatedMid;
  const components = {
    priceAttractiveness: clamp01(0.5 + priceDelta * 1.5),
    preferenceMatch: clamp01(preferenceScore),
    coe: listing.coeRemainingYears === null ? 0.4 : clamp01(listing.coeRemainingYears / 10),
    condition: listing.conditionScore === null ? 0.4 : clamp01((listing.conditionScore - 1) / 4),
    mileage: listing.mileageKm === null ? 0.4 : clamp01(1 - listing.mileageKm / 160_000),
    evidenceQuality: listing.evidenceCompleteness === null ? 0.35 : clamp01(listing.evidenceCompleteness / 5),
  };
  const score = Object.entries(w).reduce((sum, [key, weight]) => sum + components[key as keyof typeof components] * weight, 0);
  return { score: Math.round(score * 100), components };
}
