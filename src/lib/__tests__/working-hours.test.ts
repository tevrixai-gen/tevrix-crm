import { describe, it, expect } from "vitest";
import { isWithinCallingWindow, validateCallingWindow, minutesNowInZone } from "../working-hours";

// Helper: a Date whose IST (UTC+5:30) wall-clock time is hh:mm
function istDate(hh: number, mm: number): Date {
  // 12:00 IST == 06:30 UTC
  const utcMinutes = hh * 60 + mm - 330;
  const d = new Date(Date.UTC(2026, 5, 11, 0, 0, 0));
  d.setUTCMinutes(utcMinutes);
  return d;
}

const IST = "Asia/Kolkata";

describe("minutesNowInZone", () => {
  it("computes IST wall-clock minutes", () => {
    expect(minutesNowInZone(IST, istDate(10, 30))).toBe(630);
    expect(minutesNowInZone(IST, istDate(0, 5))).toBe(5);
  });
});

describe("isWithinCallingWindow (10:00–19:00 IST)", () => {
  const win = { start: "10:00", end: "19:00", timezone: IST };

  it("allows mid-window", () => {
    expect(isWithinCallingWindow(win, istDate(12, 0))).toBe(true);
  });
  it("allows exactly at start", () => {
    expect(isWithinCallingWindow(win, istDate(10, 0))).toBe(true);
  });
  it("blocks exactly at end (exclusive)", () => {
    expect(isWithinCallingWindow(win, istDate(19, 0))).toBe(false);
  });
  it("blocks before start", () => {
    expect(isWithinCallingWindow(win, istDate(9, 59))).toBe(false);
  });
  it("blocks late evening", () => {
    expect(isWithinCallingWindow(win, istDate(22, 0))).toBe(false);
  });
});

describe("midnight-crossing window (22:00–06:00)", () => {
  const win = { start: "22:00", end: "06:00", timezone: IST };

  it("allows 23:00", () => {
    expect(isWithinCallingWindow(win, istDate(23, 0))).toBe(true);
  });
  it("allows 02:00", () => {
    expect(isWithinCallingWindow(win, istDate(2, 0))).toBe(true);
  });
  it("blocks 12:00", () => {
    expect(isWithinCallingWindow(win, istDate(12, 0))).toBe(false);
  });
  it("blocks exactly at end", () => {
    expect(isWithinCallingWindow(win, istDate(6, 0))).toBe(false);
  });
});

describe("validateCallingWindow", () => {
  it("accepts valid windows", () => {
    expect(validateCallingWindow("10:00", "19:00")).toBeNull();
    expect(validateCallingWindow("22:00", "06:00")).toBeNull();
  });
  it("rejects malformed times", () => {
    expect(validateCallingWindow("25:00", "19:00")).toBeTruthy();
    expect(validateCallingWindow("10:00", "19:99")).toBeTruthy();
    expect(validateCallingWindow("abc", "19:00")).toBeTruthy();
  });
  it("rejects zero-width window", () => {
    expect(validateCallingWindow("10:00", "10:00")).toBeTruthy();
  });
});
