import { create } from "zustand";
import type { LocalVisit, ScheduleStore } from "../types";
import {
  insertLocalVisit,
  updateLocalVisitCheckout,
  getLocalVisitsByDate,
} from "../db/visits";

interface OfflineState {
  isOffline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  todayStores: ScheduleStore[];
  localVisits: LocalVisit[];

  setOffline: (offline: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setPendingCount: (n: number) => void;
  setTodayStores: (stores: ScheduleStore[]) => void;

  addLocalCheckin: (data: Omit<LocalVisit, "local_id" | "sync_status">) => Promise<LocalVisit>;
  updateLocalCheckout: (localId: string, data: Partial<LocalVisit>) => Promise<void>;
  loadLocalVisitsForDate: (date: string) => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOffline: false,
  isSyncing: false,
  pendingSyncCount: 0,
  todayStores: [],
  localVisits: [],

  setOffline: (offline) => set({ isOffline: offline }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setPendingCount: (n) => set({ pendingSyncCount: n }),
  setTodayStores: (stores) => set({ todayStores: stores }),

  addLocalCheckin: async (data) => {
    const visit = await insertLocalVisit(data);
    set((s) => ({ localVisits: [...s.localVisits, visit] }));
    return visit;
  },

  updateLocalCheckout: async (localId, data) => {
    await updateLocalVisitCheckout(localId, data);
    set((s) => ({
      localVisits: s.localVisits.map((v) =>
        v.local_id === localId ? { ...v, ...data } : v
      ),
    }));
  },

  loadLocalVisitsForDate: async (date) => {
    const visits = await getLocalVisitsByDate(date);
    set({ localVisits: visits });
  },
}));
