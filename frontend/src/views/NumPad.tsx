interface NumPadProps {
  numRemaining: Record<number, number>;
  onInput: (n: number) => void;
  selectedNum?: number | null;
}

export function NumPad({ numRemaining, onInput, selectedNum = null }: NumPadProps) {
  return (
    <div className="grid grid-cols-9 gap-1 w-full max-w-[360px]">
      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
        const remaining = numRemaining[n] ?? 0;
        const done = remaining === 0;
        const isArmed = selectedNum === n;
        return (
          <button
            key={n}
            onClick={() => onInput(n)}
            disabled={done}
            className={`flex flex-col items-center justify-center rounded py-2 text-base font-bold
              ${done
                ? "opacity-30 cursor-not-allowed"
                : isArmed
                  ? "bg-blue-500 text-white active:scale-95"
                  : "bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-800 active:scale-95"
              }`}
          >
            <span>{n}</span>
            {!done && (
              <span className={`text-[10px] leading-none ${isArmed ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}>
                {remaining}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
