import { z } from "zod";

export const evidenceAnalysisRequestSchema = z.object({
  intentId: z.string().regex(/^[1-9]\d{0,77}$/),
  title: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(1_000),
  criteria: z.array(z.string().trim().min(1).max(500)).min(1).max(6),
  repositoryUrl: z.string().trim().min(1).max(500),
  ref: z.string().trim().max(200).optional(),
}).strict();
