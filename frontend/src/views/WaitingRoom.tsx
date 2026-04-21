interface Props {
  roomId: string;
  host: string;
  guest: string | null;
  challengeSentTo: string | null;
  onCancel: () => void;
}

export function WaitingRoom({ roomId, host, guest, challengeSentTo, onCancel }: Props) {
  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xs text-center">
        <div className="text-4xl mb-2">⚔️</div>
        <h1 className="text-xl font-bold mb-1">Battle Room</h1>
        <p className="text-zinc-400 text-sm mb-6">Share the code with your opponent</p>

        <div className="bg-zinc-800 rounded-xl p-6 mb-4 border-2 border-dashed border-zinc-600">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">Room Code</p>
          <p className="text-4xl font-mono font-bold tracking-widest text-blue-400">{roomId}</p>
        </div>

        {challengeSentTo && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 mb-4 text-emerald-400 text-sm">
            Challenge sent to <strong>{challengeSentTo}</strong>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {host.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left flex-1">
              <p className="text-sm text-white">{host}</p>
              <p className="text-xs text-blue-400">Host</p>
            </div>
            <span className="text-emerald-400 text-xs">✓</span>
          </div>

          <div className="flex items-center gap-3 bg-zinc-900 border border-dashed border-zinc-700 rounded-lg p-3">
            {guest ? (
              <>
                <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold">
                  {guest.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-sm text-white flex-1">{guest}</p>
                <span className="text-emerald-400 text-xs">✓</span>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-lg">?</div>
                <p className="text-sm text-zinc-500">Waiting for opponent…</p>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onCancel}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg py-3 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
