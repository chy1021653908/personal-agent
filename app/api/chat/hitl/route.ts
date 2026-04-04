import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getSessionFromHeaders } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { jsonErrorResponse, jsonResponse } from "@/lib/api/responses";
import {
  createHitlKey,
  resolveHitlDecision,
  type HitlDecision,
} from "@/lib/ai/hitl";

type HitlRequestBody = {
  conversationId?: string;
  toolCallId?: string;
  decision?: "approve" | "reject";
  editedArgs?: Record<string, unknown>;
  message?: string;
};

export async function POST(request: NextRequest) {
  const requestHeaders = await headers();
  const { session } = await getSessionFromHeaders(requestHeaders);

  if (!session) {
    return jsonErrorResponse(401, "Unauthorized");
  }

  const body = (await request.json()) as HitlRequestBody;
  if (
    typeof body.conversationId !== "string" ||
    typeof body.toolCallId !== "string" ||
    (body.decision !== "approve" && body.decision !== "reject")
  ) {
    return jsonErrorResponse(400, "Invalid request");
  }

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, body.conversationId),
        eq(conversations.userId, session.user.id)
      )
    );

  if (!conversation) {
    return jsonErrorResponse(404, "Conversation not found");
  }

  let decision: HitlDecision;
  if (body.decision === "approve") {
    decision = { type: "approve", editedArgs: body.editedArgs };
  } else {
    decision = { type: "reject", message: body.message };
  }

  const resolved = resolveHitlDecision(
    createHitlKey(body.conversationId, body.toolCallId),
    decision
  );

  if (!resolved) {
    return jsonErrorResponse(404, "Pending request not found");
  }

  return jsonResponse({ ok: true });
}
