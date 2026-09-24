import { api } from "@/lib/api/client";
import type { HealthStatus } from "@/types/api";

export function getHealth(signal?: AbortSignal) {
  return api.get<HealthStatus>("/health", { signal });
}
