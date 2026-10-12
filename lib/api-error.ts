export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function errorResponse(error: unknown): Response {
  const requestId = crypto.randomUUID();
  if (error instanceof ApiError) return Response.json({ error: error.message, requestId }, { status: error.status });
  const name = error instanceof Error ? error.name : "UnknownError";
  // Driver messages can contain credentials, URLs and queries.
  console.error(JSON.stringify({ event: "request_failed", requestId, type: name }));
  return Response.json({ error: name.startsWith("Prisma") ? "Database unavailable. Please try again later." : "Service unavailable. Please try again later.", requestId }, { status: 503 });
}
