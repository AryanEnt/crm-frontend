"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSession, login as loginRequest, logout as logoutRequest } from "@/lib/api/auth";
import type { SessionUser } from "@/features/auth/types";
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from "@/lib/permissions";
import { ApiError } from "@/types/api";

export const sessionQueryKey = ["auth", "session"] as const;

type AuthContextValue = {
  user: SessionUser | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: sessionQueryKey,
    queryFn: getSession,
    retry: false,
    staleTime: 60_000,
  });

  const user = sessionQuery.isError ? null : (sessionQuery.data ?? null);

  const value = React.useMemo<AuthContextValue>(() => {
    const permissions = user?.permissions ?? [];
    return {
      user,
      permissions,
      isLoading: sessionQuery.isLoading,
      isAuthenticated: !!user,
      login: async (email, password) => {
        const result = await loginRequest(email, password);
        queryClient.setQueryData(sessionQueryKey, result.user);
        return result.user;
      },
      logout: async () => {
        try {
          await logoutRequest();
        } finally {
          queryClient.setQueryData(sessionQueryKey, null);
          queryClient.clear();
        }
      },
      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      },
      can: (permission) => hasPermission(permissions, permission),
      canAny: (codes) => hasAnyPermission(permissions, codes),
      canAll: (codes) => hasAllPermissions(permissions, codes),
    };
  }, [user, sessionQuery.isLoading, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function usePermission(code: string) {
  const { can, isLoading } = useAuth();
  return { allowed: can(code), isLoading };
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
