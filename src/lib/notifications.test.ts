import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStore } from "./api";
import { connectNotifications } from "./notifications";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
    this.onclose?.();
  }
}

describe("connectNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as any);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens authenticated websocket and emits parsed events", () => {
    tokenStore.set("jwt-token");
    const onEvent = vi.fn();
    const onStatus = vi.fn();
    const connection = connectNotifications(onEvent, onStatus);
    const socket = FakeWebSocket.instances[0];

    expect(socket.url).toContain("/ws/notifications?token=jwt-token");
    socket.onopen?.();
    socket.onmessage?.({
      data: JSON.stringify({ type: "OPERATION_ASSIGNED", operation_id: "op-1" }),
    });

    expect(onStatus).toHaveBeenCalledWith("connected");
    expect(onEvent).toHaveBeenCalledWith({ type: "OPERATION_ASSIGNED", operation_id: "op-1" });
    connection.close();
    expect(socket.closed).toBe(true);
  });

  it("does not connect without a token", () => {
    const onStatus = vi.fn();
    connectNotifications(vi.fn(), onStatus);
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(onStatus).toHaveBeenCalledWith("disconnected");
  });
});
