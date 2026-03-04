import { NextResponse } from 'next/server';
import { runAgentSimple } from '@/lib/p0/coreClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, prompt, message, runId, agentId, memoryScope, writeMemory, humanAck, allowActions, actions, writeMemoryTags, writeMemoryPersona, writeMemoryJobTitle } = body ?? {};

    type MessageInput = { authorType: "human" | "agent"; text?: string; content?: string };
    const safeMessages = (messages as MessageInput[]) || [];
    const last = safeMessages[safeMessages.length - 1];
    const lastText = (message || prompt || last?.text || last?.content || "").toString();

    const res = await runAgentSimple({
      agentId: agentId || body?.persona?.id,
      message: lastText,
      memoryScope: memoryScope || "working",
      runId,
      writeMemory,
      humanAck: writeMemory ? true : humanAck,
      allowActions,
      actions,
      writeMemoryTags,
      writeMemoryPersona,
      writeMemoryJobTitle,
    });

    return NextResponse.json({ text: res.reply || "" });
  } catch (error: unknown) {
    console.error("[P0 Core Proxy Error]:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
