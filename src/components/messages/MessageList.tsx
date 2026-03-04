"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { promoteToMemory, notifyP0Promote } from '@/lib/promoteMemory';
import { StreamingText } from './StreamingText';

interface MessageListProps {
  topicId: string;
  runId: string;
  promotePersona?: string;
  promoteJobTitle?: string;
}

export const MessageList = ({ topicId, runId, promotePersona, promoteJobTitle }: MessageListProps) => {
  const messages = useMessages(topicId, runId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lastContext, setLastContext] = useState(`${topicId}-${runId}`);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const handlePromote = async (m: { id: string; text: string }) => {
    if (promotingId) return;
    setPromotingId(m.id);
    try {
      await promoteToMemory({
        topicId,
        runId,
        sourceMessageId: m.id,
        text: m.text,
        promotedByPersona: promotePersona,
        promotedByJobTitle: promoteJobTitle,
      });
      await notifyP0Promote({
        runId,
        text: m.text,
        persona: promotePersona,
        jobTitle: promoteJobTitle,
      });
    } catch (err) {
      console.error("[Promote]:", err);
    } finally {
      setPromotingId(null);
    }
  };

  if (`${topicId}-${runId}` !== lastContext) {
    setLastContext(`${topicId}-${runId}`);
    setShouldAutoScroll(true);
  }

  useEffect(() => {
    if (shouldAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, shouldAutoScroll]);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-transparent">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center px-6">
          <p className="text-[13px] font-medium tracking-[0.2em] uppercase text-[var(--text-blue)]/80 mb-2">
            This run is empty
          </p>
          <p className="text-[12px] text-[var(--text-blue)]/60 max-w-[280px]">
            Send a message below to start the conversation. It will persist across refreshes.
          </p>
        </div>
      ) : (
        <>
      {messages.map((m, i) => (
        <div key={m.id || i} className={`flex ${m.authorType === 'human' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] ${m.authorType === 'human' ? 'text-right' : 'text-left'}`}>
            <div className="text-[10px] font-bold tracking-[0.25em] uppercase mb-3 text-[var(--text-blue)]">
              {m.authorType === 'human' ? 'You' : 'Scribe'}
            </div>
            <div className={`px-5 py-4 rounded-2xl border soft-elevate ${
              m.authorType === 'human'
                ? 'bg-white/10 text-[var(--text-blue)] border-white/10 rounded-tr-none'
                : 'bg-[var(--panel)] text-[var(--text-blue)] border-white/10 rounded-tl-none'
            }`}>
              <div className="leading-relaxed whitespace-pre-wrap text-[15px]">
                <StreamingText 
                  text={m.text} 
                  isNew={i === messages.length - 1 && m.authorType === 'agent'} 
                />
              </div>
              <div className={`mt-2 flex ${m.authorType === 'human' ? 'justify-end' : 'justify-start'}`}>
                <button
                  type="button"
                  onClick={() => handlePromote(m)}
                  disabled={promotingId === m.id}
                  className="text-[10px] uppercase tracking-wider text-[var(--text-blue)]/50 hover:text-[var(--text-blue)]/80 disabled:opacity-50"
                >
                  {promotingId === m.id ? '…' : 'Promote'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
        </>
      )}
      <div ref={bottomRef} className="h-4" />
    </div>
  );
};
