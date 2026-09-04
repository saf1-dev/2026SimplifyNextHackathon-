import type { MotorcycleListing } from "../../src/lib/motorcycles/types";

export function listing(overrides: Partial<MotorcycleListing> = {}): MotorcycleListing {
  return {
    id: "target", source: "fixture", sourceListingId: null, listingUrl: "https://example.test/target",
    dateCollected: "2026-08-26", listingAgeDays: 1, listingStatus: "Available", brand: "Suzuki", model: "GSR400",
    engineCc: 398, engineClass: "2A", askingPriceSgd: 6500, mileageKm: 55_000, registrationDate: "2018-01-01", coeExpiry: "2028-01-01",
    ageDays: 3160, ageYears: 8.7, coeRemainingDays: 438, coeRemainingYears: 1.2, roadTaxExpiry: null, numberOfOwners: 2, location: "Singapore",
    originalPriceSgd: null, priceChangePercent: null, paymentOption: null, maintenanceHistory: 4, accidentDamageDisclosure: null, modifications: null,
    tyreCondition: 4, chainSprocketCondition: 4, visibleRustCorrosion: 4, visibleDamage: 4, evidenceCompleteness: 5,
    descriptionNotes: null, redFlags: null, conditionScore: 4, conditionGroup: "COND4", comparableGroupId: "SUZUKI|GSR400|2A|CC201-400|COE0-2|AGE6-10|M40-80K|COND4",
    ...overrides,
  };
}
