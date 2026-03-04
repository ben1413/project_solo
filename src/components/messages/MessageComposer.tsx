"use client";

import React, { useState } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Persona, LLMEngine } from '@/data/personas';
import { TranscribeComposer } from './TranscribeComposer';
import { useVoiceTurns } from '@/hooks/useVoiceTurns';

interface MessageComposerProps {
  topicId: string;
  runId: string;
  activePersona: Persona;
  activeEngine: LLMEngine;
  onMessageSent: (text: string) => void;
}

type ComposerMode = 'text' | 'transcribe';

export const MessageComposer = ({ topicId, runId, activePersona, activeEngine, onMessageSent }: MessageComposerProps) => {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [mode, setMode] = useState<ComposerMode>('text');
  const [agentError, setAgentError] = useState<string | null>(null);

  const { voiceSessionOn, voiceTurnState, startVoiceConversation, stopVoiceConversation } = useVoiceTurns({
    isInputReadOnly: isSending,
    onVoiceSubmit: async ({ audio, voice }) => {
      try {
        const formData = new FormData();
        formData.append('audio', audio, 'audio.webm');
        formData.append('voice', voice);
        formData.append('agentId', activePersona.id);
        formData.append('runId', runId);
        formData.append('memoryScope', 'working');

        const res = await fetch('/api/agent/conversation', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!data?.ok) return;

        const transcript = (data?.transcript || '').trim();
        const reply = (data?.reply || '').trim();

        if (transcript) {
          onMessageSent(transcript);
          await addDoc(collection(db, "messages"), {
            topicId,
            runId,
            text: transcript,
            authorType: 'human',
            authorName: 'Ben',
            createdAt: serverTimestamp(),
          });
        }

        if (reply) {
          await addDoc(collection(db, "messages"), {
            topicId,
            runId,
            text: reply,
            authorType: 'agent',
            authorName: activePersona.name,
            engine: activeEngine,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error("[Voice Error]:", error);
      }
    },
  });

  React.useEffect(() => {
    if (voiceSessionOn && text.trim().length > 0) {
      stopVoiceConversation();
    }
  }, [text, voiceSessionOn, stopVoiceConversation]);

  const handleSend = async () => {
    const messageText = text.trim();
    if (!messageText || isSending) return;

    // Clear input immediately for snappy UX
    setText("");
    setIsSending(true);
    setAgentError(null);

    // Trigger the intent parser (Hot-swap Toni/Izzi/Cindi)
    onMessageSent(messageText);

    try {
      await addDoc(collection(db, "messages"), {
        topicId,
        runId,
        text: messageText,
        authorType: 'human',
        authorName: 'Ben',
        createdAt: serverTimestamp(),
      });

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ authorType: 'human', text: messageText }],
          message: messageText,
          runId,
          topicId,
          agentId: activePersona.id,
          memoryScope: 'working',
          persona: activePersona,
          engine: activeEngine,
        }),
      });

      const data = await response.json();
      const errMsg = (data?.error as string) || (response.ok ? null : response.statusText || `HTTP ${response.status}`);
      if (errMsg) {
        setAgentError(errMsg);
        return;
      }
      const agentReply = (data?.text || "").toString().trim();
      if (agentReply) {
        await addDoc(collection(db, "messages"), {
          topicId,
          runId,
          text: agentReply,
          authorType: 'agent',
          authorName: activePersona.name,
          engine: activeEngine,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Request failed";
      setAgentError(msg);
      console.error("[Composer Error]:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative group w-full">
      {agentError ? (
        <div className="mb-3 px-4 py-2 rounded-lg bg-red-950/50 border border-red-500/30 text-red-200 text-[12px]">
          Agent: {agentError}
        </div>
      ) : null}
      <div className="relative flex items-center rounded-[22px] border border-white/10 bg-black/30 px-6 py-4 shadow-2xl transition-all group-focus-within:border-white/20 soft-elevate">
        {mode === 'transcribe' ? (
          <div className="flex-1">
            <TranscribeComposer
              onCancel={() => setMode('text')}
              onTranscribed={(transcript) => {
                setText((prev) => prev + (prev ? " " : "") + transcript);
                setMode('text');
              }}
            />
          </div>
        ) : (
          <>
            <button className="text-[var(--text-blue)]/70 hover:text-[var(--text-blue)] transition-colors mr-3">
              <span className="text-xl font-light opacity-50">+</span>
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Message..."
              className="flex-1 bg-transparent text-[var(--text-blue)] outline-none text-[15px] placeholder:text-[var(--text-blue)]/60 font-medium"
            />
            <div className="flex items-center gap-4 ml-4">
              <button
                className="text-[var(--text-blue)]/70 hover:text-[var(--text-blue)] transition-colors"
                title="Transcribe"
                onClick={() => setMode('transcribe')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              {text.trim().length === 0 ? (
                <button
                  className={`text-[var(--text-blue)]/70 hover:text-[var(--text-blue)] transition-colors ${voiceSessionOn ? 'text-[var(--text-blue)]' : ''}`}
                  title={voiceSessionOn ? "Stop audio session" : "Start audio session"}
                  onClick={() => (voiceSessionOn ? stopVoiceConversation() : startVoiceConversation())}
                >
                  {voiceSessionOn ? (
                    <span className="inline-flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full bg-[var(--text-blue)] animate-pulse" />
                      {voiceTurnState === 'processing' ? '...' : 'On'}
                    </span>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 10v3m4-6v9m4-12v15m4-12v9m4-6v3" />
                    </svg>
                  )}
                </button>
              ) : (
                <button onClick={handleSend} disabled={isSending} className="text-[var(--text-blue)]/70 hover:text-[var(--text-blue)] transition-colors" title="Send">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
