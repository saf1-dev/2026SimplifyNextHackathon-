"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = __importDefault(require("node:crypto"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_process_1 = __importDefault(require("node:process"));
const pg_1 = require("pg");
const XLSX = __importStar(require("xlsx"));
const condition_1 = require("../src/lib/motorcycles/condition");
const comparable_id_1 = require("../src/lib/motorcycles/comparable-id");
const sourcePath = node_process_1.default.argv[2];
if (!sourcePath)
    throw new Error("Usage: pnpm import:motorcycles -- <workbook.xlsx>");
const normalizeHeader = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const blank = (value) => value === null || value === undefined || String(value).trim() === "" || /^(na|n\/a|null)$/i.test(String(value).trim());
const textValue = (value) => blank(value) ? null : String(value).trim();
const numberValue = (value) => {
    if (blank(value) || String(value).includes("#"))
        return null;
    const parsed = Number(String(value).replace(/[S$,%\s,]/g, ""));
    if (!Number.isFinite(parsed))
        return null;
    return String(value).includes("%") ? parsed / 100 : parsed;
};
const integerValue = (value) => { const parsed = numberValue(value); return parsed === null ? null : Math.round(parsed); };
const dateValue = (value) => {
    if (blank(value))
        return null;
    if (value instanceof Date && !Number.isNaN(value.valueOf()))
        return value.toISOString().slice(0, 10);
    if (typeof value === "number") {
        const date = XLSX.SSF.parse_date_code(value);
        return date ? `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}` : null;
    }
    const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match)
        return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
};
const sourceListingId = (url) => url.match(/\/(\d+)\/?(?:\?|$)/)?.[1] ?? null;
const stableId = (url) => {
    const hex = node_crypto_1.default.createHash("sha256").update(url).digest("hex").slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
};
function mapRow(row, sheetName) {
    const get = (name) => row[normalizeHeader(name)];
    const listingUrl = textValue(get("Listing URL"));
    const brand = textValue(get("Brand"));
    const model = textValue(get("Model"));
    const engineCc = integerValue(get("Engine CC"));
    const engineClassText = textValue(get("Engine Class"))?.toUpperCase();
    const askingPriceSgd = numberValue(get("Asking Price (SGD)"));
    if (!listingUrl || !/^https?:\/\//i.test(listingUrl) || !brand || !model || !engineCc || !askingPriceSgd || !["2B", "2A", "2"].includes(engineClassText ?? ""))
        return null;
    const condition = (0, condition_1.calculateCondition)({
        maintenanceHistory: numberValue(get("Maintenance History")),
        tyreCondition: numberValue(get("Tyre Condition")),
        chainSprocketCondition: numberValue(get("Chain/Sprocket Condition")),
        visibleRustCorrosion: numberValue(get("Visible Rust/Corrosion")),
        visibleDamage: numberValue(get("Visible Damage")),
        accidentDamageDisclosure: textValue(get("Accident/Damage Disclosure")),
        modifications: textValue(get("Modifications")),
    });
    const listing = {
        id: stableId(listingUrl), source: `Workbook: ${sheetName}`, sourceListingId: sourceListingId(listingUrl), listingUrl,
        dateCollected: dateValue(get("Date Collected")), listingAgeDays: integerValue(get("Listing Age (Days)")), listingStatus: textValue(get("Listing Status")),
        brand, model, engineCc, engineClass: engineClassText, askingPriceSgd,
        mileageKm: integerValue(get("Mileage (km)")), registrationDate: dateValue(get("Registration Date")), coeExpiry: dateValue(get("COE Expiry")),
        ageDays: integerValue(get("Age (Days)")), ageYears: numberValue(get("Age (Years)")), coeRemainingDays: integerValue(get("COE Remaining (Days)")), coeRemainingYears: numberValue(get("COE Remaining (Years)")),
        roadTaxExpiry: dateValue(get("Road Tax Expiry")), numberOfOwners: integerValue(get("Number of Owners")), location: textValue(get("Location")),
        originalPriceSgd: numberValue(get("Price Changes (Original)")), priceChangePercent: numberValue(get("Price change %")), paymentOption: textValue(get("Payment option")),
        maintenanceHistory: numberValue(get("Maintenance History")), accidentDamageDisclosure: textValue(get("Accident/Damage Disclosure")), modifications: textValue(get("Modifications")),
        tyreCondition: numberValue(get("Tyre Condition")), chainSprocketCondition: numberValue(get("Chain/Sprocket Condition")), visibleRustCorrosion: numberValue(get("Visible Rust/Corrosion")), visibleDamage: numberValue(get("Visible Damage")),
        evidenceCompleteness: numberValue(get("Evidence Completeness")), descriptionNotes: textValue(get("Description Notes")), redFlags: textValue(get("Red Flags")),
        conditionScore: condition.score, conditionGroup: condition.group, comparableGroupId: "",
    };
    listing.comparableGroupId = (0, comparable_id_1.buildComparableGroupId)(listing);
    return listing;
}
async function main() {
    const workbook = XLSX.readFile(node_path_1.default.resolve(sourcePath), { cellDates: true });
    const listings = [];
    let invalidRows = 0;
    let detectedSheets = 0;
    for (const sheetName of workbook.SheetNames) {
        const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
        const headerIndex = matrix.findIndex((row) => Array.isArray(row) && row.some((cell) => normalizeHeader(cell) === "listing_url") && row.some((cell) => normalizeHeader(cell) === "asking_price_sgd"));
        if (headerIndex < 0)
            continue;
        detectedSheets += 1;
        const headers = matrix[headerIndex].map(normalizeHeader);
        for (const cells of matrix.slice(headerIndex + 1)) {
            const row = Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
            const hasContent = Object.values(row).some((value) => !blank(value));
            if (!hasContent)
                continue;
            const listing = mapRow(row, sheetName);
            if (listing)
                listings.push(listing);
            else
                invalidRows += 1;
        }
    }
    const unique = [...new Map(listings.map((listing) => [listing.listingUrl.trim(), listing])).values()];
    const duplicateCount = listings.length - unique.length;
    const outputPath = node_path_1.default.resolve(node_process_1.default.env.MOTORCYCLE_DATA_PATH ?? "src/data/motorcycles.json");
    await promises_1.default.mkdir(node_path_1.default.dirname(outputPath), { recursive: true });
    await promises_1.default.writeFile(outputPath, `${JSON.stringify(unique, null, 2)}\n`, "utf8");
    if (node_process_1.default.env.DATABASE_URL) {
        const client = new pg_1.Client({ connectionString: node_process_1.default.env.DATABASE_URL, ssl: node_process_1.default.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
        await client.connect();
        try {
            await client.query("BEGIN");
            for (const listing of unique) {
                const keys = Object.keys(listing);
                const snake = keys.map((key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));
                const placeholders = keys.map((_, index) => `$${index + 1}`);
                const updates = snake.filter((column) => column !== "id" && column !== "listing_url").map((column) => `${column}=EXCLUDED.${column}`);
                await client.query(`INSERT INTO motorcycle_listings (${snake.join(",")}) VALUES (${placeholders.join(",")}) ON CONFLICT (listing_url) DO UPDATE SET ${updates.join(",")}, updated_at=NOW()`, keys.map((key) => listing[key]));
            }
            await client.query("COMMIT");
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            await client.end();
        }
    }
    console.log(JSON.stringify({ detectedSheets, imported: unique.length, duplicateUrlsSkipped: duplicateCount, invalidRows, missingMileage: unique.filter((l) => l.mileageKm === null).length, missingCoe: unique.filter((l) => l.coeRemainingYears === null).length, outputPath }, null, 2));
}
main().catch((error) => {
    console.error(error);
    node_process_1.default.exitCode = 1;
});
