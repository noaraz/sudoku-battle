interface Props {
  fromPlayer: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function ChallengeNotification({ fromPlayer, onAccept, onDecline }: Props) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 flex items-center gap-3 shadow-lg">
        <span className="flex-1 text-sm text-white">
          ⚔️ <strong>{fromPlayer}</strong> challenged you!
        </span>
        <button
          onClick={onAccept}
          className="bg-blue-600 text-white text-xs px-3 py-1 rounded"
        >
          Accept
        </button>
        <button
          onClick={onDecline}
          className="bg-zinc-700 text-zinc-300 text-xs px-3 py-1 rounded"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
