import OpenAI from "openai";

import type { StructureIntentInput, StructuredIntent } from "../../shared/intent-structure";
import { structuredIntentJsonSchema, structuredIntentSchema } from "../intent/schema";
import { INTENT_STRUCTURING_INSTRUCTIONS, wrapUntrustedIntent } from "./prompt";
import { AiProviderResponseError, type IntentStructuringProvider } from "./provider";

export class OpenAiIntentStructuringProvider implements IntentStructuringProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async structureIntent({ text, signal }: StructureIntentInput): Promise<StructuredIntent> {
    const response = await this.client.responses.create(
      {
        model: this.model,
        instructions: INTENT_STRUCTURING_INSTRUCTIONS,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: wrapUntrustedIntent(text) }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "structured_intent",
            strict: true,
            schema: structuredIntentJsonSchema,
          },
        },
        store: false,
      },
      { signal },
    );

    if (!response.output_text) throw new AiProviderResponseError();

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      throw new AiProviderResponseError();
    }
    return structuredIntentSchema.parse(parsed);
  }
}
