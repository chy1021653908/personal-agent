import { streamText } from "ai";
import { requireSession } from "@/lib/auth-utils";
import { buildSystemPrompt, formatSourcesForMessage } from "@/lib/ai/prompts";
import { retrieve } from "@/lib/rag/retriever";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    const {
      messages: clientMessages,
      conversationId,
      model: modelName,
    } = await request.json();

    let retrievalResults = undefined;

    if (conversationId) {
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, session.user.id)
          )
        );

      if (
        conversation?.knowledgeBaseId &&
        conversation.retrievalScope !== "none"
      ) {
        const lastUserMessage = clientMessages
          .filter((m: { role: string }) => m.role === "user")
          .pop();

        const userContent =
          lastUserMessage?.content ??
          lastUserMessage?.parts?.find(
            (p: { type: string }) => p.type === "text"
          )?.text;

        if (userContent && typeof userContent === "string") {
          try {
            retrievalResults = await retrieve({
              knowledgeBaseId: conversation.knowledgeBaseId,
              query: userContent,
              scope:
                conversation.retrievalScope === "none"
                  ? undefined
                  : (conversation.retrievalScope as
                      | "knowledge_base"
                      | "folder"
                      | "document"),
              scopeId: conversation.retrievalScopeId || undefined,
            });
          } catch (error) {
            console.error("Retrieval failed:", error);
          }
        }
      }

      const lastMsg = clientMessages[clientMessages.length - 1];
      if (lastMsg?.role === "user") {
        const content =
          lastMsg.content ??
          lastMsg.parts?.find((p: { type: string }) => p.type === "text")
            ?.text ??
          "";
        await db.insert(messages).values({
          conversationId,
          role: "user",
          content: typeof content === "string" ? content : JSON.stringify(content),
        });
      }
    }

    const systemPrompt = buildSystemPrompt(retrievalResults);

    const coreMessages = clientMessages.map(
      (m: { role: string; content?: string; parts?: Array<{ type: string; text?: string }> }) => ({
        role: m.role as "user" | "assistant" | "system",
        content:
          m.content ??
          m.parts
            ?.filter((p: { type: string }) => p.type === "text")
            .map((p: { text?: string }) => p.text)
            .join("") ??
          "",
      })
    );

    const result = streamText({
      model: modelName,
      system: systemPrompt,
      messages: coreMessages,
      async onFinish({ text }) {
        if (conversationId) {
          await db.insert(messages).values({
            conversationId,
            role: "assistant",
            content: text,
            sources: retrievalResults
              ? formatSourcesForMessage(retrievalResults)
              : null,
          });

          await db
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, conversationId));
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: "Chat failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
