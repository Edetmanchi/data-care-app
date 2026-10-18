// Applies db/schema.sql to the Neon database in DATABASE_URL.
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

process.loadEnvFile?.(".env.local");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const pool = new Pool({ connectionString: url });
try {
  await pool.query(sql);
  console.log("Schema applied.");
} finally {
  await pool.end();
}
