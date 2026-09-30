import { z } from "zod";
import { messages } from "@/lib/forms/messages";

export const DEAL_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const dealCreateSchema = z.object({
  title: z.string().trim().min(1, messages.enter("a deal title")),
  customerId: z.string().min(1, messages.choose("a customer")),
  value: z
    .string()
    .trim()
    .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 0), "Enter an amount of 0 or more"),
  expectedCloseAt: z.string(),
  ownerUserId: z.string(),
  pipelineId: z.string(),
  stageId: z.string(),
  priority: z.enum(DEAL_PRIORITIES),
  source: z.string().trim(),
  notes: z.string(),
});

export type DealCreateInput = z.input<typeof dealCreateSchema>;
export type DealCreateValues = z.output<typeof dealCreateSchema>;
