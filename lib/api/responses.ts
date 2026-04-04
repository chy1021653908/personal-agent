export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonErrorResponse(status: number, error: string): Response {
  return jsonResponse({ error }, status);
}
