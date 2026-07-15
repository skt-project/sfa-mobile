/**
 * Offline sync engine.
 *
 * When network is available, flushPendingVisits() uploads every visit with
 * sync_status='local' or 'failed' to the server.
 *
 * Pull-to-refresh on the Home/Route screen triggers this flush + a fresh fetch.
 *
 * Key rules:
 * - If offline_mode=true was recorded locally, the same flag is sent to the server.
 * - captured_at is the local device timestamp — always honored on the server.
 * - GPS distance is recorded (never blocks), gps_warning is shown to SE.
 */

import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { checkin, checkout, submitVisit } from "../api/visit";
import { getPendingSyncVisits, updateLocalVisitSyncStatus } from "../db/visits";
import type { LocalVisit, VisitItem } from "../types";

export async function isOnline(): Promise<boolean> {
  if (Platform.OS === "web") {
    return navigator.onLine;
  }
  const state = await NetInfo.fetch();
  return !!state?.isConnected && !!state?.isInternetReachable;
}

// Module-level mutex: NetInfo flaps and pull-to-refresh can both call
// flushPendingVisits concurrently. Only one flush may run at a time —
// concurrent callers get the in-flight promise instead of starting a
// second pass (prevents duplicate submissions and race conditions).
let _inFlight: Promise<{ synced: number; failed: number }> | null = null;

export function flushPendingVisits(): Promise<{
  synced: number;
  failed: number;
}> {
  if (_inFlight) return _inFlight;
  _inFlight = _doFlush().finally(() => { _inFlight = null; });
  return _inFlight;
}

async function _doFlush(): Promise<{ synced: number; failed: number }> {
  const online = await isOnline();
  if (!online) return { synced: 0, failed: 0 };

  const pending = await getPendingSyncVisits();
  let synced = 0;
  let failed = 0;

  for (const local of pending) {
    // Re-check connectivity between visits: if the network dropped mid-flush,
    // stop cleanly and leave the rest queued instead of racking up failures.
    if (!(await isOnline())) break;
    try {
      await syncOneVisit(local);
      synced++;
    } catch (e) {
      console.warn(`[sync] Failed to sync ${local.local_id}:`, e);
      await updateLocalVisitSyncStatus(local.local_id, "failed");
      failed++;
    }
  }

  return { synced, failed };
}

async function syncOneVisit(local: LocalVisit): Promise<void> {
  await updateLocalVisitSyncStatus(local.local_id, "syncing");

  let serverVisitId: string;

  if (local.server_visit_id) {
    // Visit was checked in online but checkout failed due to network drop.
    // The server record already exists — skip checkin to avoid a duplicate.
    serverVisitId = local.server_visit_id;
  } else {
    // Step 1: checkin (fully offline visit)
    const checkinResp = await checkin({
      salesman_sk: local.salesman_sk,
      outlet_sk: local.outlet_sk ?? "",
      visit_date: local.visit_date,
      visit_type: local.visit_type,
      checkin_latitude: local.checkin_lat ?? undefined,
      checkin_longitude: local.checkin_lon ?? undefined,
      schedule_id: local.schedule_id ?? undefined,
      offline_mode: true,
      captured_at: local.checkin_time ?? undefined,
    });
    serverVisitId = checkinResp.visit_id;
  }

  // Step 2: checkout (records time/coords only — items go with submit)
  if (local.checkout_time) {
    await checkout(serverVisitId, {
      checkout_latitude: local.checkout_lat ?? undefined,
      checkout_longitude: local.checkout_lon ?? undefined,
      total_demand: local.total_demand,
      effective_call: local.effective_call,
      notes: local.notes ?? undefined,
      items: [],
      offline_mode: true,
      captured_at: local.checkout_time,
    });

    // Step 3: auto-submit with items — first time items land in BigQuery
    const items: VisitItem[] = local.items_json ? JSON.parse(local.items_json) : [];
    await submitVisit(serverVisitId, {
      total_demand: local.total_demand,
      effective_call: local.effective_call,
      items,
      offline_mode: true,
    });
  }

  await updateLocalVisitSyncStatus(local.local_id, "synced", serverVisitId);
}
