import { createServer, type IncomingMessage } from "node:http";

import { loadLocalServerEnvironment } from "./environment";
import { handleEvidenceAnalysis } from "./evidence/route";

loadLocalServerEnvironment();

const port = 8787;
const maxBodyBytes = 16_384;

const server = createServer(async (incoming, outgoing) => {
  try {
    const route = incoming.url === "/api/evidence/analyze" ? handleEvidenceAnalysis : null;
    if (!route) {
      outgoing.writeHead(404, { "Content-Type": "application/json" });
      outgoing.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Route not found." } }));
      return;
    }

    const body = await readBody(incoming);
    const request = new Request(`http://127.0.0.1:${port}${incoming.url}`, {
      method: incoming.method,
      headers: incoming.headers as HeadersInit,
      body: incoming.method === "GET" || incoming.method === "HEAD" ? undefined : body.toString("utf8"),
    });
    const response = await route(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "REQUEST_TOO_LARGE";
    outgoing.writeHead(tooLarge ? 413 : 500, { "Content-Type": "application/json" });
    outgoing.end(
      JSON.stringify({
        error: {
          code: tooLarge ? "REQUEST_TOO_LARGE" : "SERVER_ERROR",
          message: tooLarge ? "Request body is too large." : "The request could not be processed.",
        },
      }),
    );
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`IntentSeal server listening at http://127.0.0.1:${port}`);
});

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
