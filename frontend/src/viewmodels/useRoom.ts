import { useCallback, useRef, useState } from "react";
import type { GameResult, Room, WsInMessage } from "../models";
import { RoomWsClient } from "../services/ws";

const API = import.meta.env.VITE_API_URL ?? "";

interface PendingChallenge {
  challenge_id: string;
  from_player: string;
  room_id: string;
}

interface RoomState {
  room: Room | null;
  countdown: number | null;
  opponentProgress: number;
  results: GameResult | null;
  wsConnected: boolean;
  pendingChallenge: PendingChallenge | null;
  opponentDisconnected: boolean;
  challengeSentTo: string | null;
  createRoom: (difficulty: string) => Promise<void>;
  sendChallenge: (toPlayer: string, difficulty: string) => Promise<{ challenge_id: string; room_id: string }>;
  joinRoom: (roomId: string) => Promise<void>;
  submitResult: (timeMs: number) => void;
  sendProgress: (cellsFilled: number) => void;
  cancelRoom: () => Promise<void>;
  acceptChallenge: (challengeId: string) => Promise<{ room_id: string; seed: number; difficulty: string }>;
  declineChallenge: (challengeId: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  connectWs: (roomId: string) => void;
  disconnectWs: () => void;
}

export function useRoom(playerName: string): RoomState {
  const [room, setRoom] = useState<Room | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [results, setResults] = useState<GameResult | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [challengeSentTo, setChallengeSentTo] = useState<string | null>(null);

  const wsRef = useRef<RoomWsClient | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRoomId = useRef<string | null>(null);

  const handleWsMessage = useCallback((msg: WsInMessage) => {
    switch (msg.type) {
      case "ROOM_STATE":
        setRoom({
          room_id: msg.room_id,
          host: msg.host,
          guest: msg.guest,
          difficulty: msg.difficulty as Room["difficulty"],
          seed: msg.seed,
          status: msg.status as Room["status"],
        });
        break;
      case "COUNTDOWN":
        setCountdown(msg.n);
        if (msg.n === 0) {
          setTimeout(() => setCountdown(null), 500);
        }
        break;
      case "OPPONENT_PROGRESS":
        setOpponentProgress(msg.cells_filled);
        break;
      case "OPPONENT_DISCONNECTED":
        setOpponentDisconnected(true);
        break;
      case "GAME_RESULTS":
        setResults({ winner: msg.winner, winner_time_ms: msg.winner_time_ms, loser_time_ms: msg.loser_time_ms });
        break;
      default:
        break;
    }
  }, []);

  const connectWs = useCallback((roomId: string) => {
    const client = new RoomWsClient();
    client.onMessage(handleWsMessage);
    client.connect(roomId, playerName);
    wsRef.current = client;
    setWsConnected(true);
  }, [playerName, handleWsMessage]);

  const disconnectWs = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setWsConnected(false);
  }, []);

  const createRoom = useCallback(async (difficulty: string) => {
    const res = await fetch(`${API}/api/v1/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_name: playerName, difficulty }),
    });
    if (!res.ok) throw new Error("Failed to create room");
    const { room_id, seed } = await res.json() as { room_id: string; seed: number; difficulty: string };
    setRoom({ room_id, host: playerName, guest: null, difficulty: difficulty as Room["difficulty"], seed, status: "WAITING" });
    currentRoomId.current = room_id;
  }, [playerName]);

  const sendChallenge = useCallback(async (toPlayer: string, difficulty: string) => {
    const res = await fetch(`${API}/api/v1/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_player: playerName, to_player: toPlayer, difficulty }),
    });
    if (!res.ok) throw new Error("Failed to send challenge");
    const { challenge_id, room_id } = await res.json() as { challenge_id: string; room_id: string };
    setRoom({ room_id, host: playerName, guest: null, difficulty: difficulty as Room["difficulty"], seed: 0, status: "WAITING" });
    setChallengeSentTo(toPlayer);
    currentRoomId.current = room_id;
    return { challenge_id, room_id };
  }, [playerName]);

  const joinRoom = useCallback(async (roomId: string) => {
    const res = await fetch(`${API}/api/v1/rooms/${roomId}`);
    if (!res.ok) throw new Error("Room not found");
    const data = await res.json() as Room;
    setRoom(data);
    currentRoomId.current = roomId;
  }, []);

  const submitResult = useCallback((timeMs: number) => {
    wsRef.current?.send({ type: "SUBMIT_RESULT", time_ms: timeMs });
  }, []);

  const sendProgress = useCallback((cellsFilled: number) => {
    if (progressTimerRef.current) return;
    wsRef.current?.send({ type: "PROGRESS", cells_filled: cellsFilled });
    progressTimerRef.current = setTimeout(() => { progressTimerRef.current = null; }, 500);
  }, []);

  const cancelRoom = useCallback(async () => {
    const roomId = currentRoomId.current;
    if (!roomId) return;
    await fetch(`${API}/api/v1/rooms/${roomId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_name: playerName }),
    });
    setRoom(null);
    setChallengeSentTo(null);
    currentRoomId.current = null;
  }, [playerName]);

  const acceptChallenge = useCallback(async (challengeId: string) => {
    const res = await fetch(`${API}/api/v1/challenges/${challengeId}/accept`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to accept challenge");
    return res.json() as Promise<{ room_id: string; seed: number; difficulty: string }>;
  }, []);

  const declineChallenge = useCallback(async (challengeId: string) => {
    await fetch(`${API}/api/v1/challenges/${challengeId}/decline`, { method: "POST" });
    setPendingChallenge(null);
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    const poll = async () => {
      try {
        const res = await fetch(`${API}/api/v1/players/${playerName}/challenges`);
        if (res.ok) {
          const challenges = await res.json() as PendingChallenge[];
          if (challenges.length > 0) setPendingChallenge(challenges[0]);
        }
      } catch { /* silently ignore */ }
    };
    pollRef.current = setInterval(poll, 3_000);
  }, [playerName]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  return {
    room, countdown, opponentProgress, results,
    wsConnected, pendingChallenge, opponentDisconnected, challengeSentTo,
    createRoom, sendChallenge, joinRoom, submitResult, sendProgress, cancelRoom,
    acceptChallenge, declineChallenge,
    startPolling, stopPolling, connectWs, disconnectWs,
  };
}
