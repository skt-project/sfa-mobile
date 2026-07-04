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
    } catch {
      await clearToken();
    } finally {
      set({ isLoading: false });
    }
  },
}));
