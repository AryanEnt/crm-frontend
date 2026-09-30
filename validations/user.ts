import { z } from "zod";
import { messages } from "@/lib/forms/messages";
import { PASSWORD_MIN_LENGTH, newPasswordSchema } from "./common";

const teamMemberFields = {
  firstName: z.string().trim().min(1, messages.enter("a first name")).max(100, messages.maxLength(100)),
  lastName: z.string().trim().max(100, messages.maxLength(100)),
  email: z.string().trim().min(1, messages.enter("an email address")).email(messages.email),
  phone: z.string().trim().max(40, messages.maxLength(40)),
};

/** Team Lead adding a Sales Executive: role and team are fixed by the server, never sent from here. */
export const teamMemberCreateSchema = z.object({
  ...teamMemberFields,
  password: newPasswordSchema,
});

/** Blank password keeps the current one. */
export const teamMemberEditSchema = z.object({
  ...teamMemberFields,
  password: z.union([
    z.literal(""),
    z.string().min(PASSWORD_MIN_LENGTH, messages.minLength(PASSWORD_MIN_LENGTH)),
  ]),
});

export type TeamMemberInput = z.input<typeof teamMemberCreateSchema>;
export type TeamMemberValues = z.output<typeof teamMemberCreateSchema>;
