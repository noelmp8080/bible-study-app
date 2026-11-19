// Family table data access. Households are shared between accounts, so these
// tables are read straight from Supabase (online only) instead of the local
// store; who may see what is decided by the membership policies and the
// SECURITY DEFINER functions in supabase/migrations/…_phase10_households.sql.
import { supabase } from "./supabase.js";

const missing = (e) => ["42P01", "PGRST205", "PGRST202", "42883"].includes(e?.code) || /could not find the (table|function)/i.test(e?.message || "");

export class HouseholdError extends Error {
  constructor(message, { notInstalled = false } = {}) { super(message); this.notInstalled = notInstalled; }
}
function check(error) {
  if (!error) return;
  if (missing(error)) throw new HouseholdError("Family table needs a database update that has not been run yet.", { notInstalled: true });
  throw new HouseholdError(error.message);
}

/** The signed-in user's household, members, pending invites, and invites addressed to them. */
export async function loadHousehold(userId) {
  const mine = await supabase.from("household_members").select("household_id, role, display_name, households(id, name, created_by)").eq("user_id", userId).limit(1);
  check(mine.error);
  const invites = await supabase.from("household_invites").select("household_id, email, households(name)");
  check(invites.error);
  const membership = mine.data?.[0];
  if (!membership) return { household: null, invitations: invites.data || [] };
  const household = membership.households;
  const [members, plan] = await Promise.all([
    supabase.from("household_members").select("user_id, display_name, role").eq("household_id", household.id).order("display_name"),
    supabase.from("user_plans").select("*").eq("household_id", household.id).eq("active", true).order("started_on", { ascending: false }).limit(1),
  ]);
  check(members.error); check(plan.error);
  return {
    household, role: membership.role, members: members.data || [], plan: plan.data?.[0] || null,
    pending: (invites.data || []).filter((i) => i.household_id === household.id),
    invitations: (invites.data || []).filter((i) => i.household_id !== household.id),
  };
}

export async function createHousehold(name, displayName) {
  const { error } = await supabase.rpc("create_household", { p_name: name, p_display_name: displayName });
  check(error);
}
export async function acceptInvite(householdId, displayName) {
  const { error } = await supabase.rpc("accept_household_invite", { p_household: householdId, p_display_name: displayName });
  check(error);
}
export async function invite(householdId, email) {
  const { error } = await supabase.from("household_invites").insert({ household_id: householdId, email: email.trim().toLowerCase() });
  check(error);
}
export async function cancelInvite(householdId, email) {
  const { error } = await supabase.from("household_invites").delete().match({ household_id: householdId, email });
  check(error);
}

/** Who has read day `dayIndex` (zero-based) of the shared plan: [{ user_id, display_name, has_read }]. */
export async function readStatus(householdId, dayIndex) {
  const { data, error } = await supabase.rpc("household_read_status", { p_household: householdId, p_day: dayIndex });
  check(error);
  return data || [];
}

/** Start a shared plan. The days are stored on the row so the database can tell which chapters are "tonight's". */
export async function startSharedPlan(householdId, planKey, days, startedOn) {
  const off = await supabase.from("user_plans").update({ active: false }).eq("household_id", householdId).eq("active", true);
  check(off.error);
  const { error } = await supabase.from("user_plans").insert({ household_id: householdId, plan_key: planKey, custom_readings: days, started_on: startedOn, active: true });
  check(error);
}

export async function getQuestions(householdId, passage, day) {
  const { data, error } = await supabase.from("household_questions").select("questions").match({ household_id: householdId, passage, day }).maybeSingle();
  check(error);
  return data?.questions || null;
}
/** Save questions. With `replace` false the first writer wins, so everyone sees the same set. */
export async function saveQuestions(householdId, passage, day, questions, replace) {
  const { error } = await supabase.from("household_questions")
    .upsert({ household_id: householdId, passage, day, questions }, { onConflict: "household_id,passage,day", ignoreDuplicates: !replace });
  check(error);
  return getQuestions(householdId, passage, day);
}
