import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { ListingRecordSchema, engineClassFromCc, normalizeListingStatus, type ConditionEvidence, type ListingRecord } from "@motomoto/domain";
import { canonicalizeMarketplaceUrl, detectMarketplace, sourceListingIdFromUrl } from "@motomoto/extraction";
import { normalizeModel } from "@motomoto/valuation";

const source = resolve(process.argv[2] ?? "data/source/SG_Motorcycle_Model_Master_2010plus.csv");
const output = resolve(process.argv[3] ?? "data/seed-motorcycle-listings.json");
const capturedAt = "2026-09-06T00:00:00.000Z";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const numberOrNull = (value: string | undefined): number | null => {
  if (!value || /^(?:na|n\/a|#value!|-|unknown|not specified)$/i.test(value.trim())) return null;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const dateOrNull = (value: string | undefined): string | null => {
  const match = value?.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2]?.padStart(2, "0")}-${match[1]?.padStart(2, "0")}` : null;
};
const textOrNull = (value: string | undefined): string | null => !value || /^(?:na|n\/a|not specified)$/i.test(value.trim()) ? null : value.trim();

const raw = await readFile(source);
const csvText = new TextDecoder("windows-1252").decode(raw);
const rows = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true }) as Record<string, string>[];
const seen = new Set<string>();
const listings: ListingRecord[] = [];
let removedDuplicates = 0;
let invalidUrls = 0;

for (const row of rows) {
  const originalUrl = row["Listing URL"]?.trim() || `legacy-row-${listings.length + 1}`;
  const dedupeKey = originalUrl.toLowerCase();
  if (seen.has(dedupeKey)) { removedDuplicates += 1; continue; }
  seen.add(dedupeKey);
  const marketplace = detectMarketplace(originalUrl);
  const canonical = canonicalizeMarketplaceUrl(originalUrl);
  if (!canonical.canonicalUrl) invalidUrls += 1;
  const engineCc = numberOrNull(row["Engine CC"]);
  const brand = textOrNull(row.Brand);
  const model = textOrNull(row.Model);
  const conditionEvidence: ConditionEvidence[] = [
    ["tyres", row["Tyre Condition"]], ["chainSprocket", row["Chain/Sprocket Condition"]],
    ["rustCorrosion", row["Visible Rust/Corrosion"]], ["visibleDamage", row["Visible Damage"]],
  ].flatMap(([dimension, value]) => {
    const score = numberOrNull(value);
    return score === null ? [] : [{ dimension: dimension as ConditionEvidence["dimension"], score, source: "MIGRATED_LEGACY" as const, reliability: 0.45, evidenceSnippet: value ?? null }];
  });
  const scores = conditionEvidence.map((item) => item.score).filter((score): score is number => score !== null);
  const conditionScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100 : null;
  const flags = ["LEGACY_PRICE_TYPE_UNVERIFIED", ...canonical.flags];
  const redFlags = textOrNull(row["Red Flags"]) ? [textOrNull(row["Red Flags"]) as string] : [];
  const id = randomUUID();
  const currentObservationId = randomUUID();
  const askingPriceSgd = numberOrNull(row["Asking Price (SGD)"]);
  const draft = {
    marketplace, sourceListingId: canonical.canonicalUrl ? sourceListingIdFromUrl(canonical.canonicalUrl, marketplace) : null,
    originalUrl, canonicalUrl: canonical.canonicalUrl, listingStatus: normalizeListingStatus(row["Listing Status"]),
    brand, model, engineCc: engineCc === null ? null : Math.round(engineCc),
    engineClass: (/^(?:2B|2A|2)$/i.test(row["Engine Class"] ?? "") ? row["Engine Class"].toUpperCase() : engineClassFromCc(engineCc)) as "2B" | "2A" | "2" | null,
    askingPriceSgd: askingPriceSgd && askingPriceSgd > 0 ? askingPriceSgd : null, priceType: "UNKNOWN" as const,
    mileageKm: numberOrNull(row["Mileage (km)"]), registrationDate: dateOrNull(row["Registration Date"]), ageYears: numberOrNull(row["Age (Years)"]),
    coeExpiry: dateOrNull(row["COE Expiry"]), coeRemainingYears: numberOrNull(row["COE Remaining (Years)"]), roadTaxExpiry: dateOrNull(row["Road Tax Expiry"]),
    numberOfOwners: numberOrNull(row["Number of Owners"]), location: textOrNull(row.Location), paymentOption: textOrNull(row["Payment option"]), sellerType: "UNKNOWN" as const,
    maintenanceSummary: textOrNull(row["Maintenance History"]), accidentDisclosure: textOrNull(row["Accident/Damage Disclosure"]), modifications: textOrNull(row.Modifications),
    modificationImpact: "UNKNOWN" as const, descriptionText: textOrNull(row["Description Notes"]), redFlags, conditionEvidence, conditionScore,
    conditionGroup: row["Comparable Group ID"]?.match(/COND(?:-[A-Z]+|[1-5])$/)?.[0] ?? "COND-NA",
    capturedAt, extractionEvidence: [
      { field: "brand", value: brand, source: "MIGRATED_LEGACY" as const, confidence: 0.45, evidenceSnippet: brand, userConfirmed: false, observedAt: capturedAt },
      { field: "model", value: model, source: "MIGRATED_LEGACY" as const, confidence: 0.45, evidenceSnippet: model, userConfirmed: false, observedAt: capturedAt },
      { field: "askingPriceSgd", value: askingPriceSgd, source: "MIGRATED_LEGACY" as const, confidence: 0.3, evidenceSnippet: row["Asking Price (SGD)"] ?? null, userConfirmed: false, observedAt: capturedAt },
    ], dataQualityFlags: flags, ingestionSource: "LEGACY_MIGRATION" as const,
  };
  listings.push(ListingRecordSchema.parse({
    ...draft, id, firstSeenAt: capturedAt, lastSeenAt: capturedAt, normalizedModel: normalizeModel(model),
    canonicalUrlHash: sha256(canonical.canonicalUrl ?? originalUrl), duplicateFingerprint: sha256([marketplace, brand, normalizeModel(model), engineCc].join("|")), currentObservationId,
  }));
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ metadata: { sourceFile: source, migratedAt: capturedAt, sourceRows: rows.length, uniqueListings: listings.length, removedDuplicates, invalidUrls, pricePolicy: "All migrated asking prices remain UNKNOWN type and are non-authoritative until user-confirmed." }, listings }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, sourceRows: rows.length, uniqueListings: listings.length, removedDuplicates, invalidUrls }, null, 2));
