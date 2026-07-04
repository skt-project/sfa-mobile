import { getApiClient } from "./client";
import type { ScheduleDownload } from "../types";

export async function downloadWeekSchedule(
  salesmanSk: string,
  week?: string,
): Promise<ScheduleDownload> {
  const r = await getApiClient().get<ScheduleDownload>("/schedule/download", {
    params: { salesman_sk: salesmanSk, week },
  });
  return r.data;
}

export async function getTodaySchedule(salesmanSk: string): Promise<ScheduleDownload> {
  const r = await getApiClient().get<ScheduleDownload>("/schedule/today", {
    params: { salesman_sk: salesmanSk },
  });
  return r.data;
}
