import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

type RequestWithId = IncomingMessage & { id?: string };

export function getRequestId(request: RequestWithId): string {
  if (!request.id) {
    request.id = randomUUID();
  }

  return request.id;
}
