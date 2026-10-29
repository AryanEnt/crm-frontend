import type { SessionUser } from "@/features/auth/types";

/** SE may attach lead screenshots; TL/admin use documents:create. */
export function canAttachLeadScreenshot(
  can: (code: string) => boolean,
  user: SessionUser | null | undefined,
): boolean {
  if (can("documents:create")) return true;
  return user?.roleCode === "sales_executive";
}
