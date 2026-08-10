export function requireStaff(request: Request): string {
  const url = new URL(request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return "ผู้ดูแลระบบ (Local Preview)";
  }
  const email = request.headers.get("oai-authenticated-user-email");
  if (!email) throw new Response("Unauthorized", { status: 401 });
  return email;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
