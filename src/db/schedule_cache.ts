import { getDb } from "./schema";
import type { ScheduleDownload } from "../types";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function cacheSchedule(data: ScheduleDownload): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO cached_schedule (week, salesman_sk, data_json, cached_at)
     VALUES (?, ?, ?, ?)`,
    [data.week, data.salesman_sk, JSON.stringify(data), new Date().toISOString()],
  );
}

export async function getCachedSchedule(
  salesmanSk: string,
  week: string,
): Promise<ScheduleDownload | null> {
  const db = await getDb();
  const row = (await db.getFirstAsync(
    "SELECT data_json, cached_at FROM cached_schedule WHERE salesman_sk=? AND week=?",
    [salesmanSk, week],
  )) as { data_json: string; cached_at: string } | null;
  if (!row) return null;
  const age = Date.now() - new Date(row.cached_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return JSON.parse(row.data_json) as ScheduleDownload;
}

export async function cacheSkus(skus: object[]): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  for (const sku of skus as any[]) {
    await db.runAsync(
      "INSERT OR REPLACE INTO cached_sku (sku_id, data_json, cached_at) VALUES (?,?,?)",
      [sku.sku_id, JSON.stringify(sku), now],
    );
  }
}

export async function getCachedSkus(): Promise<object[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync("SELECT data_json FROM cached_sku")) as { data_json: string }[];
  return rows.map((r: { data_json: string }) => JSON.parse(r.data_json));
}
