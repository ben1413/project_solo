"use client";

import React, { useState, useCallback } from "react";

interface Chapter {
  id: string;
  name?: string;
  title?: string;
  createdAt?: unknown;
}

interface ChapterListProps {
  chapters: Chapter[];
  activeChapterId?: string;
  onSelectChapter: (chapterId: string) => void;
  onRenameChapter: (chapterId: string, newName: string) => void | Promise<void>;
  onDeleteChapter: (chapterId: string) => void;
}

export const ChapterList = ({
  chapters,
  activeChapterId,
  onSelectChapter,
  onRenameChapter,
  onDeleteChapter,
}: ChapterListProps) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [saving, setSaving] = useState(false);

  const startRename = useCallback((e: React.MouseEvent, chapter: Chapter) => {
    e.stopPropagation();
    setRenamingId(chapter.id);
    setRenameValue(chapter.name ?? chapter.title ?? "");
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setSaving(false);
  }, []);

  const submitRename = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!renamingId || !renameValue.trim()) {
        cancelRename();
        return;
      }
      setSaving(true);
      try {
        await Promise.resolve(onRenameChapter(renamingId, renameValue.trim()));
        setRenamingId(null);
      } catch {
        // keep form open on error
      } finally {
        setSaving(false);
      }
    },
    [renamingId, renameValue, onRenameChapter, cancelRename]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") cancelRename();
      if (e.key === "Enter") submitRename();
    },
    [cancelRename, submitRename]
  );

  const handleRowClick = useCallback(
    async (chapterId: string) => {
      if (renamingId && renamingId !== chapterId && renameValue.trim()) {
        setSaving(true);
        try {
          await Promise.resolve(onRenameChapter(renamingId, renameValue.trim()));
          setRenamingId(null);
        } catch {
          // keep form open on error
        } finally {
          setSaving(false);
        }
      } else if (renamingId && renamingId !== chapterId) {
        cancelRename();
      }
      onSelectChapter(chapterId);
    },
    [renamingId, renameValue, onRenameChapter, cancelRename, onSelectChapter]
  );

  return (
    <aside className="flex h-full flex-col bg-transparent pt-6">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-1">
        {chapters.map((chapter, index) => {
          const isActive = activeChapterId === chapter.id;
          const isRenaming = renamingId === chapter.id;
          const displayName = chapter.name ?? chapter.title ?? `Chapter ${chapters.length - index}`;

          if (isRenaming) {
            return (
              <form
                key={chapter.id}
                onSubmit={submitRename}
                className="w-full px-5 py-3 rounded-full bg-[var(--panel)] border border-white/20 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={saving}
                    className="flex-1 min-w-0 bg-transparent text-[var(--text-blue)] text-sm outline-none font-medium placeholder:text-[var(--text-blue)]/50"
                    placeholder="Chapter name"
                  />
                  <button
                    type="submit"
                    disabled={saving || !renameValue.trim()}
                    className="shrink-0 rounded-full p-1.5 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Accept change"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    className="shrink-0 rounded-full p-1.5 text-[var(--text-blue)]/70 hover:text-[var(--text-blue)] hover:bg-white/10 transition-colors"
                    title="Cancel"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </form>
            );
          }

          return (
            <div
              key={chapter.id}
              onClick={() => handleRowClick(chapter.id)}
              className={`group relative w-full text-left px-5 py-3 rounded-full text-[14px] font-medium transition-all duration-200 cursor-pointer flex items-center min-h-[44px] gap-2 ${
                isActive
                  ? "bg-white/10 text-[var(--text-blue)] shadow-lg shadow-white/5"
                  : "bg-transparent text-[var(--text-blue)] hover:bg-white/5"
              }`}
            >
              <div className="truncate flex-1 min-w-0">{displayName}</div>
              <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => startRename(e, chapter)}
                  className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-blue)]/80 hover:text-[var(--text-blue)]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete?")) onDeleteChapter(chapter.id);
                  }}
                  className={`text-[10px] font-bold ${isActive ? "text-red-200/80 hover:text-red-200" : "text-red-500/60 hover:text-red-300"}`}
                >
                  X
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
