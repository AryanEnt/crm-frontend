"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ApiError } from "@/types/api";
import { copy } from "@/lib/copy";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      suppressErrorToast?: boolean;
    };
  }
}

type Props = {
  children: ReactNode;
};

function mutationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "network_error") return copy.error.network;
    if (error.message && error.message !== "Request failed") return error.message;
  }
  if (error instanceof Error && error.message) {
    if (error.message.toLowerCase().includes("network")) return copy.error.network;
    return error.message;
  }
  return copy.error.generic;
}

export function QueryProvider({ children }: Props) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) => {
            if (mutation.meta?.suppressErrorToast) return;
            // Feature mutations that define onError already surface feedback
            if (mutation.options.onError) return;
            toast.error(mutationErrorMessage(error));
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
