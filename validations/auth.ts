import { z } from "zod";
import { messages } from "@/lib/forms/messages";

export const loginSchema = z.object({
  email: z.string().trim().min(1, messages.enter("your email address")).email("Enter a valid email address"),
  password: z.string().min(1, messages.enter("your password")),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
