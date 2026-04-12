import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timer } from "./Timer";
import { NumPad } from "./NumPad";
import { ActionBar } from "./ActionBar";

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
