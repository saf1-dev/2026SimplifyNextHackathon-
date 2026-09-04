import { VALUATION_CONFIG } from "../config/valuation";
import type { ConfidenceLevel, MotorcycleListing } from "./types";

export function calculateConfidence(args: {
  target: MotorcycleListing;
  comparableCount: number;
  searchLevel: number;
  averageSimilarity: number;
}): ConfidenceLevel {
  const { target, comparableCount, searchLevel, averageSimilarity } = args;
  const c = VALUATION_CONFIG.confidence;
  const missingCritical = [target.mileageKm, target.coeRemainingYears, target.ageYears].filter((v) => v === null).length;
  const weakEvidence = target.evidenceCompleteness !== null && target.evidenceCompleteness < 3;
  if (
    comparableCount >= c.highMinCount &&
    searchLevel <= c.highMaxLevel &&
    averageSimilarity >= c.highMinSimilarity &&
    missingCritical === 0 && !weakEvidence
  ) return "high";
  if (
    comparableCount >= c.mediumMinCount &&
    searchLevel <= c.mediumMaxLevel &&
    averageSimilarity >= c.mediumMinSimilarity &&
    missingCritical <= 1
  ) return "medium";
  return "low";
}
