import { getApiClient } from "./client";
import type {
  CheckinResponse, Visit, VisitItem, VisitType, EffectiveCall,
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
  const r = await getApiClient().post<Visit>(`/visit/${visitId}/checkout`, payload);
  return r.data;
}

export async function submitVisit(visitId: string): Promise<Visit> {
  const r = await getApiClient().post<Visit>(`/visit/${visitId}/submit`, {});
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
