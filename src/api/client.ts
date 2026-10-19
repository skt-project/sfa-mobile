import axios, { AxiosInstance } from "axios";
import { Platform } from "react-native";

// Defaults to the production Cloud Run API. A staging/QA build can override it by
// setting EXPO_PUBLIC_API_BASE_URL (inlined at build time; must be dot-accessed).
// The API host is public, not a secret, so EXPO_PUBLIC_ is appropriate here.
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://step-api-141828905128.asia-southeast1.run.app/api/v1";
const TOKEN_KEY = "sfa_jwt";
const USER_KEY = "sfa_user";

let _axiosInstance: AxiosInstance | null = null;
let _onUnauthorized: (() => void) | null = null;

/** Register a callback invoked when the server returns 401 (expired/invalid token). */
export function setUnauthorizedHandler(handler: () => void): void {
  _onUnauthorized = handler;
}

// Web-compatible token storage (SecureStore not available on web)
async function _getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  }
  const { getItemAsync } = await import("expo-secure-store");
  return getItemAsync(TOKEN_KEY);
}

async function _saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  const { setItemAsync } = await import("expo-secure-store");
  await setItemAsync(TOKEN_KEY, token);
}

async function _clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  const { deleteItemAsync } = await import("expo-secure-store");
  await deleteItemAsync(TOKEN_KEY);
}

// Cached user profile — lets an OFFLINE app relaunch restore the session instead
// of stranding a field user at a login screen they can't submit (E2E-25).
export async function saveUser(user: unknown): Promise<void> {
  const raw = JSON.stringify(user);
  if (Platform.OS === "web") {
    localStorage.setItem(USER_KEY, raw);
    return;
  }
  const { setItemAsync } = await import("expo-secure-store");
  await setItemAsync(USER_KEY, raw);
}

export async function getStoredUser<T = unknown>(): Promise<T | null> {
  let raw: string | null;
  if (Platform.OS === "web") {
    raw = localStorage.getItem(USER_KEY);
  } else {
    const { getItemAsync } = await import("expo-secure-store");
    raw = await getItemAsync(USER_KEY);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function clearUser(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(USER_KEY);
    return;
  }
  const { deleteItemAsync } = await import("expo-secure-store");
  await deleteItemAsync(USER_KEY);
}

export function getApiClient(): AxiosInstance {
  if (_axiosInstance) return _axiosInstance;

  _axiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
    headers: { "Content-Type": "application/json" },
  });

  _axiosInstance.interceptors.request.use(async (config) => {
    const token = await _getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  _axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        await _clearToken();
        await clearUser();
        _onUnauthorized?.();
        return Promise.reject(error);
      }
      // E2E-27: retry idempotent GETs once on a transient network error before
      // giving up. Writes are NOT retried here — the offline sync engine owns
      // write retries, and a blind POST retry could double-apply.
      const cfg = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
      const isNetwork =
        !error.response &&
        (error?.code === "ECONNABORTED" || error?.code === "ERR_NETWORK" || !error?.code);
      const method = (cfg?.method ?? "get").toLowerCase();
      if (isNetwork && method === "get" && cfg && !cfg._retried) {
        cfg._retried = true;
        await new Promise((r) => setTimeout(r, 800));
        return _axiosInstance!(cfg);
      }
      return Promise.reject(error);
    },
  );

  return _axiosInstance;
}

export async function saveToken(token: string): Promise<void> {
  await _saveToken(token);
}

export async function clearToken(): Promise<void> {
  await _clearToken();
}

export async function getStoredToken(): Promise<string | null> {
  return _getToken();
}
