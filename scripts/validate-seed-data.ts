import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ListingRecordSchema } from "@motomoto/domain";

const path = resolve(process.argv[2] ?? "data/seed-motorcycle-listings.json");
const data = JSON.parse(await readFile(path, "utf8"));
const listings = (data.listings ?? []).map((item: unknown) => ListingRecordSchema.parse(item));
const authoritativeLegacy = listings.filter((item: { ingestionSource: string; priceType: string }) => item.ingestionSource === "LEGACY_MIGRATION" && item.priceType !== "UNKNOWN");
if (authoritativeLegacy.length) throw new Error("Legacy rows must not be marked as authoritative full-price evidence.");
console.log(JSON.stringify({ valid: true, listings: listings.length, authoritativeLegacyPrices: authoritativeLegacy.length }, null, 2));
