"use client";

import { useHealth } from "@/hooks/use-health";
import { env } from "@/lib/env";
import { ApiError } from "@/types/api";
import { Button } from "@/components/ui/button";

/**
 * Development-only system status panel verifying frontend ↔ backend connectivity.
 */
export function SystemStatus() {
  const { data, error, isLoading, isFetching, refetch, isSuccess } = useHealth(
    env.isDevelopment,
  );

  if (!env.isDevelopment) {
    return null;
  }

  const errorMessage =
    error instanceof ApiError
      ? `${error.message} (${error.code})`
      : error instanceof Error
        ? error.message
        : null;

  return (
    <section className="mt-10 w-full max-w-xl rounded-xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900 uppercase">
            System status
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Development connectivity check against the Go API.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Checking…" : "Refresh"}
        </Button>
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">API URL</dt>
        <dd className="font-mono text-zinc-800">{env.apiBaseUrl}</dd>

        <dt className="text-zinc-500">Backend</dt>
        <dd>
          {isLoading ? (
            <span className="text-zinc-400">Checking…</span>
          ) : isSuccess && data ? (
            <span className="inline-flex items-center gap-2 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Connected ({data.status})
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Unreachable
            </span>
          )}
        </dd>

        {data ? (
          <>
            <dt className="text-zinc-500">Version</dt>
            <dd className="font-mono text-zinc-800">{data.version}</dd>

            <dt className="text-zinc-500">Uptime</dt>
            <dd className="font-mono text-zinc-800">{data.uptime}</dd>

            <dt className="text-zinc-500">Database</dt>
            <dd className="font-mono text-zinc-800">
              {data.checks.database ?? "unknown"}
            </dd>
          </>
        ) : null}

        {errorMessage ? (
          <>
            <dt className="text-zinc-500">Error</dt>
            <dd className="text-red-700">{errorMessage}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
