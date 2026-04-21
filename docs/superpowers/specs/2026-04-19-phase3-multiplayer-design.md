# Phase 3: Multiplayer — Design Spec

**Date:** 2026-04-19
**Status:** Approved

---

## Context

Phase 2 delivered player registration and a leaderboard. The solo game is fully playable. Phase 3 adds two-player real-time battles: two players join a shared room, get the same puzzle (same seed), and race to finish. First to complete wins. Leaderboard wins/played counters update after each battle.

---

## Architecture

### WebSocket Strategy: Thin Relay

The server is a dumb message router. During a game it maintains no game state — it only relays messages between the two connected clients. Room metadata is stored in Firestore (`rooms/{room_id}`). In-game progress updates flow only over WebSocket (not persisted). Final results are written to Firestore after the game ends.

This keeps server logic minimal, tests fast, and avoids stale in-memory state across Cloud Run restarts.

### Room Storage: Firestore

```
rooms/{room_id} → {
  host: string,
  guest: string | null,
  difficulty: Difficulty,
  seed: number,
  status: "WAITING" | "PLAYING" | "FINISHED",
  winner: string | null,       ← set on first SUBMIT_RESULT; acts as idempotency guard
  created_at: timestamp
}
```

Rooms are ephemeral — deleted after results are delivered, or auto-deleted by Firestore TTL on the `expires_at` field when inactive.

```
rooms/{room_id} → {
  ...
  expires_at: timestamp,   ← refreshed on each HEARTBEAT; Firestore TTL deletes when past
}
```

Initial `expires_at` = `now + 2 minutes`. Reset to `now + 2 minutes` on each `HEARTBEAT` received from either connected player. Firestore TTL policy must be configured on the `rooms` collection using the `expires_at` field.

### Room ID Format

6-character alphanumeric uppercase (e.g. `K7X2AB`). Generated server-side using `''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))`. Regenerate on collision (Firestore `create` with `exists=False` check).

### Challenge Storage: Firestore

```
challenges/{challenge_id} → {
  from_player: string,
  to_player: string,
  room_id: string,
  status: "PENDING" | "ACCEPTED" | "DECLINED",
  created_at: timestamp
}
```

Challenges also have an `expires_at` field set to `now + 10 minutes` at creation. Firestore TTL auto-deletes stale challenges. `get_pending_for` still filters `created_at > now - 10 min` as a belt-and-suspenders guard during the TTL propagation window (Firestore TTL deletion is eventually consistent, not instantaneous).

### Leaderboard Updates: Lazy

Results screen is shown immediately when `GAME_RESULTS` arrives via WebSocket. Leaderboard (`wins`/`played`) is updated in a background asyncio task after results are delivered — not blocking result delivery.

---

## WebSocket Authentication

**Intentional decision: Phase 3 uses name-only identity, no PIN auth.**

On WS connect, the server validates only that the player name exists in Firestore (`players/{name}`). There is no token or PIN check. This is a known limitation — any client can impersonate a player by passing their name. PIN auth is deferred to a future phase. Engineers should not add auth beyond the name-exists check.

---

## Room Lifecycle

```
WAITING → PLAYING → FINISHED → (deleted)
```

| Transition | Trigger |
|------------|---------|
| `WAITING` → `PLAYING` | Countdown completes (server sends `COUNTDOWN { n: 0 }` = GO) |
| `PLAYING` → `FINISHED` | First valid `SUBMIT_RESULT` received; server sets `winner` field in Firestore |
| `FINISHED` → deleted | After server sends `GAME_RESULTS` to all currently connected clients |

### Countdown Trigger

Countdown starts **automatically when the guest's WebSocket connects** and both host and guest connections are registered server-side. The server fires `COUNTDOWN { n: 3 }`, `{ n: 2 }`, `{ n: 1 }`, `{ n: 0 }` with 1-second delays using `asyncio.sleep`. The room status moves to `PLAYING` after `n: 0` is sent.

---

## WebSocket Protocol

**Endpoint:** `WS /ws/room/{room_id}?name={player_name}`

### Client → Server

| Message | Payload | When |
|---------|---------|------|
| `HEARTBEAT` | `{}` | Every 30 seconds while connected |
| `PROGRESS` | `{ cells_filled: number }` | On each cell fill (throttled: max 1 per 500ms client-side) |
| `SUBMIT_RESULT` | `{ time_ms: number }` | When puzzle is solved and validated client-side |

### Server → Client

| Message | Payload | When |
|---------|---------|------|
| `ROOM_STATE` | `{ room_id, host, guest, difficulty, seed, status }` | On connect; on guest join (sent to host) |
| `COUNTDOWN` | `{ n: number }` | n = 3, 2, 1, 0 with 1s intervals |
| `OPPONENT_PROGRESS` | `{ cells_filled: number }` | Relayed from opponent's `PROGRESS` message |
| `GAME_RESULTS` | `{ winner: string, winner_time_ms: number, loser_time_ms: number \| null }` | Sent to both clients when first player submits. `loser_time_ms` is `null` — the loser did not finish. |
| `ERROR` | `{ code: string, message: string }` | See error codes below |

### Error Codes

| Code | Cause |
|------|-------|
| `PLAYER_NOT_FOUND` | Player name not in Firestore on WS connect |
| `ROOM_NOT_FOUND` | Room ID not in Firestore on WS connect |
| `ROOM_FULL` | Room already has host and guest; third connection rejected |
| `ROOM_FINISHED` | Attempt to connect to a `FINISHED` room |
| `ROOM_IN_PROGRESS` | Room status is `PLAYING`; new connections rejected |
| `WRONG_PLAYER` | Player is neither the host nor eligible to join as guest (room already has a different guest) |

After sending `ERROR`, the server closes the WebSocket connection.

### Race Condition: Simultaneous SUBMIT_RESULT

If both players submit simultaneously, winner is determined by **first message received** (asyncio message processing is sequential). The server checks the `winner` field in Firestore before processing: if `winner` is already set, the second `SUBMIT_RESULT` is silently ignored. This check must use a Firestore transaction to prevent TOCTOU bugs.

### Heartbeat & Disconnect Handling

**Client → Server:** `HEARTBEAT` message sent every 30 seconds while a WebSocket connection is open (both in WAITING and PLAYING states). No payload.

**Server behavior on HEARTBEAT:** Update `expires_at = now + 2 minutes` in Firestore. Reset the in-memory last-heartbeat timestamp for that connection.

**Inactivity timeout:** If the server receives no `HEARTBEAT` from a player for **90 seconds** (3 missed beats), that player is considered disconnected:

| Room status | Action |
|-------------|--------|
| `WAITING` | Close the stale WebSocket. Room expires naturally via Firestore TTL. No immediate cleanup needed (no opponent to notify). |
| `PLAYING` | Send `OPPONENT_DISCONNECTED {}` to the remaining player. Declare the remaining player winner with `winner_time_ms = elapsed_ms_since_start`, `loser_time_ms = null`. Send `GAME_RESULTS` to remaining player. Update leaderboard (background task). Delete room. |

**No reconnect.** A player who disconnects and reconnects is treated as a new connection and will receive `ROOM_IN_PROGRESS` or `ROOM_NOT_FOUND` (if the room was already cleaned up). Reconnect logic is out of scope.

### Server → Client (additional message)

| Message | Payload | When |
|---------|---------|------|
| `OPPONENT_DISCONNECTED` | `{}` | Opponent missed 3 heartbeats; sent before GAME_RESULTS |

---

## Seed Distribution

The host receives `seed` and `difficulty` in the `POST /api/v1/rooms` response and uses them immediately to render the puzzle in `WaitingRoom`. The guest receives seed and difficulty from `POST /api/v1/challenges/{id}/accept` (challenge flow) or `GET /api/v1/rooms/{room_id}` (code join flow) before connecting via WebSocket. `ROOM_STATE` also includes seed and difficulty as a redundant delivery — clients should use whichever they received first. The frontend puzzle generator is deterministic — same seed + difficulty = identical puzzle for both players. No puzzle data is stored server-side.

---

## Backend

### New Files

**`app/models/room.py`**
- `RoomStatus` enum: `WAITING`, `PLAYING`, `FINISHED`
- `Room` dataclass: `room_id`, `host`, `guest`, `difficulty`, `seed`, `status`, `winner`, `created_at`

**`app/models/challenge.py`**
- `ChallengeStatus` enum: `PENDING`, `ACCEPTED`, `DECLINED`
- `Challenge` dataclass: `challenge_id`, `from_player`, `to_player`, `room_id`, `status`, `created_at`

**`app/repositories/room_repo.py`**
- `create(room)` — Firestore `create` with `exists=False`; raises on collision
- `get(room_id) → Room | None`
- `update_status(room_id, status)`
- `set_guest(room_id, guest)`
- `set_winner(room_id, winner)` — Firestore transaction; returns `False` if winner already set (idempotency guard)
- `refresh_ttl(room_id)` — updates `expires_at = now + 2 minutes`
- `delete(room_id)`

**`app/repositories/challenge_repo.py`**
- `create(challenge)`
- `get_pending_for(player_name) → list[Challenge]` — filters `status=PENDING` and `created_at > now - 10 min`
- `update_status(challenge_id, status)`

**`app/api/v1/rooms.py`**
- `POST /api/v1/rooms` — body: `{ difficulty, player_name }`; creates room with host=player_name, seed=random; returns `{ room_id, seed, difficulty }`
- `GET /api/v1/rooms/{room_id}` — returns room status (used by guest to validate room before WS connect)

**`app/api/v1/challenges.py`**
- `POST /api/v1/challenges` — body: `{ from_player, to_player, difficulty }`; validates both players exist in Firestore (returns 404 if either missing); creates room + challenge atomically; returns `{ challenge_id, room_id }`
- `GET /api/v1/players/{name}/challenges` — returns pending challenges (last 10 min)
- `POST /api/v1/challenges/{id}/accept` — updates challenge status to `ACCEPTED`; returns `{ room_id, seed, difficulty }`
- `POST /api/v1/challenges/{id}/decline` — updates challenge status to `DECLINED`

**`app/ws/room_handler.py`**
- WebSocket endpoint `WS /ws/room/{room_id}?name={player_name}`
- On connect (checks in this order): (1) player exists in Firestore — else `PLAYER_NOT_FOUND`; (2) room exists — else `ROOM_NOT_FOUND`; (3) room status is `FINISHED` — `ROOM_FINISHED`; (4) room status is `PLAYING` — `ROOM_IN_PROGRESS`; (5) host+guest slots both filled by different players — `ROOM_FULL`; (6) player is neither host nor eligible guest — `WRONG_PLAYER`; register connection
- Sends `ROOM_STATE` to connecting client; sends `ROOM_STATE` to host when guest connects
- When both connections registered: start countdown coroutine (`asyncio.sleep(1)` per tick)
- After countdown: update room status to `PLAYING`
- Relay `PROGRESS` from one client to the other as `OPPONENT_PROGRESS`
- On `HEARTBEAT`: call `room_repo.refresh_ttl(room_id)`; reset in-memory last-heartbeat timestamp for this connection
- Server runs a background task per connection checking last-heartbeat every 30s; on 90s timeout: handle per Heartbeat & Disconnect rules above
- On `SUBMIT_RESULT`: silently ignore if room status is not `PLAYING`; otherwise call `room_repo.set_winner` (transaction); if this client is first, send `GAME_RESULTS` to both, schedule background leaderboard update, delete room; if second (winner already set), ignore

**Background leaderboard update (in `room_handler.py`):**
After `GAME_RESULTS` is sent: use Firestore `increment` to add 1 to `played` for both players and 1 to `wins` for winner. Runs as `asyncio.create_task`. Log failures; no retry in Phase 3.

### Waiting Room Cancel

When host cancels from `WaitingRoom`:
- Call `DELETE /api/v1/rooms/{room_id}` — deletes the room from Firestore
- If room was created via challenge: also call `POST /api/v1/challenges/{id}/decline`
- Frontend navigates back to lobby

**`app/api/v1/rooms.py`** adds:
- `DELETE /api/v1/rooms/{room_id}` — body: `{ player_name }`; deletes room only if `player_name` matches `host` and status is `WAITING`; returns 403 otherwise

---

## Frontend

### New Files

**`src/services/ws.ts`**
- Typed WebSocket client (no auto-reconnect — see disconnect policy above)
- Parses incoming JSON to typed message union
- Exposes `send(message)`, `close()`, `onMessage(handler)`
- Sends `HEARTBEAT` automatically every 30s via `setInterval`; cleared on `close()`

**`src/viewmodels/useRoom.ts`**
- State: `room`, `countdown`, `opponentProgress`, `results`, `wsConnected`, `pendingChallenge`, `opponentDisconnected`
- Actions: `createRoom(difficulty)`, `joinRoom(roomId)`, `submitResult(timeMs)`, `acceptChallenge(challengeId)`, `declineChallenge(challengeId)`, `cancelRoom(roomId)`
- Challenge poll: starts when screen = `lobby`, stops when screen changes to anything else; interval = 3 seconds
- WebSocket: connected on entering `waiting` screen, disconnected on leaving `results`
- `PROGRESS` messages throttled client-side to 1 per 500ms

**`src/views/BattleMenu.tsx`**
- Dedicated screen replacing lobby when "Battle" is tapped
- Top half: scrollable player list (from `useAuth` knownPlayers), each row has "Challenge →" button
- Bottom half: room code input (6 chars, uppercase) + "Join" button
- Back button returns to lobby

**`src/views/WaitingRoom.tsx`**
- Shows room code in large monospace display (`text-4xl font-mono tracking-widest`)
- If room was created via challenge: shows "Challenge sent to [name]"
- Two player slots: host (filled with name + initials avatar), guest (waiting spinner + "Waiting for opponent…")
- Cancel button → calls `cancelRoom`, navigates to lobby

**`src/views/Countdown.tsx`**
- Full-screen overlay on top of the board: 3… 2… 1… GO!
- Driven by `COUNTDOWN` WebSocket messages received by `useRoom`
- `GO` displayed for 500ms then dismissed automatically

### Updated Files

**`src/views/GameScreen.tsx`**
- In battle mode (when `useRoom` state is active): add top strip with two progress bars
  - Your bar: `bg-blue-600` / label "You" / count `XX/81`
  - Opponent bar: `bg-emerald-500` / label `[opponent name]` / count `XX/81`
  - Strip background: `bg-zinc-800 border-b border-zinc-700`
  - Updated on each `OPPONENT_PROGRESS` message
- Solo mode: top strip hidden, no changes to existing solo flow

**`src/views/ResultsScreen.tsx`**
- Battle mode (when `results` present in `useRoom`):
  - Winner view: `👑` emoji, "You won!" heading (`text-white`), winner row `bg-blue-600`
  - Loser view: `😤` emoji, "You lost" heading (`text-zinc-400`), your row has `border border-zinc-600` to identify self; winner row listed first
  - Both times shown in `font-mono`
  - Buttons: "Scores" (`bg-zinc-800`) and "Play Again" (`bg-blue-600`) — navigates to lobby, not a direct rematch
- Solo mode: unchanged

**`src/views/Lobby.tsx`**
- Battle button navigates to `BattleMenu` screen (was previously disabled)
- If `pendingChallenge` in `useRoom` state: show banner "⚔️ [Name] challenged you!" with Accept / Decline buttons

**`src/App.tsx`**
- Extended state machine:
  ```
  login → lobby → battle-menu → waiting → countdown → game → results → lobby
                ↘ game (solo) → results → lobby
  ```

---

## UI Design

### Color Palette

No new colors introduced beyond the existing zinc/blue scheme, except:
- **Opponent bar only:** `emerald-500` — one addition to distinguish opponent from player

### Battle Game Screen Layout (top → bottom)

1. **Top strip** (`bg-zinc-800 border-b border-zinc-700`): two progress bars
2. **Timer**: centered, `text-2xl font-normal tabular-nums`
3. **Board**: unchanged from solo — `font-normal` throughout, no bold on cells
4. **Action bar**: Undo, Erase, Lightning toggle
5. **Numpad**: 1–9 buttons with remaining count, `font-bold` (existing style)

### Deviation from GAME_SPEC.md

`GAME_SPEC.md` specifies an intermediate opponent finish toast ("⚡ [Name] finished in M:SS!") that appears while the other player is still playing. **Phase 3 does not implement this.** Instead, the battle ends immediately when the first player submits — both players see `GAME_RESULTS` simultaneously. There is no intermediate notification. This is a deliberate simplification; the toast behavior may be added in a future phase if both players solve independently.

---

## Verification

### Backend tests (`pytest`)

- Room creation returns valid 6-char `room_id` and seed
- Room creation with collision retries correctly
- Guest join sets `guest` field, triggers `ROOM_STATE` to host
- Countdown fires 3-2-1-0 with correct timing after guest connects
- Room status moves to `PLAYING` after countdown completes
- `SUBMIT_RESULT` from first player: sets winner, sends `GAME_RESULTS` to both, deletes room
- `SUBMIT_RESULT` from second player: silently ignored (winner already set)
- Simultaneous `SUBMIT_RESULT`: exactly one winner set (transaction test)
- Background leaderboard update: `wins` and `played` incremented correctly
- WS connect with unknown player → `PLAYER_NOT_FOUND` error + close
- WS connect with full room → `ROOM_FULL` error + close
- WS connect to finished room → `ROOM_FINISHED` error + close
- WS connect to in-progress room → `ROOM_IN_PROGRESS` error + close
- `SUBMIT_RESULT` while room status is WAITING → silently ignored
- Player A disconnects mid-game (no heartbeat 90s) → `OPPONENT_DISCONNECTED` sent to Player B → Player B receives `GAME_RESULTS` declaring them winner
- HEARTBEAT updates `expires_at` in Firestore
- Room with no heartbeats is cleaned up by Firestore TTL after 2 minutes
- Challenge create + get_pending_for + accept + decline flows
- Challenge older than 10 min excluded from `get_pending_for`
- `DELETE /api/v1/rooms/{room_id}` only works in WAITING status
- Cancel from waiting room deletes room + declines challenge

### Frontend tests (`vitest`)

- `useRoom`: createRoom → room state set, navigate to waiting
- `useRoom`: joinRoom → WS connects, ROOM_STATE received, room state set
- `useRoom`: COUNTDOWN messages update countdown state 3→2→1→0
- `useRoom`: OPPONENT_PROGRESS updates opponentProgress state
- `useRoom`: GAME_RESULTS updates results state, WS disconnects
- `useRoom`: challenge polling starts on lobby mount, stops on unmount
- `useRoom`: cancelRoom deletes room, clears state
- `BattleMenu`: renders player list, challenge button, 6-char code input
- `WaitingRoom`: shows room code, "Challenge sent to [name]" when applicable, cancel works
- `Countdown`: renders 3→2→1→GO sequence, auto-dismisses after GO
- `ResultsScreen`: battle mode winner/loser views render correctly
- `GameScreen`: battle mode shows top strip; solo mode does not

### Manual end-to-end

1. Open two browser tabs, log in as different players
2. **Challenge flow**: Tab A: Battle → Challenge Tab B's player → see waiting room with code
3. Tab B: lobby shows challenge banner → Accept → both see waiting room
4. Both tabs: 3-2-1-GO countdown → puzzle starts simultaneously
5. Tab A: fill a cell → Tab B's opponent bar updates
6. Tab A: complete puzzle → Tab A sees "You won 👑", Tab B sees "You lost 😤"
7. Both times shown correctly
8. Leaderboard: Tab A's wins +1, both players' played +1
9. **Code flow**: Tab A: Battle → create room (gets code) → Tab B: Battle → enter code → join → countdown → game
10. **Cancel**: Tab A in waiting room → Cancel → room deleted → Tab A back in lobby

---

## Out of Scope

- PIN authentication (deferred to future)
- Spectator mode
- Rematch shortcut (Play Again returns to lobby — new room must be created)
- WebSocket reconnect after disconnect (disconnected player receives ROOM_IN_PROGRESS or ROOM_NOT_FOUND on reconnect attempt)
- More than 2 players per room
- Abandoned room cleanup (rooms in WAITING with no guest after N minutes)
- Intermediate "opponent finished" toast while still solving (battle ends immediately on first completion)
