interface Props {
  n: number | null;
}

export function Countdown({ n }: Props) {
  if (n === null) return null;

  return (
    <div className="fixed inset-0 bg-zinc-900/90 flex items-center justify-center z-50">
      <div className="text-center">
        <p className="text-8xl font-bold text-white">
          {n === 0 ? "GO!" : n}
        </p>
      </div>
    </div>
  );
}
