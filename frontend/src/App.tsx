import { useEffect, useState } from "react";

import { Difficulty } from "./models";
import { useAuth } from "./viewmodels/useAuth";
import { useLeaderboard } from "./viewmodels/useLeaderboard";
import { useTheme } from "./viewmodels/useTheme";
import { recordTime } from "./utils/bestTimes";
import { GameScreen } from "./views/GameScreen";
import { LeaderboardScreen } from "./views/LeaderboardScreen";
import { Lobby } from "./views/Lobby";
import { LoginScreen } from "./views/LoginScreen";
import { ResultsScreen } from "./views/ResultsScreen";

type Screen = "login" | "lobby" | "game" | "results" | "leaderboard";

export default function App() {
  const { theme, toggle } = useTheme();
  const auth = useAuth();
  const leaderboard = useLeaderboard();

  const [screen, setScreen] = useState<Screen>(() =>
    localStorage.getItem("selectedPlayer") ? "lobby" : "login"
  );
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [seed, setSeed] = useState(0);
  const [finishTime, setFinishTime] = useState(0);

  useEffect(() => {
    if (screen === "leaderboard") {
      void leaderboard.load();
    }
  }, [screen]);

  function handleSolo(d: Difficulty) {
    setDifficulty(d);
    setSeed(Date.now());
    setScreen("game");
  }

  function handleFinish(seconds: number) {
    setFinishTime(seconds);
    recordTime(difficulty, seconds);
    setScreen("results");
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
        />
      )}

      {screen === "game" && (
        <GameScreen
          seed={seed}
          difficulty={difficulty}
          onFinish={handleFinish}
        />
      )}

      {screen === "results" && (
        <ResultsScreen
          seconds={finishTime}
          difficulty={difficulty}
          onPlayAgain={() => setScreen("lobby")}
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
