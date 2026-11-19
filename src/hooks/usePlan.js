import { useMemo } from "react";
import { useTable } from "./useData.js";
import { activePlan, planName, planState } from "../lib/plans.js";
import { chapterKey } from "../lib/books.js";

/** The user's active plan and where it stands ({ plan: null } when there is none). */
export function useActivePlan() {
  const plans = useTable("user_plans");
  const progress = useTable("reading_progress");
  return useMemo(() => {
    const plan = activePlan(plans);
    return { plan, state: plan ? planState(plan, progress) : null, name: planName(plan) };
  }, [plans, progress]);
}

/** Set of "Book|chapter" keys the user has marked read. */
export function useReadSet() {
  const progress = useTable("reading_progress");
  return useMemo(() => new Set(progress.map((r) => chapterKey(r.book, r.chapter))), [progress]);
}
