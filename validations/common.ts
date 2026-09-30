import { z } from "zod";
import { messages } from "@/lib/forms/messages";

/**
 * Shared Zod schemas for forms and client-side validation.
 * Domain schemas are added as features are implemented.
 */

export const emailSchema = z.string().trim().email("Enter a valid email address");

export const nonEmptyStringSchema = z
  .string()
  .trim()
  .min(1, "This field is required");

/** Must match the backend rule (auth.ChangePassword and admin user create/update). */
export const PASSWORD_MIN_LENGTH = 8;

export const newPasswordSchema = z
  .string()
  .min(1, messages.enter("a new password"))
  .min(PASSWORD_MIN_LENGTH, messages.minLength(PASSWORD_MIN_LENGTH));
