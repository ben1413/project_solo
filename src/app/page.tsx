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
import { ChapterTitle } from "@/components/chapters/ChapterTitle";
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === activeTopicId) || null,
    [topics, activeTopicId]
  );

  const activeChapterId = activeTopic?.openChapterId ?? null;

  const { runs } = useRuns({
    topicId: activeTopicId ?? undefined,
    chapterId: activeChapterId ?? undefined,
  });

  // Canonical invariant for v0: one run per open chapter. Use newest run.
  const activeRunId = runs && runs.length > 0 ? runs[0].id : null;

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

        const rows: Topic[] = snap.docs.map((d) => {
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
        });

        const visible = rows.filter((t) => !t.archived);

        if (!cancelled) {
          setTopics(visible);
          setActiveTopicId((prev) =>
            prev ? prev : visible.length ? visible[0].id : null
          );
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

  useEffect(() => {
    let cancelled = false;

    async function loadChapters() {
      setError(null);
      setChapters([]);
      if (!activeTopicId) return;

      try {
        const q = query(
          collection(
            db,
            "projectSolo",
            PROJECT_ID,
            "topics",
            activeTopicId,
            "chapters"
          ),
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

        if (!cancelled) setChapters(rows);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load chapters";
        if (!cancelled) setError(msg);
      }
    }

    loadChapters();
    return () => {
      cancelled = true;
    };
  }, [activeTopicId]);

  async function createNewChapter() {
    if (!activeTopicId || !activeTopic) return;
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      // Title is human label only. Timestamp is displayed separately.
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create chapter";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-6 py-10">
        {/* Topics lane */}
        <aside className="w-[280px] rounded-2xl bg-neutral-900/70 p-4 shadow">
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

        {/* Middle + Right lanes */}
        <section className="flex flex-1 overflow-hidden rounded-2xl bg-neutral-900/40 shadow">
          {/* Chapters lane */}
          <div className="w-[380px] border-r border-neutral-800/60">
            <header className="border-b border-neutral-800/60 bg-neutral-950/40 px-6 py-4">
              <div className="text-xs text-neutral-400">ProjectSolo</div>
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

              <div className="mt-3 space-y-2">
                {chapters.length === 0 ? (
                  <div className="rounded-xl bg-neutral-950/40 p-4 text-sm text-neutral-300">
                    No chapters yet for this topic.
                  </div>
                ) : (
                  chapters.map((c) => {
                    const isOpen = c.status === "open";
                    const isActive = activeTopic?.openChapterId === c.id;

                    // Back-compat: older titles included a timestamp suffix like "Topic — 1/26/..."
                    const parts = c.title.split(" — ");
                    const baseTitle = parts[0] || c.title;
                    const legacyStamp =
                      parts.length > 1 ? parts.slice(1).join(" — ") : null;

                    const createdLabel = formatCreatedAt(c.createdAt) || legacyStamp;

                    return (
                      <div
                        key={c.id}
                        className={[
                          "rounded-xl border p-4 text-sm",
                          isActive
                            ? "border-white/40 bg-white/10"
                            : "border-neutral-800/60 bg-neutral-950/30",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-neutral-100">
                            <ChapterTitle
                              topicId={activeTopicId as string}
                              chapterId={c.id}
                              title={baseTitle}
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

                          <div className="flex items-center gap-2">
                            {isActive ? (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-black">
                                active
                              </span>
                            ) : null}

                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                isOpen
                                  ? "bg-emerald-500/20 text-emerald-200"
                                  : "bg-neutral-700/50 text-neutral-200",
                              ].join(" ")}
                            >
                              {c.status}
                            </span>
                          </div>
                        </div>

                        {createdLabel ? (
                          <div className="mt-1 text-xs text-neutral-400">
                            {createdLabel}
                          </div>
                        ) : null}

                        <div className="mt-2 text-xs text-neutral-400">id: {c.id}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Work lane (always visible) */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-b border-neutral-800/60 bg-neutral-950/40 px-6 py-4">
              <div className="text-xs text-neutral-400">Run</div>
              <div className="mt-1 text-sm font-semibold text-neutral-100">
                {activeTopic ? activeTopic.title : "—"}
                {activeChapterId ? " / " + activeChapterId : ""}
              </div>
            </header>

            {!activeTopicId || !activeChapterId ? (
              <div className="flex-1 p-6 text-sm text-neutral-300">
                Select a topic to load its open chapter.
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <ActiveRun
                  topicId={activeTopicId}
                  chapterId={activeChapterId}
                  activeRunId={activeRunId}
                  onRunStarted={() => {}}
                />
                <div className="min-h-0 flex-1 overflow-auto">
                  <MessageList
                    topicId={activeTopicId}
                    chapterId={activeChapterId}
                    runId={activeRunId ?? undefined}
                  />
                </div>
                <MessageComposer
                  topicId={activeTopicId}
                  chapterId={activeChapterId}
                  runId={activeRunId ?? undefined}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
