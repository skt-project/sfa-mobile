/**
 * Unit tests for the offline sync engine.
 * Mocks all network/DB calls to test logic in isolation.
 */
import { flushPendingVisits, isOnline } from "../../src/sync/engine";

// Mock NetInfo
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(),
}));

// Mock API calls
jest.mock("../../src/api/visit", () => ({
  checkin: jest.fn(),
  checkout: jest.fn(),
  submitVisit: jest.fn(),
}));

// Mock DB
jest.mock("../../src/db/visits", () => ({
  getPendingSyncVisits: jest.fn(),
  updateLocalVisitSyncStatus: jest.fn(),
}));

import NetInfo from "@react-native-community/netinfo";
import * as visitApi from "../../src/api/visit";
import * as visitsDb from "../../src/db/visits";

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;
const mockApi = visitApi as jest.Mocked<typeof visitApi>;
const mockDb = visitsDb as jest.Mocked<typeof visitsDb>;

describe("isOnline", () => {
  it("returns true when connected", async () => {
    (mockNetInfo.fetch as jest.Mock).mockResolvedValueOnce({
      isConnected: true,
      isInternetReachable: true,
    });
    expect(await isOnline()).toBe(true);
  });

  it("returns false when not connected", async () => {
    (mockNetInfo.fetch as jest.Mock).mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
    });
    expect(await isOnline()).toBe(false);
  });
});

describe("flushPendingVisits", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 0,0 when offline", async () => {
    (mockNetInfo.fetch as jest.Mock).mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
    });
    const result = await flushPendingVisits();
    expect(result).toEqual({ synced: 0, failed: 0 });
    expect(mockDb.getPendingSyncVisits).not.toHaveBeenCalled();
  });

  it("syncs pending visits when online", async () => {
    // Persistent mock: the engine re-checks connectivity before each visit
    (mockNetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    (mockDb.getPendingSyncVisits as jest.Mock).mockResolvedValueOnce([
      {
        local_id: "LOCAL-001",
        salesman_sk: "SM-001",
        outlet_sk: "OUT-001",
        visit_date: "2026-07-04",
        visit_type: "ROUTE",
        checkin_time: "2026-07-04T07:00:00Z",
        checkin_lat: -6.175,
        checkin_lon: 106.827,
        total_demand: 1500000,
        effective_call: "YES",
        sync_status: "local",
      },
    ]);
    (mockApi.checkin as jest.Mock).mockResolvedValueOnce({
      visit_id: "VST-ABC123",
      checkin_distance_m: 50,
      gps_warning: false,
      offline_mode: true,
    });
    (mockDb.updateLocalVisitSyncStatus as jest.Mock).mockResolvedValue(undefined);

    const result = await flushPendingVisits();
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockApi.checkin).toHaveBeenCalledWith(
      expect.objectContaining({
        salesman_sk: "SM-001",
        offline_mode: true,
        captured_at: "2026-07-04T07:00:00Z",
      })
    );
  });

  it("handles sync failure gracefully — marks as failed, continues", async () => {
    (mockNetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    (mockDb.getPendingSyncVisits as jest.Mock).mockResolvedValueOnce([
      { local_id: "LOCAL-FAIL", salesman_sk: "SM-002", outlet_sk: "OUT-002",
        visit_date: "2026-07-04", visit_type: "ROUTE", total_demand: 0, effective_call: "NO", sync_status: "local" },
    ]);
    (mockApi.checkin as jest.Mock).mockRejectedValueOnce(new Error("Network error"));
    (mockDb.updateLocalVisitSyncStatus as jest.Mock).mockResolvedValue(undefined);

    const result = await flushPendingVisits();
    expect(result.failed).toBe(1);
    expect(result.synced).toBe(0);
    expect(mockDb.updateLocalVisitSyncStatus).toHaveBeenCalledWith("LOCAL-FAIL", "failed");
  });

  it("stops cleanly when connection drops mid-flush — remaining visits stay queued", async () => {
    // Online for the initial gate, offline on the per-visit re-check
    (mockNetInfo.fetch as jest.Mock)
      .mockResolvedValueOnce({ isConnected: true, isInternetReachable: true })
      .mockResolvedValue({ isConnected: false, isInternetReachable: false });
    (mockDb.getPendingSyncVisits as jest.Mock).mockResolvedValueOnce([
      { local_id: "LOCAL-A", salesman_sk: "SM-003", outlet_sk: "OUT-003",
        visit_date: "2026-07-04", visit_type: "ROUTE", total_demand: 0, effective_call: "NO", sync_status: "local" },
    ]);

    const result = await flushPendingVisits();
    expect(result).toEqual({ synced: 0, failed: 0 });
    expect(mockApi.checkin).not.toHaveBeenCalled();
  });
});
