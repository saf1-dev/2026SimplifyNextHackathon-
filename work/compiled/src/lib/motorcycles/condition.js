"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCondition = calculateCondition;
const valuation_1 = require("../config/valuation");
function calculateCondition(input) {
    const values = [
        input.maintenanceHistory,
        input.tyreCondition,
        input.chainSprocketCondition,
        input.visibleRustCorrosion,
        input.visibleDamage,
    ].filter((value) => value !== null && value >= 1 && value <= 5);
    if (values.length < valuation_1.VALUATION_CONFIG.minConditionInputs) {
        return { score: null, group: "COND-NA", availableInputs: values.length };
    }
    let score = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (input.accidentDamageDisclosure?.trim().toLowerCase() === "present") {
        score -= valuation_1.VALUATION_CONFIG.accidentConditionPenalty;
    }
    if (input.modifications?.trim().toLowerCase() === "significant") {
        score -= valuation_1.VALUATION_CONFIG.significantModificationPenalty;
    }
    score = Math.max(1, Math.min(5, score));
    return { score: Math.round(score * 100) / 100, group: `COND${Math.round(score)}`, availableInputs: values.length };
}
