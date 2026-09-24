import { z } from "zod";

/**
 * Shared Zod schemas for forms and client-side validation.
 * Domain schemas are added as features are implemented.
 */

export const emailSchema = z.string().trim().email("Enter a valid email address");

export const nonEmptyStringSchema = z
  .string()
  .trim()
  .min(1, "This field is required");
