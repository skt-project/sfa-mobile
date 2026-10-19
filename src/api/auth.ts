import { getApiClient, saveToken, clearToken, saveUser, clearUser } from "./client";
import type { User } from "../types";

export interface LoginResponse {
  access_token: string;
  user: User;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const r = await getApiClient().post<LoginResponse>("/auth/login", { username, password });
  await saveToken(r.data.access_token);
  try {
    await saveUser(r.data.user); // cache for offline relaunch (E2E-25) — best-effort, never block login
  } catch {
    /* storage hiccup must not fail the login */
  }
  return r.data;
}

export async function logout(): Promise<void> {
  // E2E-14: tell the server to revoke this session (best-effort — offline or a
  // pre-migration backend just no-ops), then clear the local token + user cache.
  try {
    await getApiClient().post("/auth/logout");
  } catch {
    /* best-effort: offline / endpoint unavailable */
  }
  await clearToken();
  await clearUser();
}

export async function getMe(): Promise<User> {
  const r = await getApiClient().get<User>("/auth/me");
  return r.data;
}
