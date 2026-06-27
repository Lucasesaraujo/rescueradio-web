import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore, userStore } from "./api";
import { normalizeProfile, type RescueProfile, type RescueUser, type Role } from "./rescueradio";

export type { Role };
export type User = RescueUser;
export type Profile = RescueProfile;

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    display_name: string,
    invite_code: string,
  ) => Promise<void>;
  bootstrapAdmin: (
    username: string,
    password: string,
    display_name: string,
    bootstrap_key: string,
  ) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function isProfileComplete(p: Profile | null): boolean {
  if (!p) return false;
  if (typeof p.complete === "boolean") return p.complete;
  return Boolean(
    (p.full_name || p.operational_name || p.nome_operacional) &&
    String(p.full_name || p.operational_name || p.nome_operacional)
      .trim()
      .split(/\s+/).length >= 2 &&
    p.base_id,
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => userStore.get<User>());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    const token = tokenStore.get();
    if (!token) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
      userStore.set(me);
      try {
        const prof = await api<Profile | { profile?: Profile | null; complete?: boolean }>(
          "/profiles/me",
        );
        setProfile(normalizeProfile(prof));
      } catch {
        setProfile(null);
      }
    } catch {
      tokenStore.clear();
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (username: string, password: string) => {
    const res = await api<{ access_token?: string; token?: string; user?: User }>("/auth/login", {
      method: "POST",
      json: { username, password },
    });
    const token = res.access_token || res.token;
    if (!token) throw new Error("Token ausente na resposta");
    tokenStore.set(token);
    await bootstrap();
  };

  const register = async (
    username: string,
    password: string,
    display_name: string,
    invite_code: string,
  ) => {
    await api("/auth/register", {
      method: "POST",
      json: { username, password, display_name, invite_code },
    });
    await login(username, password);
  };

  const bootstrapAdmin = async (
    username: string,
    password: string,
    display_name: string,
    bootstrap_key: string,
  ) => {
    await api("/auth/bootstrap-admin", {
      method: "POST",
      json: { username, password, display_name, bootstrap_key },
    });
    await login(username, password);
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
      userStore.set(me);
      const prof = await api<Profile | { profile?: Profile | null; complete?: boolean }>(
        "/profiles/me",
      );
      setProfile(normalizeProfile(prof));
    } catch {
      setProfile(null);
    }
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        profile,
        loading,
        bootstrap,
        login,
        register,
        bootstrapAdmin,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
