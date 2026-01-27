"use client";

import { useEffect } from "react";
import { createRun } from "@/lib/runs/createRun";
import { useRuns } from "@/lib/runs/useRuns";

type ActiveRunProps = {
  topicId?: string;
  chapterId?: string;
  activeRunId?: string | null;
  onRunStarted?: (runId: string) => void;
};

export function ActiveRun(props: ActiveRunProps) {
  const { topicId, chapterId, activeRunId, onRunStarted } = props;
  const { runs, enabled } = useRuns({ topicId, chapterId });

  useEffect(() => {
    if (!enabled) return;
    if (activeRunId) return;
    if (!runs || runs.length > 0) return;

    (async () => {
      const runId = await createRun({
        topicId: topicId as string,
        chapterId: chapterId as string,
      });
      onRunStarted?.(runId);
    })();
  }, [enabled, runs, activeRunId, topicId, chapterId, onRunStarted]);

  if (!enabled) return null;

  return null;
}
