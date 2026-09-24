import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/lib/api/health";

export const healthQueryKey = ["health"] as const;

export function useHealth(enabled = true) {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: ({ signal }) => getHealth(signal),
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });
}
