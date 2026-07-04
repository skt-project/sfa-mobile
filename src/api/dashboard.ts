import { getApiClient } from "./client";
import type { KpiData } from "../types";

export interface TeamMemberKpi {
  salesman_sk: string;
  salesman_name?: string;
  total_visits: number;
  effective_calls: number;
  strike_rate: number;
  total_demand: number;
  pending_approvals: number;
}

export async function getKpi(salesmanSk: string, visitDate?: string): Promise<KpiData> {
  const r = await getApiClient().get<KpiData>("/dashboard/kpi", {
    params: { salesman_sk: salesmanSk, visit_date: visitDate },
  });
  return r.data;
}

export async function getTeamKpi(visitDate?: string): Promise<{
  members: TeamMemberKpi[];
  total_members: number;
}> {
  const r = await getApiClient().get("/dashboard/team", { params: { visit_date: visitDate } });
  return r.data;
}
