interface ActionBarProps {
  lightningMode: boolean;
  onUndo: () => void;
  onErase: () => void;
  onToggleLightning: () => void;
}

export function ActionBar({ lightningMode, onUndo, onErase, onToggleLightning }: ActionBarProps) {
  return (
    <div className="flex items-center justify-around w-full max-w-[360px]">
      <button
        onClick={onUndo}
        className="flex flex-col items-center gap-1 p-2 text-gray-600 dark:text-gray-300 hover:text-blue-500"
        aria-label="Undo"
      >
        <span className="text-xl">↩</span>
        <span className="text-xs">Undo</span>
      </button>

      <button
        onClick={onErase}
        className="flex flex-col items-center gap-1 p-2 text-gray-600 dark:text-gray-300 hover:text-blue-500"
        aria-label="Erase"
      >
        <span className="text-xl">⌫</span>
        <span className="text-xs">Erase</span>
      </button>

      <button
        onClick={onToggleLightning}
        className={`flex flex-col items-center gap-1 p-2 ${
          lightningMode ? "text-yellow-400" : "text-gray-600 dark:text-gray-300 hover:text-yellow-400"
        }`}
        aria-label="Lightning mode"
      >
        <span className="text-xl">⚡</span>
        <span className="text-xs">Lightning</span>
      </button>
    </div>
  );
}
