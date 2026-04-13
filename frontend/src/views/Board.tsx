import type { Board as BoardType } from "../models";

interface BoardProps {
  board: BoardType;
  selectedCell: { r: number; c: number } | null;
  highlightNum: number | null;
  onSelectCell: (r: number, c: number) => void;
}

function cellClass(
  cell: { value: number; isGiven: boolean; hasError: boolean },
  isSelected: boolean,
  isHighlighted: boolean
): string {
  const base =
    "flex items-center justify-center text-lg font-semibold select-none cursor-pointer";
  if (isSelected) return `${base} bg-blue-500 text-white`;
  if (isHighlighted && cell.value !== 0)
    return `${base} bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100`;
  if (cell.hasError) return `${base} text-red-500`;
  if (cell.isGiven) return `${base} text-gray-900 dark:text-gray-100`;
  return `${base} text-blue-600 dark:text-blue-400`;
}

function boxBorderClass(r: number, c: number): string {
  const bt = r % 3 === 0 ? "border-t-2" : "border-t";
  const bb = r === 8 ? "border-b-2" : "";
  const bl = c % 3 === 0 ? "border-l-2" : "border-l";
  const br = c === 8 ? "border-r-2" : "";
  return `${bt} ${bb} ${bl} ${br} border-gray-800 dark:border-gray-200`;
}

export function Board({ board, selectedCell, highlightNum, onSelectCell }: BoardProps) {
  return (
    <div className="grid grid-cols-9 w-full max-w-[360px] aspect-square">
      {board.map((row, r) =>
        row.map((cell, c) => {
          const isSelected = selectedCell?.r === r && selectedCell?.c === c;
          const isHighlighted = highlightNum !== null && cell.value === highlightNum;
          return (
            <div
              key={`${r}-${c}`}
              className={`${cellClass(cell, isSelected, isHighlighted)} ${boxBorderClass(r, c)}`}
              onClick={() => onSelectCell(r, c)}
            >
              {cell.value !== 0 ? cell.value : ""}
            </div>
          );
        })
      )}
    </div>
  );
}
