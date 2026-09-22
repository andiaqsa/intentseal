import { MAX_AI_SERVER_TIMEOUT_MS } from "../../shared/intent-structure";

// This browser deadline is an infrastructure safety net. The server timeout is authoritative.
export const AI_REQUEST_TIMEOUT_MS = MAX_AI_SERVER_TIMEOUT_MS + 10_000;
