import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChallengeNotification } from "./ChallengeNotification";
import { Timer } from "./Timer";
import { NumPad } from "./NumPad";
import { ActionBar } from "./ActionBar";
import { Board } from "./Board";
import type { Board as BoardType } from "../models";

describe("Timer", () => {
  it("renders MM:SS format", () => {
    render(<Timer seconds={75} />);
    expect(screen.getByText("01:15")).toBeTruthy();
  });

  it("renders with muted color class", () => {
    const { container } = render(<Timer seconds={0} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("text-gray-400");
  });
});

describe("NumPad", () => {
  it("renders 9 buttons", () => {
    const remaining: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) remaining[i] = 3;
    render(<NumPad numRemaining={remaining} onInput={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(9);
  });

  it("calls onInput with the correct digit", async () => {
    const onInput = vi.fn();
    const remaining: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) remaining[i] = 3;
    render(<NumPad numRemaining={remaining} onInput={onInput} />);
    await userEvent.click(screen.getAllByRole("button")[4]); // digit 5
    expect(onInput).toHaveBeenCalledWith(5);
  });

  it("disables buttons for completed digits", () => {
    const remaining: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) remaining[i] = i === 7 ? 0 : 3;
    render(<NumPad numRemaining={remaining} onInput={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[6]).toBeDisabled(); // index 6 = digit 7
  });

  it("highlights the selectedNum button with blue bg", () => {
    const remaining: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) remaining[i] = 3;
    render(<NumPad numRemaining={remaining} onInput={vi.fn()} selectedNum={5} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[4].className).toContain("bg-blue-500"); // index 4 = digit 5
  });

  it("does not highlight non-selected buttons when selectedNum is set", () => {
    const remaining: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) remaining[i] = 3;
    render(<NumPad numRemaining={remaining} onInput={vi.fn()} selectedNum={5} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].className).not.toContain("bg-blue-500"); // digit 1
  });

  it("no button is highlighted when selectedNum is null", () => {
    const remaining: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) remaining[i] = 3;
    render(<NumPad numRemaining={remaining} onInput={vi.fn()} selectedNum={null} />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn.className).not.toContain("bg-blue-500"));
  });

  it("does not highlight a done+armed button (done takes priority)", () => {
    const remaining: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) remaining[i] = i === 7 ? 0 : 3;
    render(<NumPad numRemaining={remaining} onInput={vi.fn()} selectedNum={7} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[6]).toBeDisabled(); // digit 7 is done
    expect(buttons[6].className).not.toContain("bg-blue-500");
  });
});

describe("ActionBar", () => {
  it("calls onUndo when undo is clicked", async () => {
    const onUndo = vi.fn();
    render(
      <ActionBar
        lightningMode={false}
        onUndo={onUndo}
        onErase={vi.fn()}
        onToggleLightning={vi.fn()}
      />
    );
    await userEvent.click(screen.getByLabelText("Undo"));
    expect(onUndo).toHaveBeenCalled();
  });

  it("calls onToggleLightning when lightning is clicked", async () => {
    const onToggle = vi.fn();
    render(
      <ActionBar
        lightningMode={false}
        onUndo={vi.fn()}
        onErase={vi.fn()}
        onToggleLightning={onToggle}
      />
    );
    await userEvent.click(screen.getByLabelText("Lightning mode"));
    expect(onToggle).toHaveBeenCalled();
  });
});

function makeEmptyBoard(): BoardType {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({ value: 0, isGiven: false, hasError: false }))
  );
}

describe("Board — related-cell highlighting", () => {
  it("applies related bg to cells in the same row as selectedCell", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    const cell = container.querySelector("[data-testid='cell-2-0']");
    expect(cell?.className).toContain("bg-blue-100");
  });

  it("applies related bg to cells in the same column as selectedCell", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    const cell = container.querySelector("[data-testid='cell-0-4']");
    expect(cell?.className).toContain("bg-blue-100");
  });

  it("applies related bg to cells in the same 3x3 box as selectedCell", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    // selectedCell r=2, c=4 → box rows 0-2, cols 3-5 → cell r=0, c=3 is related
    const cell = container.querySelector("[data-testid='cell-0-3']");
    expect(cell?.className).toContain("bg-blue-100");
  });

  it("does not apply related bg to cells outside row/col/box", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    // r=0, c=0: different row, column, and box from r=2, c=4
    const cell = container.querySelector("[data-testid='cell-0-0']");
    expect(cell?.className).not.toContain("bg-blue-100");
  });

  it("does not apply related bg to the selected cell itself", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    const selected = container.querySelector("[data-testid='cell-2-4']");
    expect(selected?.className).toMatch(/bg-blue-500/);
    expect(selected?.className).not.toContain("bg-blue-100");
  });

  it("does not highlight any cell when selectedCell is null", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={null} highlightNum={null} onSelectCell={vi.fn()} />
    );
    const cells = container.querySelectorAll("[data-testid^='cell-']");
    cells.forEach((cell) => {
      expect(cell.className).not.toMatch(/\bbg-blue-100\b/);
    });
  });
});

// ─── LoginScreen ────────────────────────────────────────────────────────────
import { LoginScreen } from "./LoginScreen";

describe("LoginScreen", () => {
  const players = [
    { name: "Alice", wins: 3, played: 5 },
    { name: "Bob", wins: 1, played: 2 },
  ];

  it("renders a button for each known player", () => {
    render(
      <LoginScreen
        knownPlayers={players}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows empty-state message when no players", () => {
    render(
      <LoginScreen knownPlayers={[]} onSelect={vi.fn()} onAdd={vi.fn()} />
    );
    expect(screen.getByText(/no players yet/i)).toBeInTheDocument();
  });

  it("calls onSelect with player name when player row is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <LoginScreen
        knownPlayers={players}
        onSelect={onSelect}
        onAdd={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText("Alice"));
    expect(onSelect).toHaveBeenCalledWith("Alice");
  });

  it("shows add-player input when 'Add player' is clicked", async () => {
    render(
      <LoginScreen knownPlayers={[]} onSelect={vi.fn()} onAdd={vi.fn()} />
    );
    await userEvent.click(screen.getByText(/add player/i));
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
  });

  it("calls onAdd then onSelect when new player is submitted", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onSelect = vi.fn();
    render(
      <LoginScreen knownPlayers={[]} onSelect={onSelect} onAdd={onAdd} />
    );
    await userEvent.click(screen.getByText(/add player/i));
    await userEvent.type(screen.getByPlaceholderText(/your name/i), "Carol");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onAdd).toHaveBeenCalledWith("Carol");
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("Carol"));
  });

  it("shows error message when onAdd throws 'name taken'", async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error("name taken"));
    render(
      <LoginScreen knownPlayers={[]} onSelect={vi.fn()} onAdd={onAdd} />
    );
    await userEvent.click(screen.getByText(/add player/i));
    await userEvent.type(screen.getByPlaceholderText(/your name/i), "Alice");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() =>
      expect(screen.getByText(/name taken/i)).toBeInTheDocument()
    );
  });
});

// ─── LeaderboardScreen ──────────────────────────────────────────────────────
import { LeaderboardScreen } from "./LeaderboardScreen";

describe("LeaderboardScreen", () => {
  const entries = [
    { name: "Alice", wins: 5, played: 8 },
    { name: "Bob", wins: 2, played: 4 },
  ];

  it("renders a ranked row for each entry", () => {
    render(
      <LeaderboardScreen entries={entries} loading={false} onBack={vi.fn()} />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/5 wins/)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <LeaderboardScreen entries={[]} loading={true} onBack={vi.fn()} />
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    render(
      <LeaderboardScreen entries={[]} loading={false} onBack={vi.fn()} />
    );
    expect(screen.getByText(/no scores yet/i)).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const onBack = vi.fn();
    render(
      <LeaderboardScreen entries={entries} loading={false} onBack={onBack} />
    );
    await userEvent.click(screen.getByRole("button", { name: /back|←/i }));
    expect(onBack).toHaveBeenCalled();
  });
});

// ─── Countdown ──────────────────────────────────────────────────────────────
import { Countdown } from "./Countdown";

describe("Countdown", () => {
  it("renders nothing when n is null", () => {
    const { container } = render(<Countdown n={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the countdown number", () => {
    render(<Countdown n={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders GO! when n is 0", () => {
    render(<Countdown n={0} />);
    expect(screen.getByText("GO!")).toBeInTheDocument();
  });
});

// ─── WaitingRoom ────────────────────────────────────────────────────────────
import { WaitingRoom } from "./WaitingRoom";

describe("WaitingRoom", () => {
  it("renders the room code", () => {
    render(<WaitingRoom roomId="ABC123" host="Alice" guest={null} challengeSentTo={null} onCancel={vi.fn()} />);
    expect(screen.getByText("ABC123")).toBeInTheDocument();
  });

  it("renders the host name", () => {
    render(<WaitingRoom roomId="ABC123" host="Alice" guest={null} challengeSentTo={null} onCancel={vi.fn()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows waiting message when guest is null", () => {
    render(<WaitingRoom roomId="ABC123" host="Alice" guest={null} challengeSentTo={null} onCancel={vi.fn()} />);
    expect(screen.getByText(/waiting for opponent/i)).toBeInTheDocument();
  });

  it("renders guest name when guest has joined", () => {
    render(<WaitingRoom roomId="ABC123" host="Alice" guest="Bob" challengeSentTo={null} onCancel={vi.fn()} />);
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows challenge sent message when challengeSentTo is set", () => {
    render(<WaitingRoom roomId="ABC123" host="Alice" guest={null} challengeSentTo="Bob" onCancel={vi.fn()} />);
    expect(screen.getByText(/bob/i)).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(<WaitingRoom roomId="ABC123" host="Alice" guest={null} challengeSentTo={null} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});

// ─── BattleMenu ─────────────────────────────────────────────────────────────
import { BattleMenu } from "./BattleMenu";
import type { Player } from "../models";

const makePlayers = (...names: string[]): Player[] =>
  names.map((name) => ({ name, wins: 0, played: 0 }));

describe("BattleMenu", () => {
  it("renders difficulty buttons", () => {
    render(<BattleMenu players={[]} currentPlayer="Alice" onChallenge={vi.fn()} onJoinByCode={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /easy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hard/i })).toBeInTheDocument();
  });

  it("shows empty state when no other players", () => {
    render(<BattleMenu players={makePlayers("Alice")} currentPlayer="Alice" onChallenge={vi.fn()} onJoinByCode={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/no other players/i)).toBeInTheDocument();
  });

  it("renders other players excluding current player", () => {
    render(<BattleMenu players={makePlayers("Alice", "Bob", "Carol")} currentPlayer="Alice" onChallenge={vi.fn()} onJoinByCode={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("calls onChallenge when Challenge is clicked", async () => {
    const onChallenge = vi.fn().mockResolvedValue(undefined);
    render(<BattleMenu players={makePlayers("Alice", "Bob")} currentPlayer="Alice" onChallenge={onChallenge} onJoinByCode={vi.fn()} onBack={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /challenge/i }));
    expect(onChallenge).toHaveBeenCalledWith("Bob", expect.any(String));
  });

  it("shows error when join code is too short", async () => {
    render(<BattleMenu players={[]} currentPlayer="Alice" onChallenge={vi.fn()} onJoinByCode={vi.fn()} onBack={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^join$/i }));
    expect(screen.getByText(/6-character/i)).toBeInTheDocument();
  });

  it("calls onJoinByCode when a valid 6-char code is submitted", async () => {
    const onJoin = vi.fn().mockResolvedValue(undefined);
    render(<BattleMenu players={[]} currentPlayer="Alice" onChallenge={vi.fn()} onJoinByCode={onJoin} onBack={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/K7X2AB/i), "ABCDEF");
    await userEvent.click(screen.getByRole("button", { name: /^join$/i }));
    expect(onJoin).toHaveBeenCalledWith("ABCDEF");
  });

  it("calls onBack when Back is clicked", async () => {
    const onBack = vi.fn();
    render(<BattleMenu players={[]} currentPlayer="Alice" onChallenge={vi.fn()} onJoinByCode={vi.fn()} onBack={onBack} />);
    await userEvent.click(screen.getByText(/← back/i));
    expect(onBack).toHaveBeenCalled();
  });

  it("changes selected difficulty when clicked", async () => {
    render(<BattleMenu players={[]} currentPlayer="Alice" onChallenge={vi.fn()} onJoinByCode={vi.fn()} onBack={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^easy$/i }));
    expect(screen.getByRole("button", { name: /^easy$/i }).className).toContain("bg-blue-600");
  });
});

// ─── ResultsScreen ──────────────────────────────────────────────────────────
import { ResultsScreen } from "./ResultsScreen";

describe("ResultsScreen — battle mode", () => {
  const battleResult = {
    winner: "Alice",
    winner_time_ms: 90000,
    loser_time_ms: null,
    playerName: "Alice",
    opponentName: "Bob",
  };

  it("shows 'You won!' when player is the winner", () => {
    render(<ResultsScreen seconds={90} difficulty="easy" onPlayAgain={vi.fn()} battleResult={battleResult} />);
    expect(screen.getByText(/you won/i)).toBeInTheDocument();
  });

  it("shows 'You lost' when player is the loser", () => {
    render(
      <ResultsScreen
        seconds={90}
        difficulty="easy"
        onPlayAgain={vi.fn()}
        battleResult={{ ...battleResult, winner: "Bob", playerName: "Alice" }}
      />
    );
    expect(screen.getByText(/you lost/i)).toBeInTheDocument();
  });

  it("displays the winner name", () => {
    render(<ResultsScreen seconds={90} difficulty="easy" onPlayAgain={vi.fn()} battleResult={battleResult} />);
    expect(screen.getByText(/alice/i)).toBeInTheDocument();
  });

  it("shows Scores button when onViewScores is provided", () => {
    render(<ResultsScreen seconds={90} difficulty="easy" onPlayAgain={vi.fn()} battleResult={battleResult} onViewScores={vi.fn()} />);
    expect(screen.getByRole("button", { name: /scores/i })).toBeInTheDocument();
  });

  it("calls onPlayAgain when Play Again is clicked", async () => {
    const onPlayAgain = vi.fn();
    render(<ResultsScreen seconds={90} difficulty="easy" onPlayAgain={onPlayAgain} battleResult={battleResult} />);
    await userEvent.click(screen.getByRole("button", { name: /play again/i }));
    expect(onPlayAgain).toHaveBeenCalled();
  });
});

describe("ResultsScreen — solo mode", () => {
  it("shows 'Puzzle Complete!'", () => {
    render(<ResultsScreen seconds={120} difficulty="medium" onPlayAgain={vi.fn()} />);
    expect(screen.getByText(/puzzle complete/i)).toBeInTheDocument();
  });

  it("formats time as MM:SS", () => {
    render(<ResultsScreen seconds={125} difficulty="medium" onPlayAgain={vi.fn()} />);
    expect(screen.getByText("2:05")).toBeInTheDocument();
  });
});

// ─── GameScreen ─────────────────────────────────────────────────────────────
import { GameScreen } from "./GameScreen";

vi.mock("../viewmodels/useGame", () => ({
  useGame: () => ({
    board: Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => ({ value: r * 9 + c === 0 ? 5 : 0, isGiven: r * 9 + c === 0, hasError: false }))
    ),
    solution: Array.from({ length: 9 }, () => Array(9).fill(1)),
    selectedCell: null,
    selectedNum: null,
    highlightNum: null,
    lightningMode: false,
    lightningNum: null,
    timer: 10,
    isFinished: false,
    numRemaining: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 9])),
    selectCell: vi.fn(),
    inputNumber: vi.fn(),
    erase: vi.fn(),
    undo: vi.fn(),
    toggleLightning: vi.fn(),
  }),
}));

describe("GameScreen", () => {
  it("renders without battle mode (no progress strip)", () => {
    render(<GameScreen seed={1} difficulty="easy" onFinish={vi.fn()} />);
    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });

  it("renders progress strip in battle mode", () => {
    render(<GameScreen seed={1} difficulty="easy" onFinish={vi.fn()} battleMode={true} opponentName="Bob" opponentProgress={20} />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    // mock board has 1 pre-filled cell (cell 0-0), so playerProgress = 1
    expect(screen.getByText("1/81")).toBeInTheDocument();
    expect(screen.getByText("20/81")).toBeInTheDocument();
  });

  it("shows '?' as opponent name when opponentName is not provided in battle mode", () => {
    render(<GameScreen seed={1} difficulty="easy" onFinish={vi.fn()} battleMode={true} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});

// ─── Lobby ──────────────────────────────────────────────────────────────────
import { Lobby } from "./Lobby";

describe("Lobby", () => {
  it("renders Solo, Battle, and Scores options", () => {
    render(<Lobby onSolo={vi.fn()} onScores={vi.fn()} />);
    expect(screen.getByText(/solo/i)).toBeInTheDocument();
    expect(screen.getByText(/battle/i)).toBeInTheDocument();
    expect(screen.getByText(/scores/i)).toBeInTheDocument();
  });

  it("shows difficulty picker when Solo is clicked", async () => {
    render(<Lobby onSolo={vi.fn()} onScores={vi.fn()} />);
    await userEvent.click(screen.getByText(/solo/i));
    expect(screen.getByText(/easy/i)).toBeInTheDocument();
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it("calls onSolo with difficulty when difficulty is selected", async () => {
    const onSolo = vi.fn();
    render(<Lobby onSolo={onSolo} onScores={vi.fn()} />);
    await userEvent.click(screen.getByText(/solo/i));
    await userEvent.click(screen.getByRole("button", { name: /^easy$/i }));
    expect(onSolo).toHaveBeenCalledWith("easy");
  });

  it("calls onScores when Scores is clicked", async () => {
    const onScores = vi.fn();
    render(<Lobby onSolo={vi.fn()} onScores={onScores} />);
    await userEvent.click(screen.getByText(/scores/i));
    expect(onScores).toHaveBeenCalled();
  });

  it("calls onBattle when Battle is clicked", async () => {
    const onBattle = vi.fn();
    render(<Lobby onSolo={vi.fn()} onScores={vi.fn()} onBattle={onBattle} />);
    await userEvent.click(screen.getByText(/battle/i));
    expect(onBattle).toHaveBeenCalled();
  });

  it("displays the current player name when playerName is provided", () => {
    render(<Lobby onSolo={vi.fn()} onScores={vi.fn()} playerName="Alice" onLogout={vi.fn()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders a logout button when onLogout is provided", () => {
    render(<Lobby onSolo={vi.fn()} onScores={vi.fn()} playerName="Alice" onLogout={vi.fn()} />);
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("calls onLogout when the logout button is clicked", async () => {
    const onLogout = vi.fn();
    render(<Lobby onSolo={vi.fn()} onScores={vi.fn()} playerName="Alice" onLogout={onLogout} />);
    await userEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(onLogout).toHaveBeenCalled();
  });

  it("does not render logout button when onLogout is not provided", () => {
    render(<Lobby onSolo={vi.fn()} onScores={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /logout/i })).not.toBeInTheDocument();
  });
});

describe("ChallengeNotification", () => {
  it("shows challenger name with accept and decline buttons", () => {
    render(
      <ChallengeNotification
        fromPlayer="alice"
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />
    );
    expect(screen.getByText(/alice/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
  });

  it("calls onAccept when Accept is clicked", async () => {
    const onAccept = vi.fn();
    render(
      <ChallengeNotification fromPlayer="alice" onAccept={onAccept} onDecline={vi.fn()} />
    );
    await userEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it("calls onDecline when Decline is clicked", async () => {
    const onDecline = vi.fn();
    render(
      <ChallengeNotification fromPlayer="alice" onAccept={vi.fn()} onDecline={onDecline} />
    );
    await userEvent.click(screen.getByRole("button", { name: /decline/i }));
    expect(onDecline).toHaveBeenCalledOnce();
  });
});
