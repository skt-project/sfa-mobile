import axios, { AxiosInstance } from "axios";
import { Platform } from "react-native";

export const BASE_URL = "https://step-api-141828905128.asia-southeast1.run.app/api/v1";
const TOKEN_KEY = "sfa_jwt";

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
        _onUnauthorized?.();
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
