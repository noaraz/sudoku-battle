import type { WsInMessage, WsOutMessage } from "../models";

type MessageHandler = (msg: WsInMessage) => void;

const WS_BASE =
  import.meta.env.VITE_WS_URL ??
  (window.location.protocol === "https:" ? "wss:" : "ws:") +
    "//" +
    window.location.host;

export class RoomWsClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private handlers: MessageHandler[] = [];
  private openHandlers: (() => void)[] = [];

  connect(roomId: string, playerName: string): void {
    const url = `${WS_BASE}/ws/room/${roomId}?name=${encodeURIComponent(playerName)}`;
    this.ws = new WebSocket(url);

    this.ws.addEventListener("open", () => {
      this.heartbeatTimer = setInterval(() => this.send({ type: "HEARTBEAT" }), 30_000);
      this.openHandlers.forEach((h) => h());
    });

    this.ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsInMessage;
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore malformed messages
      }
    });

    this.ws.addEventListener("close", () => this._clearHeartbeat());
  }

  send(msg: WsOutMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  onOpen(handler: () => void): void {
    this.openHandlers.push(handler);
  }

  close(): void {
    this._clearHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.handlers = [];
    this.openHandlers = [];
  }

  private _clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
