"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MessageList } from '@/components/messages/MessageList';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { ChapterList } from '@/components/layout/ChapterList';
import { AgentDirective } from '@/components/agents/AgentDirective';
import { ProjectSoloLogo } from '@/components/ProjectSoloLogo';
import { PMConsole } from '@/components/pm/PMConsole';
import { PERSONAS, Persona, LLMEngine, LLM_ENGINES } from '@/data/personas';
import { parseMessageIntent } from '@/lib/engine/intentParser';
import { db } from '@/lib/firebase/client';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { createNewChapter } from '@/lib/chapters/newChapter';
import { renameChapter } from '@/lib/chapters/renameChapter';
import { deleteChapter } from '@/lib/chapters/deleteChapter';
import { ensureInbox, INBOX } from '@/lib/system/ensureInbox';
import { ensureRun } from '@/lib/runs/ensureRun';
import { useRuns } from '@/lib/runs/useRuns';

type TopicDoc = {
  title?: unknown;
  order?: unknown;
  archived?: unknown;
  isSystem?: unknown;
  openChapterId?: unknown;
};

type Topic = {
  id: string;
  title: string;
  order: number;
  archived: boolean;
  isSystem: boolean;
  openChapterId: string | null;
};

type ChapterDoc = {
  title?: unknown;
  status?: unknown;
  createdAt?: unknown;
  closedAt?: unknown;
};

type Chapter = {
  id: string;
  title: string;
  status: "open" | "closed";
  createdAt: unknown;
  closedAt: unknown | null;
};

const PROJECT_ID = "default";

function toBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function toNum(v: unknown, fallback = 999): number {
  return typeof v === "number" ? v : fallback;
}

function toStr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length ? v : fallback;
}

function toStatus(v: unknown): "open" | "closed" {
  return v === "closed" ? "closed" : "open";
}

export default function ProjectSoloPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ORCHESTRATION STATE
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0]);
  const [activeEngine, setActiveEngine] = useState<LLMEngine>('gpt-5.2');
  const [isSwitching, setIsSwitching] = useState(false);
  const [pmOpen, setPmOpen] = useState(false);
  const [pmChatOpen, setPmChatOpen] = useState(false);
  const [pmActivated, setPmActivated] = useState(false);
  const [pmAuthorityProfile, setPmAuthorityProfile] = useState<Record<string, "human" | "hitl" | "agent">>({});

  // Intent Listener: Watches the state and flashes the UI during a switch
  const handleIntentDetection = (text: string) => {
    const { persona, engine } = parseMessageIntent(text);
    if (persona && persona.id !== activePersona.id) {
      setActivePersona(persona);
      triggerFlash();
    }
    if (engine && engine !== activeEngine) {
      setActiveEngine(engine);
      triggerFlash();
    }
  };

  const triggerFlash = () => {
    setIsSwitching(true);
    setTimeout(() => setIsSwitching(false), 1000);
  };

  useEffect(() => {
    ensureInbox(db).catch(() => {});
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("pmConsoleActivated") : null;
    if (stored === "true") setPmActivated(true);
  }, []);

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === activeTopicId) || null,
    [topics, activeTopicId]
  );

  const openChapters = useMemo(
    () => chapters.filter((c) => c.status === "open"),
    [chapters]
  );

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === (selectedChapterId ?? undefined)) ?? null,
    [chapters, selectedChapterId]
  );

  const topicTitle = activeTopic?.title ?? "Inbox";
  const chapterTitle = selectedChapter?.title ?? (activeTopicId == null ? "Inbox" : "Chapter");
  const breadcrumb = `${topicTitle} / ${chapterTitle}`;

  const workTopicId = activeTopicId ?? INBOX.topicId;
  const workChapterId = selectedChapterId ?? INBOX.chapterId;

  const { runs } = useRuns({
    topicId: workTopicId ?? undefined,
    chapterId: workChapterId ?? undefined,
  });

  useEffect(() => {
    setActiveRunId(null);
  }, [workTopicId, workChapterId]);

  useEffect(() => {
    if (runs && runs.length > 0) {
      setActiveRunId((prev) => prev ?? runs[0].id);
    }
  }, [runs]);

  useEffect(() => {
    const topicsRef = collection(db, "projectSolo", PROJECT_ID, "topics");
    const q = query(topicsRef, orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Topic[] = snap.docs
          .map((d) => {
            const data = d.data() as TopicDoc;
            return {
              id: d.id,
              title: toStr(data.title, d.id),
              order: toNum(data.order, 999),
              archived: toBool(data.archived, false),
              isSystem: toBool(data.isSystem, false),
              openChapterId:
                typeof data.openChapterId === "string" ? data.openChapterId : null,
            };
          })
          .filter((t) => !t.archived);

        setTopics(rows);
        setActiveTopicId((prev) => (prev ? prev : rows.length ? rows[0].id : null));
        setError(null);
      },
      (err) => {
        setError(err.message || "Failed to load topics");
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const t = topics.find((x) => x.id === activeTopicId);
    setSelectedChapterId(t?.openChapterId ?? null);
  }, [activeTopicId, topics]);

  useEffect(() => {
    if (!activeTopicId) return;

    const chaptersRef = collection(
      db,
      "projectSolo",
      PROJECT_ID,
      "topics",
      activeTopicId,
      "chapters"
    );
    const q = query(chaptersRef, orderBy("createdAt", "desc"), limit(50));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Chapter[] = snap.docs.map((d) => {
          const data = d.data() as ChapterDoc;
          return {
            id: d.id,
            title: toStr(data.title, d.id),
            status: toStatus(data.status),
            createdAt: data.createdAt,
            closedAt: data.closedAt ?? null,
          };
        });

        setChapters(rows);
        const prefer = activeTopic?.openChapterId ?? null;
        const openRows = rows.filter((r) => r.status === "open");
        const preferOpen = prefer && openRows.some((r) => r.id === prefer) ? prefer : null;
        const newestOpen = openRows.length ? openRows[0].id : null;
        setSelectedChapterId((prev) => prev ?? preferOpen ?? newestOpen ?? null);
        setError(null);
      },
      (err) => {
        setError(err.message || "Failed to load chapters");
      }
    );

    return () => unsub();
  }, [activeTopicId, activeTopic?.openChapterId]);

  useEffect(() => {
    if (!workTopicId || !workChapterId) return;
    ensureRun(workTopicId, workChapterId)
      .then((id) => setActiveRunId((prev) => prev ?? id))
      .catch(() => {});
  }, [workTopicId, workChapterId]);

  const handleNewChapter = async () => {
    if (!activeTopicId) return;
    if (busy) return;
    setBusy(true);
    try {
      const newId = await createNewChapter(db, activeTopicId);
      setSelectedChapterId(newId);
      await updateDoc(doc(db, "projectSolo", PROJECT_ID, "topics", activeTopicId), {
        openChapterId: newId,
        lastTouchedAt: serverTimestamp(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create chapter";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleActivatePM = (profile: Record<string, "human" | "hitl" | "agent">) => {
    setPmAuthorityProfile(profile);
    setPmActivated(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("pmConsoleActivated", "true");
    }
    // TODO: ledger write for activation + authority profile
  };

  return (
    <main className="relative flex flex-col h-screen w-full bg-transparent text-[var(--text-blue)] overflow-hidden">
      {/* HEADER LOCKED: h-24 */}
      <header className="h-24 border-b border-white/10 grid grid-cols-[18rem_1fr_auto] items-center pl-0 pr-10 shrink-0">
        <div className="flex items-center justify-center w-[18rem]">
          <ProjectSoloLogo className="h-20 w-auto text-[var(--text-blue)] opacity-90" />
        </div>
        <div className="text-[12px] font-bold tracking-[0.4em] uppercase text-[var(--text-blue)]">
          / {breadcrumb}
        </div>
        <div className="flex items-center gap-3 justify-self-end">
          <button
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-blue)]"
            onClick={() => setPmOpen(true)}
          >
            PM Board
          </button>
          <button
            className="bg-white text-black px-6 py-2 rounded-full font-bold text-[10px] tracking-widest uppercase soft-elevate disabled:opacity-60"
            onClick={handleNewChapter}
            disabled={!activeTopicId || busy}
          >
            {busy ? "Creating..." : "New Chapter"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="w-72 border-r border-white/10">
          <Sidebar
            activeTopicId={activeTopicId}
            onSelectTopic={setActiveTopicId}
            topics={
              topics.length
                ? topics.map((t) => ({
                    id: t.id,
                    title: t.title,
                    isCore: t.id === "runway" || t.id === "partner" || t.id === "kids",
                  }))
                : []
            }
          />
        </div>

        <div className="flex-1 flex flex-col bg-transparent">
          {error ? (
            <div className="px-12 pt-6 text-sm text-red-300">{error}</div>
          ) : null}
          <div className="px-12 pt-4 text-xs uppercase tracking-[0.28em] text-[var(--text-blue)]">
            {breadcrumb}
          </div>
          <MessageList
              topicId={workTopicId ?? INBOX.topicId}
              runId={activeRunId ?? ''}
              promotePersona={activePersona.name}
              promoteJobTitle={activePersona.jobTitle}
            />
          
          <div className="px-12 pb-10 flex flex-col gap-6 pt-4">
            <MessageComposer 
              topicId={workTopicId ?? INBOX.topicId} 
              runId={activeRunId ?? ''} 
              activePersona={activePersona} 
              activeEngine={activeEngine}
              onMessageSent={handleIntentDetection} 
            />
            
            <div className={`h-px w-full transition-colors duration-500 ${isSwitching ? 'bg-white' : 'bg-white/10'}`} />
            
            <div className={`transition-all duration-500 ${isSwitching ? 'scale-[1.02] opacity-50' : ''}`}>
              <AgentDirective 
                activePersona={activePersona} 
                activeEngine={activeEngine}
                onPersonaChange={setActivePersona}
                onEngineChange={setActiveEngine}
              />
            </div>
          </div>
        </div>

        <div className="w-72 border-l border-white/10">
          <ChapterList 
            chapters={openChapters} 
            activeChapterId={selectedChapterId ?? undefined} 
            onSelectChapter={setSelectedChapterId}
            onRenameChapter={async (id, title) => {
              if (!activeTopicId) return;
              await renameChapter({ topicId: activeTopicId, chapterId: id, title });
            }}
            onDeleteChapter={async (chapterId) => {
              if (!activeTopicId) return;
              if (activeTopicId === INBOX.topicId && chapterId === INBOX.chapterId) return;
              const otherOpen = openChapters.filter((c) => c.id !== chapterId)[0]?.id ?? null;
              await deleteChapter({ topicId: activeTopicId, chapterId });
              if (activeTopic?.openChapterId === chapterId) {
                await updateDoc(doc(db, "projectSolo", PROJECT_ID, "topics", activeTopicId), {
                  openChapterId: otherOpen,
                  lastTouchedAt: serverTimestamp(),
                });
              }
              setSelectedChapterId((prev) => (prev === chapterId ? otherOpen : prev));
            }}
          />
        </div>
      </div>

      <PMConsole
        open={pmOpen}
        onClose={() => setPmOpen(false)}
        scope={{
          scopeType: "topic",
          scopeId: workTopicId,
          displayName: activeTopic?.title ?? "Inbox",
        }}
        topics={topics.map((t) => ({ id: t.id, title: t.title }))}
        onScopeChange={(scope) => setActiveTopicId(scope.scopeId)}
        activated={pmActivated}
        onActivate={handleActivatePM}
        authorityProfile={pmAuthorityProfile}
        onAuthorityChange={setPmAuthorityProfile}
        chatOpen={pmChatOpen}
        onToggleChat={() => setPmChatOpen((prev) => !prev)}
        agentOptions={PERSONAS.map((p) => ({ id: p.id, label: `${p.name} / ${p.jobTitle}` }))}
        engineOptions={LLM_ENGINES.map((e) => ({ id: e, label: e.toUpperCase() }))}
        activeAgentId={activePersona.id}
        activeEngineId={activeEngine}
        onAgentChange={(id) => {
          const next = PERSONAS.find((p) => p.id === id);
          if (next) setActivePersona(next);
        }}
        onEngineChange={(id) => setActiveEngine(id as LLMEngine)}
      />
    </main>
  );
}
