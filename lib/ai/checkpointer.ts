import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

let checkpointer: PostgresSaver | null = null;
let setupPromise: Promise<PostgresSaver> | null = null;

export async function getLangGraphCheckpointer(): Promise<PostgresSaver> {
  if (checkpointer) return checkpointer;
  if (setupPromise) return setupPromise;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for LangGraph checkpointer");
  }

  const schema = process.env.LANGGRAPH_CHECKPOINT_SCHEMA?.trim() || "langgraph";

  setupPromise = (async () => {
    const saver = PostgresSaver.fromConnString(connectionString, { schema });
    await saver.setup();
    checkpointer = saver;
    return saver;
  })();

  try {
    return await setupPromise;
  } catch (error) {
    checkpointer = null;
    throw error;
  } finally {
    setupPromise = null;
  }
}
