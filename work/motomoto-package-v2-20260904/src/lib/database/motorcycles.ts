import { Pool } from "pg";
import localListings from "@/data/motorcycles.json";
import type { MotorcycleListing } from "@/lib/motorcycles/types";

let pool: Pool | null = null;

const selectColumns = `
  id, source, source_listing_id AS "sourceListingId", listing_url AS "listingUrl",
  date_collected::text AS "dateCollected", listing_age_days AS "listingAgeDays", listing_status AS "listingStatus",
  brand, model, engine_cc AS "engineCc", engine_class AS "engineClass", asking_price_sgd::float8 AS "askingPriceSgd",
  mileage_km AS "mileageKm", registration_date::text AS "registrationDate", coe_expiry::text AS "coeExpiry",
  age_days AS "ageDays", age_years::float8 AS "ageYears", coe_remaining_days AS "coeRemainingDays", coe_remaining_years::float8 AS "coeRemainingYears",
  road_tax_expiry::text AS "roadTaxExpiry", number_of_owners AS "numberOfOwners", location,
  original_price_sgd::float8 AS "originalPriceSgd", price_change_percent::float8 AS "priceChangePercent", payment_option AS "paymentOption",
  maintenance_history::float8 AS "maintenanceHistory", accident_damage_disclosure AS "accidentDamageDisclosure", modifications,
  tyre_condition::float8 AS "tyreCondition", chain_sprocket_condition::float8 AS "chainSprocketCondition",
  visible_rust_corrosion::float8 AS "visibleRustCorrosion", visible_damage::float8 AS "visibleDamage",
  evidence_completeness::float8 AS "evidenceCompleteness", description_notes AS "descriptionNotes", red_flags AS "redFlags",
  condition_score::float8 AS "conditionScore", condition_group AS "conditionGroup", comparable_group_id AS "comparableGroupId"`;

export async function getListings(): Promise<MotorcycleListing[]> {
  if (!process.env.DATABASE_URL) return localListings as MotorcycleListing[];
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
  const result = await pool.query(`SELECT ${selectColumns} FROM motorcycle_listings WHERE asking_price_sgd > 0`);
  return result.rows as MotorcycleListing[];
}

export async function getListing(id: string): Promise<MotorcycleListing | null> {
  if (!process.env.DATABASE_URL) return (localListings as MotorcycleListing[]).find((listing) => listing.id === id) ?? null;
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
  const result = await pool.query(`SELECT ${selectColumns} FROM motorcycle_listings WHERE id = $1 LIMIT 1`, [id]);
  return (result.rows[0] as MotorcycleListing | undefined) ?? null;
}
