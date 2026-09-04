CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS motorcycle_listings (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  source_listing_id TEXT,
  listing_url TEXT NOT NULL UNIQUE,
  date_collected DATE,
  listing_age_days INTEGER,
  listing_status TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  engine_cc INTEGER NOT NULL,
  engine_class TEXT NOT NULL CHECK (engine_class IN ('2B', '2A', '2')),
  asking_price_sgd NUMERIC(12,2) NOT NULL CHECK (asking_price_sgd > 0),
  mileage_km INTEGER,
  registration_date DATE,
  coe_expiry DATE,
  age_days INTEGER,
  age_years NUMERIC(8,2),
  coe_remaining_days INTEGER,
  coe_remaining_years NUMERIC(8,2),
  road_tax_expiry DATE,
  number_of_owners INTEGER,
  location TEXT,
  original_price_sgd NUMERIC(12,2),
  price_change_percent NUMERIC(8,4),
  payment_option TEXT,
  maintenance_history NUMERIC(4,2),
  accident_damage_disclosure TEXT,
  modifications TEXT,
  tyre_condition NUMERIC(4,2),
  chain_sprocket_condition NUMERIC(4,2),
  visible_rust_corrosion NUMERIC(4,2),
  visible_damage NUMERIC(4,2),
  evidence_completeness NUMERIC(4,2),
  description_notes TEXT,
  red_flags TEXT,
  condition_score NUMERIC(4,2),
  condition_group TEXT NOT NULL,
  comparable_group_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motorcycles_brand ON motorcycle_listings (brand);
CREATE INDEX IF NOT EXISTS idx_motorcycles_model ON motorcycle_listings (model);
CREATE INDEX IF NOT EXISTS idx_motorcycles_engine_class ON motorcycle_listings (engine_class);
CREATE INDEX IF NOT EXISTS idx_motorcycles_engine_cc ON motorcycle_listings (engine_cc);
CREATE INDEX IF NOT EXISTS idx_motorcycles_price ON motorcycle_listings (asking_price_sgd);
CREATE INDEX IF NOT EXISTS idx_motorcycles_mileage ON motorcycle_listings (mileage_km);
CREATE INDEX IF NOT EXISTS idx_motorcycles_coe ON motorcycle_listings (coe_remaining_years);
CREATE INDEX IF NOT EXISTS idx_motorcycles_age ON motorcycle_listings (age_years);

CREATE TABLE IF NOT EXISTS valuation_cache (
  listing_id UUID NOT NULL REFERENCES motorcycle_listings(id) ON DELETE CASCADE,
  data_version TEXT NOT NULL,
  payload JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (listing_id, data_version)
);
