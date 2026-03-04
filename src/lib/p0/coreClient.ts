import "server-only";
import { runAgentDirect } from "./directLLM";

export type RunSimpleInput = {
  agentId?: string;
  message: string;
  memoryScope: "working" | "core";
  runId?: string;
  allowActions?: string[];
  actions?: string[];
  writeMemory?: boolean;
  writeMemoryTags?: string[];
  writeMemoryPersona?: string;
  writeMemoryJobTitle?: string;
  humanAck?: boolean;
};

export type RunSimpleResponse = {
  ok: boolean;
  reply?: string;
  actions?: unknown[];
  actionsRequested?: unknown[];
  trace?: unknown;
  auditId?: string;
  memoryUsed?: unknown;
  requestId?: string;
  actionGate?: unknown;
  error?: string;
};

function resolveAgentId(requested?: string) {
  if (!requested) return process.env.P0_CORE_AGENT_ID;
  const envKey = `P0_CORE_AGENT_${requested.toUpperCase()}`;
  return process.env[envKey] || process.env.P0_CORE_AGENT_ID || requested;
}

export async function runAgentSimple(input: RunSimpleInput): Promise<RunSimpleResponse> {
  const baseUrl = process.env.P0_CORE_BASE_URL;

  // If P0 Core is not configured, use direct LLM fallback
  if (!baseUrl) {
    console.log("[Solo] P0_CORE_BASE_URL not set, using direct LLM fallback");
    const directResult = await runAgentDirect({
      personaId: input.agentId,
      message: input.message,
      memoryScope: input.memoryScope,
    });

    if (!directResult.ok) {
      return {
        ok: false,
        error: directResult.error || "Direct LLM call failed",
      };
    }

    return {
      ok: true,
      reply: directResult.reply,
    };
  }

  const apiKey = process.env.P0_CORE_API_KEY;
  const jwt = process.env.P0_CORE_JWT;
  const devBypass = process.env.DEV_BYPASS_SECRET;

  const agentId = resolveAgentId(input.agentId);
  if (!agentId) {
    throw new Error("P0 Core agentId is required (set P0_CORE_AGENT_ID or pass agentId)");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const bearer = apiKey || jwt;
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  } else if (devBypass) {
    headers["x-dev-bypass"] = devBypass;
  }

  headers["x-request-id"] =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `solo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const body = {
    ...input,
    agentId,
  };

  const url = `${baseUrl}/api/v1/agents/run/simple`;
  const doFetch = () =>
    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

  let res: Response;
  try {
    res = await doFetch();
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.cause : undefined;
    const code = cause && typeof cause === "object" && "code" in cause ? (cause as { code: string }).code : undefined;
    if (code === "ECONNREFUSED") {
      // Core is configured but unreachable - fall back to direct LLM
      console.log(`[Solo] P0 Core unreachable at ${baseUrl}, falling back to direct LLM`);
      const directResult = await runAgentDirect({
        personaId: input.agentId,
        message: input.message,
        memoryScope: input.memoryScope,
      });
      if (!directResult.ok) {
        return { ok: false, error: directResult.error || "Direct LLM fallback failed" };
      }
      return { ok: true, reply: directResult.reply };
    }
    throw err;
  }

  // Core returns 429 with { ok: false, code: "RATE_LIMITED", error: "..." }; retry once with short backoff
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      res = await doFetch();
    } catch (err: unknown) {
      const cause = err instanceof Error ? err.cause : undefined;
      const code = cause && typeof cause === "object" && "code" in cause ? (cause as { code: string }).code : undefined;
      if (code === "ECONNREFUSED") {
        throw new Error(`P0 Core unreachable at ${baseUrl}. Is it running?`);
      }
      throw err;
    }
  }

  const data = (await res.json()) as RunSimpleResponse;
  // Core may return 200 with { ok: false, error, code, requestId? } for application errors
  if (!res.ok || data.ok === false) {
    const message = data?.error || `P0 Core error (${res.status})`;
    throw new Error(message);
  }
  return data;
}
