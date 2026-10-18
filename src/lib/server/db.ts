import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null | undefined;

/** Returns the Neon SQL client, or null when DATABASE_URL is not configured. */
export function db() {
  if (client === undefined) {
    const url = process.env.DATABASE_URL;
    client = url ? neon(url) : null;
    if (!client) console.warn("[datacare] DATABASE_URL not set — activity will not be recorded.");
  }
  return client;
}

/**
 * Runs a write without ever failing the user's request. Recording analytics must never
 * block someone from seeing the nearest facility.
 */
export async function record<T>(fn: (sql: NeonQueryFunction<false, false>) => Promise<T>): Promise<T | null> {
  const sql = db();
  if (!sql) return null;
  try {
    return await fn(sql);
  } catch (err) {
    console.error("[datacare] db write failed:", err);
    return null;
  }
}

/** Rounds a coordinate to ~100 m so precise home locations are never stored. */
export const coarse = (n: number) => Math.round(n * 1000) / 1000;
