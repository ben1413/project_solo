"use client";

import { useEffect, useState } from "react";
import { renameChapter } from "@/lib/chapters/renameChapter";

type ChapterTitleProps = {
  topicId: string;
  chapterId: string;
  title: string;
  disabled?: boolean;
  onRenamed?: (nextTitle: string) => void;
};

export function ChapterTitle(props: ChapterTitleProps) {
  const { topicId, chapterId, title, disabled, onRenamed } = props;

  const [value, setValue] = useState(title);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keep local input in sync if parent title changes (e.g. from snapshots)
  useEffect(() => {
    if (!editing) setValue(title);
  }, [title, editing]);

  async function commit() {
    if (disabled) return;

    const next = value.trim();
    if (!next) {
      setValue(title);
      setEditing(false);
      return;
    }
    if (next === title) {
      setEditing(false);
      return;
    }

    const prev = title;

    // Optimistically update UI via parent, so it "sticks" immediately.
    onRenamed?.(next);

    setSaving(true);
    try {
      await renameChapter({ topicId, chapterId, title: next });
      setEditing(false);
    } catch {
      // Revert optimistic change on failure.
      onRenamed?.(prev);
      setValue(prev);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className="text-left w-full"
        title="Rename chapter"
      >
        {title}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setValue(title);
          setEditing(false);
        }
      }}
      disabled={saving}
      className="w-full rounded-md border px-2 py-1 text-sm"
    />
  );
}
