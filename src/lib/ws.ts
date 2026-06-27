import { WS_BASE, tokenStore } from "./api";

export type WSEvent =
  | { type: "CONNECTED"; [k: string]: any }
  | { type: "BRIEFING"; messages: any[]; [k: string]: any }
  | { type: "MESSAGE_RECEIVED"; payload: any; [k: string]: any }
  | { type: "MEMBER_JOINED"; member?: any; [k: string]: any }
  | { type: "MEMBER_LEFT"; member?: any; [k: string]: any }
  | { type: "ERROR"; error?: string; [k: string]: any }
  | { type: string; [k: string]: any };

export type WSStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error" | "closed";

export interface ChatClient {
  status: () => WSStatus;
  send: (text: string) => void;
  close: () => void;
}

export function connectChannel(
  channelId: string,
  onEvent: (ev: WSEvent) => void,
  onStatus: (s: WSStatus) => void,
): ChatClient {
  let ws: WebSocket | null = null;
  let closedByUser = false;
  let retry = 0;
  let status: WSStatus = "idle";

  const setStatus = (s: WSStatus) => {
    status = s;
    onStatus(s);
  };

  const open = () => {
    const token = tokenStore.get() || "";
    setStatus(retry === 0 ? "connecting" : "reconnecting");
    const url = `${WS_BASE}/ws/channel/${encodeURIComponent(channelId)}?token=${encodeURIComponent(token)}`;
    try {
      ws = new WebSocket(url);
    } catch {
      setStatus("error");
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      retry = 0;
      setStatus("connected");
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent(data);
      } catch {
        onEvent({ type: "MESSAGE_RECEIVED", payload: { text: String(e.data) } });
      }
    };
    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      if (closedByUser) {
        setStatus("closed");
        return;
      }
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    retry += 1;
    const delay = Math.min(1000 * 2 ** retry, 10000);
    setStatus("reconnecting");
    setTimeout(() => {
      if (!closedByUser) open();
    }, delay);
  };

  open();

  return {
    status: () => status,
    send: (text: string) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "SEND_MESSAGE",
            usuario: "",
            timestamp_iso: new Date().toISOString(),
            corpo_texto: text,
          }),
        );
      }
    },
    close: () => {
      closedByUser = true;
      ws?.close();
    },
  };
}
