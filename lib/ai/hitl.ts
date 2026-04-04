export type HitlDecision =
  | { type: "approve"; editedArgs?: Record<string, unknown> }
  | { type: "reject"; message?: string };

type PendingDecision = {
  resolve: (decision: HitlDecision) => void;
  timeout: NodeJS.Timeout;
};

const pendingDecisions = new Map<string, PendingDecision>();

export function createHitlKey(conversationId: string, toolCallId: string): string {
  return `${conversationId}:${toolCallId}`;
}

export function waitForHitlDecision(
  key: string,
  options?: { timeoutMs?: number }
): Promise<HitlDecision> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  return new Promise<HitlDecision>((resolve) => {
    if (pendingDecisions.has(key)) {
      resolve({ type: "reject", message: "已有待处理审批" });
      return;
    }
    const timeout = setTimeout(() => {
      pendingDecisions.delete(key);
      resolve({ type: "reject", message: "审批超时" });
    }, timeoutMs);
    pendingDecisions.set(key, { resolve, timeout });
  });
}

export function resolveHitlDecision(
  key: string,
  decision: HitlDecision
): boolean {
  const pending = pendingDecisions.get(key);
  if (!pending) return false;
  clearTimeout(pending.timeout);
  pendingDecisions.delete(key);
  pending.resolve(decision);
  return true;
}
