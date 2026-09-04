import { VALUATION_CONFIG } from "../config/valuation";

export interface ConditionInputs {
  maintenanceHistory: number | null;
  tyreCondition: number | null;
  chainSprocketCondition: number | null;
  visibleRustCorrosion: number | null;
  visibleDamage: number | null;
  accidentDamageDisclosure: string | null;
  modifications: string | null;
}

export function calculateCondition(input: ConditionInputs) {
  const values = [
    input.maintenanceHistory,
    input.tyreCondition,
    input.chainSprocketCondition,
    input.visibleRustCorrosion,
    input.visibleDamage,
  ].filter((value): value is number => value !== null && value >= 1 && value <= 5);

  if (values.length < VALUATION_CONFIG.minConditionInputs) {
    return { score: null, group: "COND-NA", availableInputs: values.length };
  }

  let score = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (input.accidentDamageDisclosure?.trim().toLowerCase() === "present") {
    score -= VALUATION_CONFIG.accidentConditionPenalty;
  }
  if (input.modifications?.trim().toLowerCase() === "significant") {
    score -= VALUATION_CONFIG.significantModificationPenalty;
  }
  score = Math.max(1, Math.min(5, score));
  return { score: Math.round(score * 100) / 100, group: `COND${Math.round(score)}`, availableInputs: values.length };
}
