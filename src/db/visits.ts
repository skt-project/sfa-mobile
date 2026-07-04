import { getDb } from "./schema";
import type { LocalVisit } from "../types";
import { randomUUID } from "expo-crypto";

export async function insertLocalVisit(v: Omit<LocalVisit, "local_id" | "sync_status">): Promise<LocalVisit> {
  const db = await getDb();
  const local_id = `LOCAL-${randomUUID()}`;
  await db.runAsync(
    `INSERT INTO local_visits (
       local_id, server_visit_id, salesman_sk, outlet_sk, outlet_name, schedule_id,
       visit_date, visit_type, checkin_time, checkin_lat, checkin_lon, checkin_photo_path,
       total_demand, effective_call, notes, items_json, sync_status, created_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'local',?)`,
    [
      local_id, v.server_visit_id ?? null, v.salesman_sk, v.outlet_sk ?? null,
      v.outlet_name ?? null, v.schedule_id ?? null, v.visit_date, v.visit_type,
      v.checkin_time ?? null, v.checkin_lat ?? null, v.checkin_lon ?? null,
      v.checkin_photo_path ?? null,
      v.total_demand, v.effective_call, v.notes ?? null,
      v.items_json ?? null, new Date().toISOString(),
    ],
  );
  return { ...v, local_id, sync_status: "local" };
}

export async function updateLocalVisitCheckout(
  localId: string,
  data: Partial<LocalVisit>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE local_visits SET
       checkout_time=?, checkout_lat=?, checkout_lon=?, checkout_photo_path=?,
       total_demand=?, effective_call=?, notes=?, items_json=?
     WHERE local_id=?`,
    [
      data.checkout_time ?? null, data.checkout_lat ?? null, data.checkout_lon ?? null,
      data.checkout_photo_path ?? null,
      data.total_demand ?? 0, data.effective_call ?? "NO",
      data.notes ?? null, data.items_json ?? null,
      localId,
    ],
  );
}

export async function updateLocalVisitSyncStatus(
  localId: string,
  status: LocalVisit["sync_status"],
  serverVisitId?: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE local_visits SET sync_status=?, server_visit_id=COALESCE(?,server_visit_id) WHERE local_id=?",
    [status, serverVisitId ?? null, localId],
  );
}

export async function getLocalVisitsByDate(visitDate: string): Promise<LocalVisit[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    "SELECT * FROM local_visits WHERE visit_date=? ORDER BY checkin_time DESC",
    [visitDate],
  )) as LocalVisit[];
  return rows;
}

export async function getPendingSyncVisits(): Promise<LocalVisit[]> {
  const db = await getDb();
  return db.getAllAsync(
    "SELECT * FROM local_visits WHERE sync_status IN ('local','failed') ORDER BY created_at ASC",
  ) as Promise<LocalVisit[]>;
}
