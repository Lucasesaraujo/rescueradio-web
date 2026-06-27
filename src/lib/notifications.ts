import { tokenStore, WS_BASE } from "./api";

export interface OperationAssignedEvent {
  type: "OPERATION_ASSIGNED";
  operation_id: string;
  channel_id: string;
  title: string;
  priority?: string;
  base_id?: string;
  assigned_by?: string;
  created_at?: string;
}

export type NotificationEvent =
  | OperationAssignedEvent
  | { type: "NOTIFICATIONS_CONNECTED"; username?: string }
  | { type: string; [key: string]: any };

export type NotificationStatus = "connecting" | "connected" | "disconnected" | "error";

export interface NotificationConnection {
  close: () => void;
}

export function connectNotifications(
  onEvent: (event: NotificationEvent) => void,
  onStatus?: (status: NotificationStatus) => void,
): NotificationConnection {
  const token = tokenStore.get();
  if (!token || typeof WebSocket === "undefined") {
    onStatus?.("disconnected");
    return { close: () => undefined };
  }

  let closed = false;
  let reconnectTimer: number | undefined;
  let attempts = 0;
  let socket: WebSocket | null = null;

  const connect = () => {
    if (closed) return;
    onStatus?.("connecting");
    const url = `${WS_BASE.replace(/\/$/, "")}/ws/notifications?token=${encodeURIComponent(token)}`;
    socket = new WebSocket(url);
    socket.onopen = () => {
      attempts = 0;
      onStatus?.("connected");
    };
    socket.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data));
      } catch {
        onEvent({ type: "UNKNOWN_NOTIFICATION", raw: message.data });
      }
    };
    socket.onerror = () => onStatus?.("error");
    socket.onclose = () => {
      socket = null;
      if (closed) return;
      onStatus?.("disconnected");
      attempts += 1;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5));
      reconnectTimer = window.setTimeout(connect, delay);
    };
  };

  connect();

  return {
    close: () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    },
  };
}
