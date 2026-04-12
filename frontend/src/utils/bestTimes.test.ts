import { describe, it, expect, beforeEach } from "vitest";
import { getBestTime, recordTime } from "./bestTimes";

beforeEach(() => {
  localStorage.clear();
});

describe("getBestTime", () => {
  it("returns null when no time recorded", () => {
    expect(getBestTime("easy")).toBeNull();
  });
});

describe("recordTime", () => {
  it("stores the first time as best", () => {
    recordTime("medium", 120);
    expect(getBestTime("medium")).toBe(120);
  });

  it("updates best when a faster time is recorded", () => {
    recordTime("hard", 200);
    recordTime("hard", 150);
    expect(getBestTime("hard")).toBe(150);
  });

  it("keeps existing best when a slower time is recorded", () => {
    recordTime("easy", 100);
    recordTime("easy", 180);
    expect(getBestTime("easy")).toBe(100);
  });

  it("tracks times independently per difficulty", () => {
    recordTime("easy", 60);
    recordTime("expert", 300);
    expect(getBestTime("easy")).toBe(60);
    expect(getBestTime("expert")).toBe(300);
  });
});
