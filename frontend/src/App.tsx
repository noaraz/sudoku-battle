import { useState } from "react";
import { useTheme } from "./viewmodels/useTheme";
import { Lobby } from "./views/Lobby";
import { GameScreen } from "./views/GameScreen";
import { ResultsScreen } from "./views/ResultsScreen";
import { recordTime } from "./utils/bestTimes";
import type { Difficulty } from "./models";

type Screen = "lobby" | "game" | "results";

export default function App() {
  const { theme, toggle } = useTheme();
  const [screen, setScreen] = useState<Screen>("lobby");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [seed, setSeed] = useState(Date.now());
  const [finishTime, setFinishTime] = useState(0);

  function handleStart(d: Difficulty) {
    setDifficulty(d);
    setSeed(Date.now());
    setScreen("game");
  }

  function handleFinish(seconds: number) {
    recordTime(difficulty, seconds);
    setFinishTime(seconds);
    setScreen("results");
  }

  function handlePlayAgain() {
    setScreen("lobby");
  }

  return (
    <>
      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="fixed top-3 right-3 z-50 text-xl"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      {screen === "lobby" && <Lobby onStart={handleStart} />}
      {screen === "game" && (
        <GameScreen seed={seed} difficulty={difficulty} onFinish={handleFinish} />
      )}
      {screen === "results" && (
        <ResultsScreen
          difficulty={difficulty}
          seconds={finishTime}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </>
  );
}
