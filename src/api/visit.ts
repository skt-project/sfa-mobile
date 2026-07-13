import { getApiClient } from "./client";
import type {
  CheckinResponse, Visit, VisitItem, VisitType, EffectiveCall, SkippedStore,
} from "../types";

export interface CheckinPayload {
  salesman_sk: string;
  outlet_sk: string;
  visit_date: string;
  visit_type?: VisitType;
  checkin_latitude?: number;
  checkin_longitude?: number;
  checkin_photo_url?: string;
  schedule_id?: string;
  offline_mode?: boolean;
  captured_at?: string;
}

export interface CheckoutPayload {
  checkout_latitude?: number;
  checkout_longitude?: number;
  checkout_photo_url?: string;
  notes?: string;
  total_demand: number;
  effective_call: EffectiveCall;
  items: VisitItem[];
  offline_mode?: boolean;
  captured_at?: string;
}

export async function checkin(payload: CheckinPayload): Promise<CheckinResponse> {
  const r = await getApiClient().post<CheckinResponse>("/visit/checkin", payload);
  return r.data;
}

export async function checkout(visitId: string, payload: CheckoutPayload): Promise<Visit> {
  const r = await getApiClient().post<Visit>(`/visit/${visitId}/checkout`, payload, { timeout: 45000 });
  return r.data;
}

export interface SubmitPayload {
  total_demand: number;
  effective_call: EffectiveCall;
  items: VisitItem[];
  offline_mode?: boolean;
}

export async function submitVisit(visitId: string, payload: SubmitPayload): Promise<Visit> {
  const r = await getApiClient().post<Visit>(`/visit/${visitId}/submit`, payload, { timeout: 45000 });
  return r.data;
}

export async function approveVisit(visitId: string, notes?: string): Promise<Visit> {
  const r = await getApiClient().put<Visit>(`/visit/${visitId}/approve`, { notes });
  return r.data;
}

export async function rejectVisit(visitId: string, rejectionNotes: string): Promise<Visit> {
  const r = await getApiClient().put<Visit>(`/visit/${visitId}/reject`, { rejection_notes: rejectionNotes });
  return r.data;
}

export async function resubmitVisit(
  visitId: string,
  totalDemand: number,
  items: VisitItem[],
  notes?: string,
): Promise<Visit> {
  const r = await getApiClient().put<Visit>(`/visit/${visitId}/resubmit`, {
    total_demand: totalDemand,
    items,
    notes,
  });
  return r.data;
}

export async function listVisits(params: {
  visit_date?: string;
  status?: string;
  salesman_sk?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: Visit[]; total: number; has_next: boolean }> {
  const r = await getApiClient().get("/visit", { params });
  return r.data;
}

export async function getVisitDetail(visitId: string): Promise<Visit> {
  const r = await getApiClient().get<Visit>(`/visit/${visitId}`);
  return r.data;
}

// ── Skipped Stores ────────────────────────────────────────────────────────────

export interface SkippedStoreIn {
  outlet_sk: string;
  outlet_name?: string;
  distributor_code?: string;
  brand_group?: string;
  week_iso: string;
  visit_date: string;
}

export async function submitSkippedStores(
  salesman_sk: string,
  stores: SkippedStoreIn[],
): Promise<{ created: number; skipped: number }> {
  const r = await getApiClient().post("/skipped-stores", { salesman_sk, stores });
  return r.data;
}

export async function listSkippedStores(params: {
  week_iso?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: SkippedStore[]; total: number; has_next: boolean }> {
  const r = await getApiClient().get("/skipped-stores", { params });
  return r.data;
}

export async function returnSkippedStore(id: string, notes?: string): Promise<SkippedStore> {
  const r = await getApiClient().put<SkippedStore>(`/skipped-stores/${id}/return`, { notes });
  return r.data;
}

export async function executeSkippedStore(id: string, notes?: string): Promise<SkippedStore> {
  const r = await getApiClient().put<SkippedStore>(`/skipped-stores/${id}/execute`, { notes });
  return r.data;
}

export async function getSkippedStoreSummary(weekIso?: string): Promise<Record<string, number>> {
  const r = await getApiClient().get("/skipped-stores/summary", { params: { week_iso: weekIso } });
  return r.data;
}
