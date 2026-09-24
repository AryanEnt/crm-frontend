import { api } from "@/lib/api/client";
import type { SessionUser } from "@/features/auth/types";

export function login(email: string, password: string) {
  return api.post<{ user: SessionUser }>("/api/auth/login", { email, password }, {
    baseUrl: "",
  });
}

export function logout() {
  return api.post<{ loggedOut: boolean }>("/api/auth/logout", undefined, {
    baseUrl: "",
  });
}

export function getSession() {
  return api.get<SessionUser>("/api/auth/me", { baseUrl: "" });
}
