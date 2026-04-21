import { useEffect, useState } from "react";

import { Difficulty } from "./models";
import { useAuth } from "./viewmodels/useAuth";
import { useLeaderboard } from "./viewmodels/useLeaderboard";
import { useRoom } from "./viewmodels/useRoom";
import { useTheme } from "./viewmodels/useTheme";
import { recordTime } from "./utils/bestTimes";
import { BattleMenu } from "./views/BattleMenu";
import { Countdown } from "./views/Countdown";
import { GameScreen } from "./views/GameScreen";
import { LeaderboardScreen } from "./views/LeaderboardScreen";
import { Lobby } from "./views/Lobby";
import { LoginScreen } from "./views/LoginScreen";
import { ResultsScreen } from "./views/ResultsScreen";
import { WaitingRoom } from "./views/WaitingRoom";

type Screen = "login" | "lobby" | "battle-menu" | "waiting" | "game" | "results" | "leaderboard";

export default function App() {
  const { theme, toggle } = useTheme();
  const auth = useAuth();
  const leaderboard = useLeaderboard();
  const room = useRoom(auth.selectedPlayer?.name ?? "");

  const [screen, setScreen] = useState<Screen>(() =>
    localStorage.getItem("selectedPlayer") ? "lobby" : "login"
  );
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [seed, setSeed] = useState(0);
  const [finishTime, setFinishTime] = useState(0);
  const [battleResult, setBattleResult] = useState<{
    winner: string;
    winner_time_ms: number;
    loser_time_ms: number | null;
    playerName: string;
    opponentName: string;
  } | null>(null);
  const [playerProgress, setPlayerProgress] = useState(0);

  useEffect(() => {
    if (screen === "leaderboard") {
      void leaderboard.load();
    }
  }, [screen]);

  useEffect(() => {
    if (screen === "lobby") room.startPolling();
    else room.stopPolling();
  }, [screen]);

  useEffect(() => {
    if (room.results && screen === "game") {
      setBattleResult({
        winner: room.results.winner,
        winner_time_ms: room.results.winner_time_ms,
        loser_time_ms: room.results.loser_time_ms,
        playerName: auth.selectedPlayer?.name ?? "",
        opponentName: room.room
          ? (room.room.host === auth.selectedPlayer?.name ? room.room.guest ?? "Opponent" : room.room.host)
          : "Opponent",
      });
      setScreen("results");
    }
  }, [room.results, screen]);

  useEffect(() => {
    if (room.room?.status === "PLAYING" && screen === "waiting") {
      setSeed(room.room.seed);
      setDifficulty(room.room.difficulty);
      setScreen("game");
    }
  }, [room.room?.status, screen]);

  function handleSolo(d: Difficulty) {
    setDifficulty(d);
    setSeed(Date.now());
    setScreen("game");
  }

  function handleFinish(seconds: number) {
    setFinishTime(seconds);
    if (room.room) {
      room.submitResult(seconds * 1000);
    } else {
      recordTime(difficulty, seconds);
      setScreen("results");
    }
  }

  function handlePlayAgain() {
    setBattleResult(null);
    setPlayerProgress(0);
    room.disconnectWs();
    setScreen("lobby");
  }

  return (
    <div className={theme}>
      {(screen === "lobby" || screen === "results") && (
        <button
          onClick={toggle}
          className="fixed top-3 right-3 z-50 text-xl"
          aria-label="toggle theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      )}

      {screen === "login" && (
        <LoginScreen
          knownPlayers={auth.knownPlayers}
          onSelect={(name) => {
            auth.selectPlayer(name);
            setScreen("lobby");
          }}
          onAdd={auth.addPlayer}
        />
      )}

      {screen === "lobby" && (
        <Lobby
          onSolo={handleSolo}
          onScores={() => setScreen("leaderboard")}
          onBattle={() => setScreen("battle-menu")}
          pendingChallenge={room.pendingChallenge}
          onAcceptChallenge={async (challengeId) => {
            const data = await room.acceptChallenge(challengeId);
            setDifficulty(data.difficulty as Difficulty);
            setSeed(data.seed);
            room.connectWs(data.room_id);
            setScreen("waiting");
          }}
          onDeclineChallenge={room.declineChallenge}
        />
      )}

      {screen === "battle-menu" && (
        <BattleMenu
          players={auth.knownPlayers}
          currentPlayer={auth.selectedPlayer?.name ?? ""}
          onChallenge={async (toPlayer, diff) => {
            const { room_id } = await room.sendChallenge(toPlayer, diff);
            room.connectWs(room_id);
            setScreen("waiting");
          }}
          onJoinByCode={async (code) => {
            await room.joinRoom(code);
            room.connectWs(code);
            setScreen("waiting");
          }}
          onBack={() => setScreen("lobby")}
        />
      )}

      {screen === "waiting" && room.room && (
        <>
          <Countdown n={room.countdown} />
          <WaitingRoom
            roomId={room.room.room_id}
            host={room.room.host}
            guest={room.room.guest}
            challengeSentTo={room.challengeSentTo}
            onCancel={async () => {
              await room.cancelRoom();
              room.disconnectWs();
              setScreen("lobby");
            }}
          />
        </>
      )}

      {screen === "game" && (
        <GameScreen
          seed={seed}
          difficulty={difficulty}
          onFinish={handleFinish}
          battleMode={!!room.room}
          opponentName={
            room.room
              ? (room.room.host === auth.selectedPlayer?.name ? room.room.guest ?? undefined : room.room.host)
              : undefined
          }
          opponentProgress={room.opponentProgress}
          playerProgress={playerProgress}
          onProgressChange={(filled) => {
            setPlayerProgress(filled);
            room.sendProgress(filled);
          }}
        />
      )}

      {screen === "results" && (
        <ResultsScreen
          seconds={finishTime}
          difficulty={difficulty}
          onPlayAgain={handlePlayAgain}
          battleResult={battleResult ?? undefined}
          onViewScores={battleResult ? () => setScreen("leaderboard") : undefined}
        />
      )}

      {screen === "leaderboard" && (
        <LeaderboardScreen
          entries={leaderboard.entries}
          loading={leaderboard.loading}
          onBack={() => setScreen("lobby")}
        />
      )}
    </div>
  );
}
