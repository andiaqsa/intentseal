import { z } from "zod";

import {
  MAX_ROUGH_INTENT_LENGTH,
  MAX_STRUCTURED_CRITERIA,
  type StructuredIntent,
} from "../../shared/intent-structure";

export const structureIntentRequestSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Describe the intent before structuring it.")
      .max(
        MAX_ROUGH_INTENT_LENGTH,
        `Intent descriptions must be ${MAX_ROUGH_INTENT_LENGTH} characters or fewer.`,
      ),
  })
  .strict();

const completedClaimPattern = /\b(?:has been|was|is now|successfully)\s+(?:completed|implemented|finished)\b/i;

export const structuredIntentSchema: z.ZodType<StructuredIntent> = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "A title is required.")
      .max(120, "The title is too long.")
      .refine((title) => !/^#{1,6}\s/.test(title), "The title must not be a Markdown heading."),
    goal: z
      .string()
      .trim()
      .min(1, "A goal is required.")
      .max(1_000, "The goal is too long.")
      .refine(
        (goal) => !completedClaimPattern.test(goal),
        "The goal must describe an intention, not claim completion.",
      ),
    criteria: z
      .array(z.string().trim().min(1, "Criteria cannot be blank.").max(500))
      .min(1, "At least one criterion is required.")
      .max(MAX_STRUCTURED_CRITERIA, `No more than ${MAX_STRUCTURED_CRITERIA} criteria are allowed.`),
  })
  .strict()
  .superRefine((intent, context) => {
    const normalized = intent.criteria.map((criterion) => criterion.toLocaleLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      context.addIssue({
        code: "custom",
        path: ["criteria"],
        message: "Criteria must not contain duplicates.",
      });
    }
  });

export const structuredIntentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "goal", "criteria"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 120 },
    goal: { type: "string", minLength: 1, maxLength: 1_000 },
    criteria: {
      type: "array",
      minItems: 1,
      maxItems: MAX_STRUCTURED_CRITERIA,
      items: { type: "string", minLength: 1, maxLength: 500 },
    },
  },
} as const;
