import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLeaderboard } from "./useLeaderboard";

vi.mock("../services/api", () => ({
  getLeaderboard: vi.fn(),
}));

import { getLeaderboard } from "../services/api";

const mockGetLeaderboard = vi.mocked(getLeaderboard);

beforeEach(() => vi.clearAllMocks());

describe("useLeaderboard", () => {
  it("starts with empty entries and loading false", () => {
    mockGetLeaderboard.mockResolvedValue([]);
    const { result } = renderHook(() => useLeaderboard());
    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("load() sets loading true then false and populates entries", async () => {
    mockGetLeaderboard.mockResolvedValue([
      { name: "Alice", wins: 5, played: 8, created_at: "" },
      { name: "Bob", wins: 2, played: 4, created_at: "" },
    ]);
    const { result } = renderHook(() => useLeaderboard());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].name).toBe("Alice");
  });
});
