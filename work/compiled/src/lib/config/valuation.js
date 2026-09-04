"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALUATION_CONFIG = void 0;
exports.VALUATION_CONFIG = {
    minComparables: 5,
    idealComparables: 10,
    maxComparables: 16,
    priceOutlierIqrMultiplier: 1.5,
    accidentConditionPenalty: 1,
    significantModificationPenalty: 0.5,
    minConditionInputs: 2,
    similarityWeights: {
        model: 0.28,
        coe: 0.18,
        engineClass: 0.15,
        engineCc: 0.13,
        age: 0.1,
        mileage: 0.08,
        condition: 0.05,
        brand: 0.03,
    },
    dealScoreWeights: {
        priceAttractiveness: 0.4,
        preferenceMatch: 0.2,
        coe: 0.15,
        condition: 0.1,
        mileage: 0.1,
        evidenceQuality: 0.05,
    },
    priceAssessmentThresholds: {
        strongDeal: -15,
        goodDeal: -5,
        fair: 5,
        slightlyOverpriced: 15,
        overpriced: 30,
    },
    confidence: {
        highMinCount: 8,
        highMaxLevel: 3,
        highMinSimilarity: 0.72,
        mediumMinCount: 5,
        mediumMaxLevel: 6,
        mediumMinSimilarity: 0.52,
    },
};
