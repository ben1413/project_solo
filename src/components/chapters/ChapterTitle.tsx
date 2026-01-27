"use client";

import { useState } from "react";
import { renameChapter } from "@/lib/chapters/renameChapter";

type ChapterTitleProps = {
  topicId: string;
  chapterId: string;
  title: string;
  disabled?: boolean;
};

export function ChapterTitle(props: ChapterTitleProps) {
  const { topicId, chapterId, title, disabled } = props;
  const [value, setValue] = useState(title);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function commit() {
    if (disabled) return;
    const next = value.trim();
    if (!next || next === title) {
      setEditing(false);
      setValue(title);
      return;
    }
    setSaving(true);
    try {
      await renameChapter({ topicId, chapterId, title: next });
    } finally {
      setSaving(false);
      setEditing(false);
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
