interface TimerProps {
  seconds: number;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function Timer({ seconds }: TimerProps) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <div className="text-xl font-mono tabular-nums text-gray-400 dark:text-gray-500">
      {pad(m)}:{pad(s)}
    </div>
  );
}
