import { getRows, patch, put } from "./store.js";
import { isoDate } from "./format.js";

/** Start a plan today and make it the only active personal plan. */
export function startPlan(row) {
  for (const p of getRows("user_plans")) if (p.active && !p.household_id) patch("user_plans", p.id, { active: false });
  return put("user_plans", { household_id: null, custom_readings: null, started_on: isoDate(), active: true, ...row });
}
