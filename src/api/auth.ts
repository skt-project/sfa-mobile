import { getApiClient, saveToken, clearToken } from "./client";
import type { User } from "../types";

export interface LoginResponse {
  access_token: string;
  user: User;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const r = await getApiClient().post<LoginResponse>("/auth/login", { username, password });
  await saveToken(r.data.access_token);
  return r.data;
}

export async function logout(): Promise<void> {
  await clearToken();
}

export async function getMe(): Promise<User> {
  const r = await getApiClient().get<User>("/auth/me");
  return r.data;
}
