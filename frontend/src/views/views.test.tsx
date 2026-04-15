import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(cell?.className).toContain("bg-blue-50");
  });

  it("applies related bg to cells in the same column as selectedCell", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    const cell = container.querySelector("[data-testid='cell-0-4']");
    expect(cell?.className).toContain("bg-blue-50");
  });

  it("applies related bg to cells in the same 3x3 box as selectedCell", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    // selectedCell r=2, c=4 → box rows 0-2, cols 3-5 → cell r=0, c=3 is related
    const cell = container.querySelector("[data-testid='cell-0-3']");
    expect(cell?.className).toContain("bg-blue-50");
  });

  it("does not apply related bg to cells outside row/col/box", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    // r=0, c=0: different row, column, and box from r=2, c=4
    const cell = container.querySelector("[data-testid='cell-0-0']");
    expect(cell?.className).not.toContain("bg-blue-50");
  });

  it("does not apply related bg to the selected cell itself", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={{ r: 2, c: 4 }} highlightNum={null} onSelectCell={vi.fn()} />
    );
    const selected = container.querySelector("[data-testid='cell-2-4']");
    expect(selected?.className).toMatch(/bg-blue-500/);
    expect(selected?.className).not.toMatch(/\bbg-blue-50\b/);
  });

  it("does not highlight any cell when selectedCell is null", () => {
    const { container } = render(
      <Board board={makeEmptyBoard()} selectedCell={null} highlightNum={null} onSelectCell={vi.fn()} />
    );
    const cells = container.querySelectorAll("[data-testid^='cell-']");
    cells.forEach((cell) => {
      expect(cell.className).not.toMatch(/\bbg-blue-50\b/);
    });
  });
});
