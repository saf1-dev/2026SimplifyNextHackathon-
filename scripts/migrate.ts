import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
await client.connect();
try {
  const migration = await fs.readFile(path.resolve("database/migrations/001_create_motorcycle_listings.sql"), "utf8");
  await client.query(migration);
  console.log("Database migration complete.");
} finally {
  await client.end();
}
