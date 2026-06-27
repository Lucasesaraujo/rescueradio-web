declare global {
  interface Window {
    __RESCUERADIO_CONFIG__?: {
      gatewayHttpUrl?: string;
      gatewayWsUrl?: string;
    };
  }
}

function runtimeValue(key: "gatewayHttpUrl" | "gatewayWsUrl") {
  if (typeof window === "undefined") return "";
  const value = window.__RESCUERADIO_CONFIG__?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export const API_BASE =
  runtimeValue("gatewayHttpUrl") ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8001/api";

export const WS_BASE =
  runtimeValue("gatewayWsUrl") || import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";

const TOKEN_KEY = "rr_token";
const USER_KEY = "rr_user";

export const tokenStore = {
  get: () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const userStore = {
  get: <T = any>(): T | null => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  set: (u: unknown) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
};

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type Opts = RequestInit & { json?: unknown; query?: Record<string, any> };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { json, query, headers, ...rest } = opts;
  let url = `${API_BASE}${path}`;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const token = tokenStore.get();
  const h: Record<string, string> = {
    Accept: "application/json",
    ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((headers as Record<string, string>) || {}),
  };
  const res = await fetch(url, {
    ...rest,
    headers: h,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message || data.error)) || `Erro ${res.status}`;
    throw new ApiError(res.status, typeof msg === "string" ? msg : JSON.stringify(msg), data);
  }
  return data as T;
}
