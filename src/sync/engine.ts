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
  return !!state.isConnected && !!state.isInternetReachable;
}

export async function flushPendingVisits(): Promise<{
  synced: number;
  failed: number;
}> {
  const online = await isOnline();
  if (!online) return { synced: 0, failed: 0 };

  const pending = await getPendingSyncVisits();
  let synced = 0;
  let failed = 0;

  for (const local of pending) {
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

  // Step 1: checkin
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

  const serverVisitId = checkinResp.visit_id;

  // Step 2: checkout (if done offline)
  if (local.checkout_time) {
    const items: VisitItem[] = local.items_json ? JSON.parse(local.items_json) : [];
    await checkout(serverVisitId, {
      checkout_latitude: local.checkout_lat ?? undefined,
      checkout_longitude: local.checkout_lon ?? undefined,
      total_demand: local.total_demand,
      effective_call: local.effective_call,
      notes: local.notes ?? undefined,
      items,
      offline_mode: true,
      captured_at: local.checkout_time,
    });

    // Step 3: auto-submit
    await submitVisit(serverVisitId);
  }

  await updateLocalVisitSyncStatus(local.local_id, "synced", serverVisitId);
}
