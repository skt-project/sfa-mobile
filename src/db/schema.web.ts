// Web stub — expo-sqlite/WASM not available in browser demo.
// All DB operations are in-memory only; data does not persist across page reloads.

let _db: any = null;

export async function getDb(): Promise<any> {
  if (_db) return _db;
  _db = makeWebStub();
  return _db;
}

function makeWebStub() {
  const visits: any[] = [];
  const schedule: any[] = [];
  const sku: any[] = [];

  return {
    execAsync: async () => {},
    runAsync: async (_sql: string, _params?: any[]) => ({ lastInsertRowId: Date.now(), changes: 1 }),
    getFirstAsync: async (sql: string, params?: any[]) => {
      if (sql.includes("cached_schedule") && params) {
        const [sk, week] = params;
        return schedule.find((r) => r.salesman_sk === sk && r.week === week) ?? null;
      }
      return null;
    },
    getAllAsync: async (sql: string, params?: any[]) => {
      if (sql.includes("local_visits")) {
        if (sql.includes("sync_status IN")) return visits.filter((v) => v.sync_status === "local" || v.sync_status === "failed");
        const date = params?.[0];
        return date ? visits.filter((v) => v.visit_date === date) : [...visits];
      }
      if (sql.includes("cached_sku")) return [...sku];
      return [];
    },
    _visits: visits,
    _schedule: schedule,
    _sku: sku,
  };
}
