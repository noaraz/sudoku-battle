import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRoom } from "./useRoom";

// Mock fetch
global.fetch = vi.fn();

// Mock RoomWsClient so we can simulate incoming WS messages
let mockOnMessage: ((msg: unknown) => void) | null = null;
vi.mock("../services/ws", () => ({
  RoomWsClient: vi.fn().mockImplementation(() => ({
    onMessage: vi.fn((handler: (msg: unknown) => void) => { mockOnMessage = handler; }),
    connect: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
  })),
}));

const mockFetch = (data: unknown, status = 200) => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status < 400,
    status,
    json: async () => data,
  });
};

describe("useRoom", () => {
  beforeEach(() => { vi.useFakeTimers(); mockOnMessage = null; });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it("createRoom sets room state with host from playerName", async () => {
    mockFetch({ room_id: "ABCDEF", seed: 123, difficulty: "easy" });
    const { result } = renderHook(() => useRoom("Alice"));
    await act(async () => {
      await result.current.createRoom("easy");
    });
    expect(result.current.room?.room_id).toBe("ABCDEF");
    expect(result.current.room?.host).toBe("Alice");
    expect(result.current.room?.status).toBe("WAITING");
  });

  it("joinRoom sets room state from API response", async () => {
    mockFetch({ room_id: "XYZABC", seed: 456, difficulty: "medium", host: "Bob", guest: null, status: "WAITING" });
    const { result } = renderHook(() => useRoom("Alice"));
    await act(async () => {
      await result.current.joinRoom("XYZABC");
    });
    expect(result.current.room?.room_id).toBe("XYZABC");
    expect(result.current.room?.host).toBe("Bob");
  });

  it("ROOM_STATE WS message updates room", async () => {
    mockFetch({ room_id: "ABCDEF", seed: 123, difficulty: "easy" });
    const { result } = renderHook(() => useRoom("Alice"));
    await act(async () => { await result.current.createRoom("easy"); });
    act(() => { result.current.connectWs("ABCDEF"); });
    act(() => {
      mockOnMessage?.({ type: "ROOM_STATE", room_id: "ABCDEF", host: "Alice", guest: "Bob", difficulty: "easy", seed: 123, status: "PLAYING" });
    });
    expect(result.current.room?.guest).toBe("Bob");
    expect(result.current.room?.status).toBe("PLAYING");
  });

  it("COUNTDOWN WS message sets countdown", async () => {
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => { result.current.connectWs("ABCDEF"); });
    act(() => { mockOnMessage?.({ type: "COUNTDOWN", n: 3 }); });
    expect(result.current.countdown).toBe(3);
  });

  it("COUNTDOWN n=0 clears countdown after 500ms", async () => {
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => { result.current.connectWs("ABCDEF"); });
    act(() => { mockOnMessage?.({ type: "COUNTDOWN", n: 0 }); });
    expect(result.current.countdown).toBe(0);
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.countdown).toBeNull();
  });

  it("OPPONENT_PROGRESS WS message updates opponentProgress", async () => {
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => { result.current.connectWs("ABCDEF"); });
    act(() => { mockOnMessage?.({ type: "OPPONENT_PROGRESS", cells_filled: 42 }); });
    expect(result.current.opponentProgress).toBe(42);
  });

  it("GAME_RESULTS WS message updates results", async () => {
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => { result.current.connectWs("ABCDEF"); });
    act(() => { mockOnMessage?.({ type: "GAME_RESULTS", winner: "Alice", winner_time_ms: 12345, loser_time_ms: null }); });
    expect(result.current.results?.winner).toBe("Alice");
  });

  it("polls for challenges when startPolling is called", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => result.current.startPolling());
    act(() => { vi.advanceTimersByTime(3000); });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/players/Alice/challenges")
    );
  });

  it("stopPolling clears the interval", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => [],
    });
    const { result } = renderHook(() => useRoom("Alice"));
    act(() => result.current.startPolling());
    act(() => result.current.stopPolling());
    const callCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    act(() => { vi.advanceTimersByTime(9000); });
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
  });

  it("cancelRoom clears room state", async () => {
    mockFetch({ room_id: "ABCDEF", seed: 123, difficulty: "easy" });
    mockFetch({}, 204); // DELETE response
    const { result } = renderHook(() => useRoom("Alice"));
    await act(async () => { await result.current.createRoom("easy"); });
    await act(async () => { await result.current.cancelRoom(); });
    expect(result.current.room).toBeNull();
  });
});
