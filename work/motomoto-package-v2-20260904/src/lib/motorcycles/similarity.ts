import { VALUATION_CONFIG } from "../config/valuation";
import { normalizeModel } from "./comparable-id";
import type { MotorcycleListing } from "./types";

function closeness(a: number | null, b: number | null, scale: number): number {
  if (a === null || b === null) return 0.35;
  return Math.max(0, 1 - Math.abs(a - b) / scale);
}

export function similarityScore(target: MotorcycleListing, candidate: MotorcycleListing): number {
  const w = VALUATION_CONFIG.similarityWeights;
  const score =
    (normalizeModel(target.model) === normalizeModel(candidate.model) ? 1 : 0) * w.model +
    closeness(target.coeRemainingYears, candidate.coeRemainingYears, 10) * w.coe +
    (target.engineClass === candidate.engineClass ? 1 : 0) * w.engineClass +
    closeness(target.engineCc, candidate.engineCc, Math.max(target.engineCc, 200)) * w.engineCc +
    closeness(target.ageYears, candidate.ageYears, 15) * w.age +
    closeness(target.mileageKm, candidate.mileageKm, 120_000) * w.mileage +
    closeness(target.conditionScore, candidate.conditionScore, 4) * w.condition +
    (target.brand.toLowerCase() === candidate.brand.toLowerCase() ? 1 : 0) * w.brand;
  return Math.round(Math.max(0, Math.min(1, score)) * 1000) / 1000;
}
