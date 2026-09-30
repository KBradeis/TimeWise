/* ==========================================================================
   TimeWise — product-insights API (admin only)
   Imported by server/accounts.js, which has already confirmed the caller is
   a signed-in admin (role read from the database) before calling in here.

   Feedback → Problem → Experiment → Decision, following PRODUCT_LOOP.md:
     GET    /api/admin/insights            overview + problems + experiments + decisions
     POST   /api/admin/problems            create     PATCH /api/admin/problems/:id
     POST   /api/admin/experiments         create     PATCH /api/admin/experiments/:id
     POST   /api/admin/decisions           create     PATCH /api/admin/decisions/:id
     POST   /api/admin/observations        log a manual observation (source = 'observation')

   Every text field is length-limited, every choice is checked against a
   fixed list, and all SQL is parameterized. Column names in the dynamic
   UPDATE statements only ever come from the fixed field lists below.
   ========================================================================== */

const LEVEL = ["unknown", "low", "moderate", "high"];
export const PROBLEM_STATUSES = ["new", "investigating", "needs_research", "planned", "in_development",
  "testing", "validated", "rejected", "deferred"];
const PRIORITIES = ["unset", "now", "next", "later", "do_not_build"];
const DECISIONS = ["pending", "keep", "iterate", "revert", "inconclusive"];
export const JOURNEY_STAGES = ["first_impression", "onboarding", "creating_schedule", "adding_commitments",
  "planning", "prioritizing", "completing_work", "adjusting_plans", "reviewing_progress", "returning", "other"];
export const FEEDBACK_SOURCES = ["real", "observation", "test", "automated"];

// field name in the API → [column, kind, limit or allowed values]
const T = (n) => ["text", n];
const PROBLEM_FIELDS = {
  title: ["title", "required", 120], theme: ["theme", ...T(60)],
  psUser: ["ps_user", ...T(1000)], psSituation: ["ps_situation", ...T(1000)],
  psProblem: ["ps_problem", ...T(1000)], psImpact: ["ps_impact", ...T(1000)],
  known: ["known", ...T(3000)], interpretation: ["interpretation", ...T(3000)], unknowns: ["unknowns", ...T(3000)],
  sevFrequency: ["sev_frequency", "enum", LEVEL], sevImpact: ["sev_impact", "enum", LEVEL],
  sevReach: ["sev_reach", "enum", LEVEL], sevCore: ["sev_core", "enum", LEVEL],
  sevConfidence: ["sev_confidence", "enum", LEVEL], severityReasoning: ["severity_reasoning", ...T(2000)],
  userNeed: ["user_need", ...T(1000)], opportunity: ["opportunity", ...T(1000)],
  potentialSolutions: ["potential_solutions", ...T(2000)], smallestChange: ["smallest_change", ...T(1000)],
  risk: ["risk", ...T(1000)], priority: ["priority", "enum", PRIORITIES], status: ["status", "enum", PROBLEM_STATUSES]
};
const EXPERIMENT_FIELDS = {
  title: ["title", "required", 120], problemId: ["problem_id", "ref", "problems"],
  hypothesis: ["hypothesis", ...T(1500)], changeDesc: ["change_desc", ...T(1500)], targetUsers: ["target_users", ...T(500)],
  expectedBehavior: ["expected_behavior", ...T(1500)], successEvidence: ["success_evidence", ...T(1500)],
  failureEvidence: ["failure_evidence", ...T(1500)], nextDecision: ["next_decision", ...T(1500)],
  beforeState: ["before_state", ...T(2000)], afterState: ["after_state", ...T(2000)], actualResult: ["actual_result", ...T(2000)],
  startedOn: ["started_on", "date"], endedOn: ["ended_on", "date"], decision: ["decision", "enum", DECISIONS]
};
const DECISION_FIELDS = {
  title: ["title", "required", 120], decidedOn: ["decided_on", "date"],
  problemId: ["problem_id", "ref", "problems"], experimentId: ["experiment_id", "ref", "experiments"],
  problemText: ["problem_text", ...T(2000)], evidence: ["evidence", ...T(3000)], interpretation: ["interpretation", ...T(3000)],
  optionsConsidered: ["options_considered", ...T(3000)], decisionMade: ["decision_made", ...T(2000)],
  reason: ["reason", ...T(3000)], result: ["result", ...T(3000)], learned: ["learned", ...T(3000)],
  nextDecision: ["next_decision", ...T(2000)]
};
const RESOURCES = {
  problems: { table: "problems", fields: PROBLEM_FIELDS },
  experiments: { table: "experiments", fields: EXPERIMENT_FIELDS },
  decisions: { table: "decisions", fields: DECISION_FIELDS }
};

export async function handleInsightsApi(request, env, url, admin, helpers) {
  const { json, readJson, audit } = helpers;
  const path = url.pathname;
  const method = request.method;

  if (path === "/api/admin/insights" && method === "GET") return json(await insightsSnapshot(env));

  if (path === "/api/admin/observations" && method === "POST") {
    const body = await readJson(request, 10000);
    if (!body) return json({ error: "bad_request" }, 400);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 2000) return json({ error: "bad_message" }, 400);
    if (!["worked_well", "confusing", "broken", "idea"].includes(body.category)) return json({ error: "bad_category" }, 400);
    if (!helpers.FEEDBACK_FEATURES.includes(body.feature)) return json({ error: "bad_feature" }, 400);
    const stage = body.journeyStage || null;
    if (stage !== null && !JOURNEY_STAGES.includes(stage)) return json({ error: "bad_stage" }, 400);
    const userType = body.userType ? String(body.userType).trim().slice(0, 60) : null;
    const problemId = await validRef(env, "problems", body.problemId);
    if (problemId === false) return json({ error: "bad_problem" }, 400);
    const row = await env.DB.prepare(
      `INSERT INTO feedback (user_id, category, feature, page, message, source, journey_stage, user_type, problem_id)
       VALUES (NULL, ?1, ?2, 'observation', ?3, 'observation', ?4, ?5, ?6) RETURNING id`
    ).bind(body.category, body.feature, message, stage, userType, problemId).first();
    await audit(admin.id, "observation.create", String(row.id));
    return json({ ok: true, id: row.id });
  }

  const match = path.match(/^\/api\/admin\/(problems|experiments|decisions)(?:\/(\d{1,10}))?$/);
  if (match) {
    const resource = RESOURCES[match[1]];
    const id = match[2] ? Number(match[2]) : null;
    if (method === "POST" && id === null) return createRecord(request, env, admin, resource, match[1], helpers);
    if (method === "PATCH" && id !== null) return updateRecord(request, env, admin, resource, match[1], id, helpers);
  }
  return null;
}

/* ---------- Generic create / update driven by the field lists ---------- */

async function cleanFields(env, body, fields, requireTitle) {
  const cols = [];
  const vals = [];
  for (const [key, spec] of Object.entries(fields)) {
    if (!(key in body)) continue;
    const [column, kind, rule] = spec;
    let v = body[key];
    if (kind === "required" || kind === "text") {
      if (v === null || v === "") {
        if (kind === "required") return { error: "title_required" };
        v = null;
      } else if (typeof v !== "string") {
        return { error: "bad_" + key };
      } else {
        v = v.trim();
        if (v.length > rule) return { error: key + "_too_long" };
        if (!v) { if (kind === "required") return { error: "title_required" }; v = null; }
      }
    } else if (kind === "enum") {
      if (!rule.includes(v)) return { error: "bad_" + key };
    } else if (kind === "date") {
      if (v === null || v === "") v = null;
      else if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v + "T00:00:00Z"))) return { error: "bad_" + key };
    } else if (kind === "ref") {
      v = await validRef(env, rule, v);
      if (v === false) return { error: "bad_" + key };
    }
    cols.push(column);
    vals.push(v);
  }
  if (requireTitle && !cols.includes("title")) return { error: "title_required" };
  return { cols, vals };
}

async function createRecord(request, env, admin, resource, name, helpers) {
  const { json, readJson, audit } = helpers;
  const body = await readJson(request, 40000);
  if (!body) return json({ error: "bad_request" }, 400);
  const clean = await cleanFields(env, body, resource.fields, true);
  if (clean.error) return json({ error: clean.error }, 400);
  const placeholders = clean.cols.map((_, i) => "?" + (i + 1)).join(", ");
  const row = await env.DB.prepare(
    `INSERT INTO ${resource.table} (${clean.cols.join(", ")}) VALUES (${placeholders}) RETURNING id`
  ).bind(...clean.vals).first();
  await audit(admin.id, name.slice(0, -1) + ".create", String(row.id));
  return json({ ok: true, id: row.id });
}

async function updateRecord(request, env, admin, resource, name, id, helpers) {
  const { json, readJson, audit } = helpers;
  const body = await readJson(request, 40000);
  if (!body) return json({ error: "bad_request" }, 400);
  const clean = await cleanFields(env, body, resource.fields, false);
  if (clean.error) return json({ error: clean.error }, 400);
  if (!clean.cols.length) return json({ error: "nothing_to_update" }, 400);
  const sets = clean.cols.map((c, i) => c + " = ?" + (i + 1));
  const row = await env.DB.prepare(
    `UPDATE ${resource.table} SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?${clean.cols.length + 1} RETURNING id`
  ).bind(...clean.vals, id).first();
  if (!row) return json({ error: "not_found" }, 404);
  const detail = clean.cols.includes("status") ? "status=" + clean.vals[clean.cols.indexOf("status")]
    : clean.cols.includes("decision") ? "decision=" + clean.vals[clean.cols.indexOf("decision")] : clean.cols.join(",").slice(0, 200);
  await audit(admin.id, name.slice(0, -1) + ".update", String(id), detail);
  return json({ ok: true });
}

// null/"" → null (no link); a valid existing id → that id; anything else → false
async function validRef(env, table, value) {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 1e9) return false;
  const row = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?1`).bind(id).first(); // table from fixed list
  return row ? id : false;
}

/* ---------- Snapshot for the dashboard ---------- */

async function insightsSnapshot(env) {
  const [counts, problems, experiments, decisions] = await env.DB.batch([
    env.DB.prepare(
      `SELECT
         SUM(CASE WHEN source = 'real' THEN 1 ELSE 0 END) AS real_total,
         SUM(CASE WHEN source = 'real' AND status = 'new' THEN 1 ELSE 0 END) AS real_new,
         SUM(CASE WHEN source = 'real' AND problem_id IS NULL THEN 1 ELSE 0 END) AS real_unlinked,
         SUM(CASE WHEN source = 'observation' THEN 1 ELSE 0 END) AS observations,
         SUM(CASE WHEN source IN ('test', 'automated') THEN 1 ELSE 0 END) AS excluded
       FROM feedback`),
    env.DB.prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM feedback f WHERE f.problem_id = p.id AND f.source = 'real') AS real_feedback,
         (SELECT COUNT(DISTINCT f.user_id) FROM feedback f WHERE f.problem_id = p.id AND f.source = 'real' AND f.user_id IS NOT NULL) AS real_testers,
         (SELECT COUNT(*) FROM feedback f WHERE f.problem_id = p.id AND f.source = 'observation') AS observations,
         (SELECT COUNT(*) FROM feedback f WHERE f.problem_id = p.id AND f.source IN ('test', 'automated')) AS excluded
       FROM problems p ORDER BY p.updated_at DESC LIMIT 300`),
    env.DB.prepare("SELECT * FROM experiments ORDER BY id DESC LIMIT 300"),
    env.DB.prepare("SELECT * FROM decisions ORDER BY COALESCE(decided_on, created_at) DESC, id DESC LIMIT 300")
  ]);
  const c = (counts.results || [])[0] || {};
  const list = problems.results || [];
  const by = (statuses) => list.filter((p) => statuses.includes(p.status)).length;
  return {
    overview: {
      realFeedback: c.real_total || 0,
      newRealFeedback: c.real_new || 0,
      unlinkedRealFeedback: c.real_unlinked || 0,
      observations: c.observations || 0,
      excludedTestItems: c.excluded || 0,
      openProblems: by(["new", "investigating", "needs_research", "planned", "in_development", "testing"]),
      investigating: by(["investigating", "needs_research"]),
      implemented: by(["testing", "validated"]),
      awaitingValidation: by(["testing"]),
      validated: by(["validated"])
    },
    problems: list,
    experiments: experiments.results || [],
    decisions: decisions.results || []
  };
}
