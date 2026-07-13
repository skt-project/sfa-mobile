import { getDb } from "./schema";
import type { LocalVisit } from "../types";
import { randomUUID } from "expo-crypto";

export async function insertLocalVisit(
  v: Omit<LocalVisit, "local_id" | "sync_status">,
  syncStatus: LocalVisit["sync_status"] = "local",
): Promise<LocalVisit> {
  const db = await getDb();
  const local_id = `LOCAL-${randomUUID()}`;
  await db.runAsync(
    `INSERT INTO local_visits (
       local_id, server_visit_id, salesman_sk, outlet_sk, outlet_name, schedule_id,
       visit_date, visit_type, checkin_time, checkin_lat, checkin_lon, checkin_photo_path,
       total_demand, effective_call, notes, items_json, sync_status, created_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      local_id, v.server_visit_id ?? null, v.salesman_sk, v.outlet_sk ?? null,
      v.outlet_name ?? null, v.schedule_id ?? null, v.visit_date, v.visit_type,
      v.checkin_time ?? null, v.checkin_lat ?? null, v.checkin_lon ?? null,
      v.checkin_photo_path ?? null,
      v.total_demand, v.effective_call, v.notes ?? null,
      v.items_json ?? null, syncStatus, new Date().toISOString(),
    ],
  );
  return { ...v, local_id, sync_status: syncStatus };
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

export async function getAllLocalVisits(limit = 50): Promise<LocalVisit[]> {
  const db = await getDb();
  return db.getAllAsync(
    "SELECT * FROM local_visits ORDER BY visit_date DESC, checkin_time DESC LIMIT ?",
    [limit],
  ) as Promise<LocalVisit[]>;
}

export async function getLocalVisitById(localId: string): Promise<LocalVisit | null> {
  const db = await getDb();
  const row = await db.getFirstAsync(
    "SELECT * FROM local_visits WHERE local_id=?",
    [localId],
  ) as LocalVisit | null;
  return row;
}

export async function updateLocalVisitSubmittedAt(
  localId: string,
  submittedAt: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE local_visits SET submitted_at=? WHERE local_id=?",
    [submittedAt, localId],
  );
}

/** Seed realistic demo visits for the demo account if none exist yet. */
export async function seedDemoVisitsIfNeeded(salesmanSk: string): Promise<void> {
  const db = await getDb();
  const count = (await db.getFirstAsync(
    "SELECT COUNT(*) as n FROM local_visits WHERE salesman_sk=?",
    [salesmanSk],
  )) as { n: number };
  if (count.n > 0) return; // already seeded or has real data

  const now = new Date();
  const demoStores = [
    { outlet_sk: "DEMO-OUT-001", outlet_name: "Indomaret Sudirman No.1", address: "Jl. Sudirman No.1, Jakarta" },
    { outlet_sk: "DEMO-OUT-002", outlet_name: "Alfamart Thamrin Plaza", address: "Jl. Thamrin No.23, Jakarta" },
    { outlet_sk: "DEMO-OUT-003", outlet_name: "Minimart Senen Jaya", address: "Jl. Senen Raya No.45" },
    { outlet_sk: "DEMO-OUT-004", outlet_name: "Indomaret Kemang Village", address: "Jl. Kemang Raya No.12" },
    { outlet_sk: "DEMO-OUT-005", outlet_name: "Alfamart Fatmawati", address: "Jl. Fatmawati No.88" },
    { outlet_sk: "DEMO-OUT-006", outlet_name: "Hero Supermarket Blok M", address: "Jl. Melawai No.7, Blok M" },
    { outlet_sk: "DEMO-OUT-007", outlet_name: "Minimart Cibubur Indah", address: "Jl. Cibubur No.15" },
  ];

  const demoItems = [
    [
      { sku_id: "SKT-001", sku_name: "Skintific 5X Ceramide Moisturizer 30ml", brand: "Skintific", brand_group: "SKT", category: "Moisturizer 30ml", stp: 89000, qty: 3 },
      { sku_id: "SKT-002", sku_name: "Skintific Barrier Repair Serum 20ml", brand: "Skintific", brand_group: "SKT", category: "Serum 20ml", stp: 129000, qty: 2 },
    ],
    [
      { sku_id: "SKT-001", sku_name: "Skintific 5X Ceramide Moisturizer 30ml", brand: "Skintific", brand_group: "SKT", category: "Moisturizer 30ml", stp: 89000, qty: 5 },
      { sku_id: "G2G-001", sku_name: "Glad2Glow Brightening Toner 100ml", brand: "Glad2Glow", brand_group: "G2G", category: "Toner 100ml", stp: 65000, qty: 4 },
    ],
    [],
    [
      { sku_id: "SKT-003", sku_name: "Skintific Acne Spot Gel 10g", brand: "Skintific", brand_group: "SKT", category: "Spot Gel 10g", stp: 45000, qty: 6 },
      { sku_id: "SKT-004", sku_name: "Skintific UV Shield SPF50 30ml", brand: "Skintific", brand_group: "SKT", category: "Sunscreen 30ml", stp: 99000, qty: 2 },
    ],
    [
      { sku_id: "G2G-002", sku_name: "Glad2Glow Vitamin C Serum 20ml", brand: "Glad2Glow", brand_group: "G2G", category: "Serum 20ml", stp: 79000, qty: 3 },
    ],
    [
      { sku_id: "SKT-001", sku_name: "Skintific 5X Ceramide Moisturizer 30ml", brand: "Skintific", brand_group: "SKT", category: "Moisturizer 30ml", stp: 89000, qty: 8 },
      { sku_id: "SKT-002", sku_name: "Skintific Barrier Repair Serum 20ml", brand: "Skintific", brand_group: "SKT", category: "Serum 20ml", stp: 129000, qty: 4 },
      { sku_id: "SKT-004", sku_name: "Skintific UV Shield SPF50 30ml", brand: "Skintific", brand_group: "SKT", category: "Sunscreen 30ml", stp: 99000, qty: 3 },
    ],
    [],
  ];

  for (let i = 0; i < demoStores.length; i++) {
    const daysAgo = demoStores.length - i; // oldest first
    const visitDate = new Date(now);
    visitDate.setDate(visitDate.getDate() - daysAgo);
    const dateStr = visitDate.toISOString().split("T")[0];

    const checkinH = 8 + Math.floor(i * 1.2);
    const checkinMin = (i * 17) % 60;
    const durationMin = 25 + (i % 3) * 10;

    const checkinTime = new Date(visitDate);
    checkinTime.setHours(checkinH, checkinMin, 0, 0);
    const checkoutTime = new Date(checkinTime.getTime() + durationMin * 60 * 1000);

    const items = demoItems[i];
    const totalDemand = items.reduce((s: number, it: any) => s + it.qty * it.stp, 0);
    const effectiveCall = totalDemand > 0 ? "YES" : "NO";
    const local_id = `LOCAL-DEMO-${String(i + 1).padStart(3, "0")}`;

    await db.runAsync(
      `INSERT OR IGNORE INTO local_visits (
         local_id, salesman_sk, outlet_sk, outlet_name,
         visit_date, visit_type, checkin_time, checkout_time,
         checkin_lat, checkin_lon,
         total_demand, effective_call,
         items_json, sync_status, created_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'synced',?)`,
      [
        local_id,
        salesmanSk,
        demoStores[i].outlet_sk,
        demoStores[i].outlet_name,
        dateStr,
        "ROUTE",
        checkinTime.toISOString(),
        checkoutTime.toISOString(),
        -6.2 + (i * 0.01),    // demo GPS around Jakarta
        106.8 + (i * 0.01),
        totalDemand,
        effectiveCall,
        items.length > 0 ? JSON.stringify(items) : null,
        new Date().toISOString(),
      ],
    );
  }
}
