"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ensureInbox, INBOX } from "@/lib/system/ensureInbox";
import { ChapterTitle } from "@/components/chapters/ChapterTitle";
import { chapterDisplayTitle } from "@/lib/chapters/chapterTitle";
import { ActiveRun } from "@/components/runs/ActiveRun";
import { MessageList } from "@/components/messages/MessageList";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { useRuns } from "@/lib/runs/useRuns";

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

function formatCreatedAt(v: unknown): string | null {
  if (v instanceof Timestamp) {
    try {
      return v.toDate().toLocaleString();
    } catch {
      return null;
    }
  }
  return null;
}

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Always ensure Inbox exists (always-on work context)
  useEffect(() => {
    ensureInbox(db).catch(() => {});
  }, []);

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === activeTopicId) || null,
    [topics, activeTopicId]
  );

  // Work lane is always on. If no topic/chapter selected, route to Inbox.
  const workTopicId = activeTopicId ?? INBOX.topicId;
  const workChapterId = selectedChapterId ?? INBOX.chapterId;

  const { runs } = useRuns({
    topicId: workTopicId ?? undefined,
    chapterId: workChapterId ?? undefined,
  });

  const derivedRunId = runs && runs.length > 0 ? runs[0].id : null;
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Reset run selection when changing work context.
  useEffect(() => {
    setActiveRunId(null);
  }, [workTopicId, workChapterId]);

  // Adopt derived run when it appears.
  useEffect(() => {
    if (derivedRunId) setActiveRunId((prev) => prev ?? derivedRunId);
  }, [derivedRunId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTopics() {
      setError(null);
      try {
        const q = query(
          collection(db, "projectSolo", PROJECT_ID, "topics"),
          orderBy("order", "asc")
        );
        const snap = await getDocs(q);

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

        if (!cancelled) {
          setTopics(rows);
          setActiveTopicId((prev) => (prev ? prev : rows.length ? rows[0].id : null));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load topics";
        if (!cancelled) setError(msg);
      }
    }

    loadTopics();
    return () => {
      cancelled = true;
    };
  }, []);

  // When topic changes, clear selected chapter so we can choose a sane default after load.
  useEffect(() => {
    setSelectedChapterId(null);
  }, [activeTopicId]);

  useEffect(() => {
    let cancelled = false;

    async function loadChapters() {
      setError(null);
      setChapters([]);
      if (!activeTopicId) return;

      try {
        const q = query(
          collection(db, "projectSolo", PROJECT_ID, "topics", activeTopicId, "chapters"),
          orderBy("createdAt", "desc"),
          limit(50)
        );

        const snap = await getDocs(q);

        const rows: Chapter[] = snap.docs.map((d) => {
          const data = d.data() as ChapterDoc;
          return {
            id: d.id,
            title: toStr(data.title, d.id),
            status: toStatus(data.status),
            createdAt: data.createdAt,
            closedAt: data.closedAt instanceof Timestamp ? data.closedAt : null,
          };
        });

        if (cancelled) return;

        setChapters(rows);

        // Default selection rule:
        // 1) topic.openChapterId if present
        // 2) newest chapter (rows[0])
        // 3) null (will fall back to Inbox)
        const prefer = activeTopic?.openChapterId ?? null;
        const newest = rows.length ? rows[0].id : null;
        setSelectedChapterId((prev) => prev ?? prefer ?? newest ?? null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load chapters";
        if (!cancelled) setError(msg);
      }
    }

    loadChapters();
    return () => {
      cancelled = true;
    };
  }, [activeTopicId, activeTopic?.openChapterId]);

  async function createNewChapter() {
    if (!activeTopicId || !activeTopic) return;
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const title = `${activeTopic.title}`;

      const chaptersCol = collection(
        db,
        "projectSolo",
        PROJECT_ID,
        "topics",
        activeTopicId,
        "chapters"
      );

      const newRef = await addDoc(chaptersCol, {
        title,
        topicId: activeTopicId,
        status: "open",
        createdAt: serverTimestamp(),
        closedAt: null,
      });

      const prevOpenId = activeTopic.openChapterId;

      // We keep "openChapterId" as a convenience pointer, but we DO NOT enforce read-only.
      if (prevOpenId) {
        await updateDoc(
          doc(
            db,
            "projectSolo",
            PROJECT_ID,
            "topics",
            activeTopicId,
            "chapters",
            prevOpenId
          ),
          {
            status: "closed",
            closedAt: serverTimestamp(),
          }
        );
      }

      await updateDoc(doc(db, "projectSolo", PROJECT_ID, "topics", activeTopicId), {
        openChapterId: newRef.id,
      });

      setTopics((prev) =>
        prev.map((t) =>
          t.id === activeTopicId ? { ...t, openChapterId: newRef.id } : t
        )
      );

      setChapters((prev) => {
        const bumped = prev.map((c) =>
          prevOpenId && c.id === prevOpenId ? { ...c, status: "closed" as const } : c
        );
        return [
          { id: newRef.id, title, status: "open", createdAt: null, closedAt: null },
          ...bumped,
        ];
      });

      // Select the new chapter immediately (always usable).
      setSelectedChapterId(newRef.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create chapter";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex h-screen w-screen gap-4 p-4">
        {/* Topics lane */}
        <aside className="w-[260px] rounded-2xl border border-neutral-800/60 bg-neutral-950/40 p-4">
          <div className="mb-3 text-sm font-semibold tracking-wide text-neutral-200">
            ProjectSolo
          </div>

          {error ? (
            <div className="rounded-lg bg-red-950/40 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="space-y-1">
            {topics.map((t) => {
              const active = t.id === activeTopicId;
              const isCore = t.id === "runway" || t.id === "partner" || t.id === "kids";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTopicId(t.id)}
                  className={[
                    "w-full rounded-xl px-3 py-2 text-left text-sm transition",
                    active
                      ? "bg-white text-black"
                      : "bg-neutral-800/40 text-neutral-200 hover:bg-neutral-800/70",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.title}</span>
                    {isCore ? (
                      <span className="ml-2 rounded-full bg-neutral-700/60 px-2 py-0.5 text-[10px] text-neutral-200">
                        core
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-neutral-400">
            Loaded {topics.length} topics from Firestore.
          </div>
        </aside>

        {/* Chat */}
        <section className="flex min-w-0 flex-1 overflow-hidden rounded-2xl border border-neutral-800/60 bg-neutral-950/30">
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-b border-neutral-800/60 bg-black/40 px-6 py-4">
              <div className="text-xs text-neutral-400">Chat</div>
              <div className="mt-1 text-sm font-semibold text-neutral-100">
                {(activeTopic ? activeTopic.title : "Inbox")}
                {" / "}
                {(selectedChapterId ?? INBOX.chapterId)}
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
              <ActiveRun
                topicId={workTopicId}
                chapterId={workChapterId}
                activeRunId={activeRunId}
                onRunStarted={setActiveRunId}
              />
              <div className="min-h-0 flex-1 overflow-hidden">
                <MessageList
                  topicId={workTopicId}
                  chapterId={workChapterId}
                  runId={(activeRunId ?? derivedRunId) ?? undefined}
                />
              </div>
              <MessageComposer
                topicId={workTopicId}
                chapterId={workChapterId}
                runId={(activeRunId ?? derivedRunId) ?? undefined}
              />
            </div>
          </div>

          <div className="w-[260px] border-l border-neutral-800/60">
            <header className="border-b border-neutral-800/60 bg-black/40 px-6 py-4">
              <div className="text-xs text-neutral-400">Topic</div>
              <div className="mt-1 text-base font-semibold text-neutral-100">
                {activeTopic ? activeTopic.title : "—"}
              </div>
            </header>

            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-200">Chapters</div>

                <button
                  type="button"
                  onClick={createNewChapter}
                  disabled={!activeTopicId || busy}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold transition",
                    !activeTopicId || busy
                      ? "bg-neutral-800/40 text-neutral-500"
                      : "bg-white text-black hover:bg-neutral-200",
                  ].join(" ")}
                >
                  {busy ? "Creating…" : "New chapter"}
                </button>
              </div>

              <div className="space-y-2">
                {chapters.length === 0 ? (
                  <div className="rounded-xl bg-neutral-950/40 p-4 text-sm text-neutral-300">
                    No chapters yet for this topic.
                  </div>
                ) : (
                  chapters.map((c, idx) => {                    const isSelected = selectedChapterId === c.id;

                    const displayTitle = chapterDisplayTitle(c.title, idx);
                    const createdLabel = formatCreatedAt(c.createdAt);

                    return (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedChapterId(c.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedChapterId(c.id); } }}
                        className={[
                          "w-full rounded-xl px-3 py-2 text-left text-sm transition",
                          isSelected
                            ? "bg-white text-black"
                            : "bg-neutral-800/40 text-neutral-200 hover:bg-neutral-800/70",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-neutral-100">
                            <ChapterTitle
                              topicId={activeTopicId as string}
                              chapterId={c.id}
                              title={displayTitle}
                              disabled={!activeTopicId}
                              onRenamed={(nextTitle) => {
                                setChapters((prev) =>
                                  prev.map((x) =>
                                    x.id === c.id ? { ...x, title: nextTitle } : x
                                  )
                                );
                              }}
                            />
                          </div>

                          <div className="flex items-center gap-2">                          </div>
                        </div>

                        {createdLabel ? (
                          <div className="mt-1 text-xs text-neutral-400">
                            {createdLabel}
                          </div>
                        ) : null}

                        
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
