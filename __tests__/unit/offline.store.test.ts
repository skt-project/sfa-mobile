/**
 * Unit tests for offline state store.
 */

// Mock DB operations
jest.mock("../../src/db/visits", () => ({
  insertLocalVisit: jest.fn(),
  updateLocalVisitCheckout: jest.fn(),
  getLocalVisitsByDate: jest.fn(),
}));

import * as visitsDb from "../../src/db/visits";
import { useOfflineStore } from "../../src/store/offlineStore";

const mockDb = visitsDb as jest.Mocked<typeof visitsDb>;

describe("useOfflineStore", () => {
  beforeEach(() => {
    // Reset store state
    useOfflineStore.setState({
      isOffline: false,
      isSyncing: false,
      pendingSyncCount: 0,
      todayStores: [],
      localVisits: [],
    });
    jest.clearAllMocks();
  });

  it("setOffline toggles isOffline", () => {
    useOfflineStore.getState().setOffline(true);
    expect(useOfflineStore.getState().isOffline).toBe(true);
    useOfflineStore.getState().setOffline(false);
    expect(useOfflineStore.getState().isOffline).toBe(false);
  });

  it("addLocalCheckin inserts to DB and adds to state", async () => {
    const mockVisit = {
      local_id: "LOCAL-TEST",
      salesman_sk: "SM-001",
      outlet_sk: "OUT-001",
      visit_date: "2026-07-04",
      visit_type: "ROUTE" as const,
      total_demand: 0,
      effective_call: "NO" as const,
      sync_status: "local" as const,
    };
    (mockDb.insertLocalVisit as jest.Mock).mockResolvedValueOnce(mockVisit);

    const result = await useOfflineStore.getState().addLocalCheckin({
      salesman_sk: "SM-001",
      outlet_sk: "OUT-001",
      visit_date: "2026-07-04",
      visit_type: "ROUTE",
      total_demand: 0,
      effective_call: "NO",
    });

    expect(mockDb.insertLocalVisit).toHaveBeenCalled();
    expect(result.local_id).toBe("LOCAL-TEST");
    expect(useOfflineStore.getState().localVisits).toHaveLength(1);
  });

  it("setPendingCount updates pendingSyncCount", () => {
    useOfflineStore.getState().setPendingCount(5);
    expect(useOfflineStore.getState().pendingSyncCount).toBe(5);
  });
});
