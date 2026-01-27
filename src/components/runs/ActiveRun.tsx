"use client";

import { useEffect, useRef } from "react";
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

  const creatingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (activeRunId) return;

    // Wait for initial snapshot load
    if (runs === null) return;

    // If any run exists, page will adopt newest via derivedRunId
    if (runs.length > 0) return;

    if (creatingRef.current) return;
    creatingRef.current = true;

    (async () => {
      const runId = await createRun({
        topicId: topicId as string,
        chapterId: chapterId as string,
      });
      onRunStarted?.(runId);
    })();
  }, [enabled, runs, activeRunId, topicId, chapterId, onRunStarted]);

  return null;
}
