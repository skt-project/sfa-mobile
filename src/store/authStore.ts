import { create } from "zustand";
import { login as apiLogin, logout as apiLogout, getMe } from "../api/auth";
import { clearToken, clearUser, getStoredToken, getStoredUser, saveUser } from "../api/client";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  rehydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (username, password) => {
    const { user } = await apiLogin(username, password);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await apiLogout();
    set({ user: null, isAuthenticated: false });
  },

  rehydrate: async () => {
    set({ isLoading: true });
    try {
      const token = await getStoredToken();
      if (!token) {
        set({ user: null, isAuthenticated: false });
        return;
      }
      try {
        const user = await getMe();
        try { await saveUser(user); } catch { /* refresh cache best-effort */ }
        set({ user, isAuthenticated: true });
      } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          // Token truly invalid/revoked — the interceptor already cleared it.
          await clearToken();
          await clearUser();
          set({ user: null, isAuthenticated: false });
        } else {
          // Offline (network error): restore the last known user from cache so the
          // field user keeps a working session instead of being stranded at a
          // login screen they can't submit while offline (E2E-25).
          const cached = await getStoredUser<User>();
          set(cached ? { user: cached, isAuthenticated: true } : { user: null, isAuthenticated: false });
        }
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
