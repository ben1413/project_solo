import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

// Ensure you have OPENAI_API_KEY in .env.local
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audio = formData.get('audio');

    if (!audio || typeof audio !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Missing audio file.' },
        { status: 400 }
      );
    }

    // Using standard Whisper model for reliable transcription
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1', 
      file: audio as unknown as File,
    });

    const text = (transcription.text || '').trim();

    return NextResponse.json({ ok: true, text });
  } catch (err) {
    console.error('Error in /api/audio/transcribe', err);
    return NextResponse.json(
      { ok: false, error: 'Transcription endpoint hit an error.' },
      { status: 500 }
    );
  }
}
