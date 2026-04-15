import type { Board as BoardType } from "../models";

interface BoardProps {
  board: BoardType;
  selectedCell: { r: number; c: number } | null;
  highlightNum: number | null;
  onSelectCell: (r: number, c: number) => void;
}

function isRelated(
  selectedCell: { r: number; c: number } | null,
  r: number,
  c: number
): boolean {
  if (!selectedCell) return false;
  if (selectedCell.r === r && selectedCell.c === c) return false;
  return (
    selectedCell.r === r ||
    selectedCell.c === c ||
    (Math.floor(selectedCell.r / 3) === Math.floor(r / 3) &&
      Math.floor(selectedCell.c / 3) === Math.floor(c / 3))
  );
}

// Priority: selected > highlighted (same-value) > related (same row/col/box) > bare.
// isHighlighted beats related intentionally — number-match highlight is more specific.
function cellClass(
  cell: { value: number; isGiven: boolean; hasError: boolean },
  isSelected: boolean,
  isHighlighted: boolean,
  related: boolean
): string {
  const base =
    "flex items-center justify-center text-lg font-semibold select-none cursor-pointer";
  if (isSelected) return `${base} bg-blue-500 text-white`;
  if (isHighlighted && cell.value !== 0)
    return `${base} bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100`;
  if (related) {
    if (cell.hasError) return `${base} bg-blue-50 dark:bg-gray-700 text-red-500`;
    if (cell.isGiven) return `${base} bg-blue-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100`;
    return `${base} bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400`;
  }
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
          const related = isRelated(selectedCell, r, c);
          return (
            <div
              key={`${r}-${c}`}
              data-testid={`cell-${r}-${c}`}
              className={`${cellClass(cell, isSelected, isHighlighted, related)} ${boxBorderClass(r, c)}`}
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
