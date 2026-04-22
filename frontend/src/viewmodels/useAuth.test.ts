import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "./useAuth";

vi.mock("../services/api", () => ({
  getPlayers: vi.fn(),
  createPlayer: vi.fn(),
}));

import { getPlayers, createPlayer } from "../services/api";

const mockGetPlayers = vi.mocked(getPlayers);
const mockCreatePlayer = vi.mocked(createPlayer);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockGetPlayers.mockResolvedValue([]);
});

describe("useAuth", () => {
  it("starts with no selected player when localStorage is empty", async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.selectedPlayer).toBeNull();
  });

  it("restores selected player from localStorage when backend confirms player exists", async () => {
    mockGetPlayers.mockResolvedValue([{ name: "Alice", wins: 3, played: 5, created_at: "" }]);
    localStorage.setItem("selectedPlayer", JSON.stringify({ name: "Alice", wins: 3, played: 5 }));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.selectedPlayer?.name).toBe("Alice"));
  });

  it("clears stale localStorage player when backend does not know that player", async () => {
    localStorage.setItem("selectedPlayer", JSON.stringify({ name: "Ghost", wins: 0, played: 0 }));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => result.current.knownPlayers !== undefined);
    // give the effect time to run
    expect(result.current.selectedPlayer).toBeNull();
    expect(localStorage.getItem("selectedPlayer")).toBeNull();
  });

  it("fetches known players on mount sorted by name", async () => {
    mockGetPlayers.mockResolvedValue([
      { name: "Zara", wins: 1, played: 2, created_at: "" },
      { name: "Alice", wins: 5, played: 6, created_at: "" },
    ]);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => result.current.knownPlayers.length > 0);
    expect(result.current.knownPlayers[0].name).toBe("Alice");
    expect(result.current.knownPlayers[1].name).toBe("Zara");
  });

  it("selectPlayer saves to state and localStorage", async () => {
    mockGetPlayers.mockResolvedValue([
      { name: "Bob", wins: 2, played: 4, created_at: "" },
    ]);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => result.current.knownPlayers.length > 0);
    act(() => result.current.selectPlayer("Bob"));
    expect(result.current.selectedPlayer?.name).toBe("Bob");
    const stored = JSON.parse(localStorage.getItem("selectedPlayer")!);
    expect(stored.name).toBe("Bob");
  });

  it("addPlayer calls createPlayer then refreshes knownPlayers", async () => {
    mockCreatePlayer.mockResolvedValue({
      name: "Carol",
      wins: 0,
      played: 0,
      created_at: "",
    });
    mockGetPlayers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { name: "Carol", wins: 0, played: 0, created_at: "" },
      ]);
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.addPlayer("Carol");
    });
    expect(mockCreatePlayer).toHaveBeenCalledWith("Carol");
    await waitFor(() =>
      result.current.knownPlayers.some((p) => p.name === "Carol")
    );
  });

  it("addPlayer throws Error('name taken') on duplicate", async () => {
    mockCreatePlayer.mockRejectedValue(new Error("name taken"));
    const { result } = renderHook(() => useAuth());
    await expect(result.current.addPlayer("Alice")).rejects.toThrow(
      "name taken"
    );
  });
});
