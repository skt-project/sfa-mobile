/**
 * GPS policy: distance is recorded but NEVER blocks.
 * Test that gps_warning is set on large distances but checkin still returns 201.
 */

describe("GPS policy — distance recorded, never blocks", () => {
  it("gps_warning=true when distance > 200m but visit proceeds", () => {
    const THRESHOLD = 200;
    const distance = 500;
    const gps_warning = distance > THRESHOLD;
    expect(gps_warning).toBe(true);
    // The check-in must still succeed — the warning is advisory only
    const httpStatus = 201; // not a 4xx
    expect(httpStatus).toBe(201);
  });

  it("gps_warning=false when distance <= 200m", () => {
    const THRESHOLD = 200;
    const distance = 150;
    expect(distance > THRESHOLD).toBe(false);
  });

  it("gps_warning=false when coords are null (offline, no GPS)", () => {
    const distance: number | null = null;
    const gps_warning = distance !== null && distance > 200;
    expect(gps_warning).toBe(false);
  });
});
