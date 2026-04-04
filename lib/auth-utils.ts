import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getSessionFromHeaders(requestHeaders: Headers) {
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });
  return { session };
}

export async function getSession() {
  const requestHeaders = await headers();
  const { session } = await getSessionFromHeaders(requestHeaders);
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
