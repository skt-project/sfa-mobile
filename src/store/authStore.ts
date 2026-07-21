import { create } from "zustand";
import { login as apiLogin, logout as apiLogout, getMe } from "../api/auth";
import { clearToken, getStoredToken } from "../api/client";
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
      if (token) {
        const user = await getMe();
        set({ user, isAuthenticated: true });
      }
    } catch (e) {
      // Offline-first: only a 401 means the stored token is truly invalid (and the
      // API client's interceptor has already cleared it). A network error just
      // means we're offline — keep the token so the session survives once
      // connectivity returns, instead of stranding a field user at a login screen
      // they cannot submit while offline.
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) await clearToken();
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
