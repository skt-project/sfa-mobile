// Core domain types aligned with the STEP backend API

export type BrandGroup = "SKT" | "G2G";
export type VisitType = "ROUTE" | "NON_ROUTE";
export type VisitStatus = "CHECKED_IN" | "CHECKED_OUT" | "SUBMITTED";
export type ApprovalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING_SPV"
  | "SPV_APPROVED"
  | "ASM_APPROVED"
  | "DDM_APPROVED"
  | "REVISION_REQUIRED"
  | "COMPLETED"
  | "REJECTED";
export type EffectiveCall = "YES" | "NO";

export interface User {
  user_id: string;
  username: string;
  role: string;
  territory?: string;
  distributor_code?: string;
  brand_group?: BrandGroup;
  salesman_sk?: string | null;  // STRING hash FK → sfa_web.dim_salesman
}

export interface ScheduleStore {
  route_plan_sk: string;
  outlet_sk: string;
  source_outlet_code: string;
  store_name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  brand?: string;
  brand_group?: BrandGroup;
  store_grade?: string;
  visit_day_of_week?: string;
  visit_week_pattern?: string;
  visit_frequency_code?: string;
  distributor_code?: string;
  // Local state
  isVisited?: boolean;
  localVisitId?: string;
}

export interface ScheduleDownload {
  salesman_sk: string;
  week: string;
  stores: ScheduleStore[];
  total: number;
}

export interface VisitItem {
  visit_item_id?: string;
  sku_id: string;
  sku_name?: string;
  brand?: string;
  brand_group?: BrandGroup;
  category?: string;
  stp: number;
  qty: number;
  demand?: number;
}

export interface Visit {
  visit_id: string;
  salesman_sk: string;
  outlet_sk?: string;
  schedule_id?: string;
  visit_date: string;
  visit_type: VisitType;
  brand_group?: BrandGroup;
  checkin_time?: string;
  checkin_latitude?: number;
  checkin_longitude?: number;
  checkin_photo_url?: string;
  checkin_distance_m?: number;
  checkout_time?: string;
  checkout_latitude?: number;
  checkout_longitude?: number;
  checkout_photo_url?: string;
  total_demand?: number;
  effective_call?: EffectiveCall;
  notes?: string;
  duration_minutes?: number;
  visit_status?: VisitStatus;
  approval_status?: ApprovalStatus;
  spv_username?: string;
  spv_approved_at?: string;
  asm_username?: string;
  asm_approved_at?: string;
  ddm_username?: string;
  ddm_approved_at?: string;
  rejection_notes?: string;
  revision_count?: number;
  created_at?: string;
  updated_at?: string;
  items?: VisitItem[];
  gps_warning?: boolean;
}

export interface CheckinResponse {
  visit_id: string;
  checkin_distance_m?: number;
  gps_warning: boolean;
  offline_mode: boolean;
}

export interface Sku {
  sku_id: string;
  sku_name: string;
  brand?: string;
  brand_group?: BrandGroup;
  category?: string;
  stp?: number;
  is_active?: boolean;
}

export interface StockItem {
  stock_id: string;
  salesman_sk: string;
  sku_id: string;
  sku_name?: string;
  brand?: string;
  brand_group?: BrandGroup;
  stp?: number;
  qty_current: number;
  assigned_by_sk?: string;
  updated_at?: string;
}

export interface KpiData {
  total_visits: number;
  effective_calls: number;
  strike_rate: number;
  total_demand: number;
  pending_approvals: number;
  revision_count: number;
  route_completion_pct: number;
  date?: string;
}

// Sync queue item stored in SQLite
export interface SyncQueueItem {
  id?: number;
  action: "checkin" | "checkout" | "submit" | "photo_upload";
  visit_id?: string;
  payload: string; // JSON string
  photo_path?: string;
  created_at: string;
  retry_count: number;
  status: "pending" | "syncing" | "done" | "failed";
}

// Local visit stored offline in SQLite
export interface LocalVisit {
  local_id: string;
  server_visit_id?: string;
  salesman_sk: string;
  outlet_sk?: string;
  outlet_name?: string;
  schedule_id?: string;
  visit_date: string;
  visit_type: VisitType;
  checkin_time?: string;
  checkin_lat?: number;
  checkin_lon?: number;
  checkin_photo_path?: string;
  checkout_time?: string;
  checkout_lat?: number;
  checkout_lon?: number;
  checkout_photo_path?: string;
  total_demand: number;
  effective_call: EffectiveCall;
  notes?: string;
  items_json?: string;
  sync_status: "local" | "syncing" | "synced" | "failed";
}
