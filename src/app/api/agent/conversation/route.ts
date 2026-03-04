import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { runAgentSimple } from '@/lib/p0/coreClient';

export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    if (!audioFile) return NextResponse.json({ ok: false }, { status: 400 });

    // 1. Transcribe
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile as unknown as File,
    });
    const userText = transcription.text.trim();
    if (!userText) return NextResponse.json({ ok: false, error: "No speech" });

    // 2. Think (P0 Core)
    const res = await runAgentSimple({
      agentId: (formData.get('agentId') as string) || undefined,
      message: userText,
      memoryScope: ((formData.get('memoryScope') as string) || 'working') as 'working' | 'core',
      runId: (formData.get('runId') as string) || undefined,
      writeMemory: false,
      humanAck: false,
    });

    const replyText = res.reply || "...";

    return NextResponse.json({
      ok: true,
      transcript: userText,
      reply: replyText,
    });

  } catch (err) {
    console.error('Conversation Error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
