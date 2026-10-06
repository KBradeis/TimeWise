/* ==========================================================================
   TimeWise — Admin dashboard (admin.html)
   Feedback → Evidence → Problem → Experiment → Decision (see PRODUCT_LOOP.md).

   Every number and list comes from /api/admin/*, which the server only
   answers for accounts whose role is 'admin' in the database. Hiding this
   page from the menu is a convenience, not the protection.

   Evidence rules built into this page:
   - Headline numbers count REAL tester feedback only. Manual observations
     are shown separately; test and automated items are never counted.
   - Testers appear as anonymous account codes (T-xxxxx). A code is one
     account, not a verified unique person.
   - Anything we don't know is shown as "Unknown / Not enough evidence".
   ========================================================================== */
(function () {
  "use strict";

  var root = document.getElementById("adminRoot");
  if (!root || !window.TimeWise) return;

  var UNKNOWN = "Unknown / Not enough evidence";
  var CATEGORY = [["worked_well", "👍 Worked well"], ["confusing", "🤔 Confusing"], ["broken", "🐞 Didn't work"], ["idea", "💡 Idea"]];
  var FEATURE = [["home", "Home"], ["the_idea", "The Idea"], ["your_week", "Your week"], ["calendars", "Calendars"], ["replan", "Replan"],
    ["reflect", "Plan vs. Reality"], ["practice", "Practice"], ["early_access", "Early access"], ["account", "My account"], ["other", "Other"]];
  var FB_STATUS = [["new", "New"], ["reviewing", "Reviewing"], ["resolved", "Resolved"]];
  var SOURCE = [["real", "Real tester feedback"], ["observation", "Manual observation"], ["test", "Test data"], ["automated", "Automated test"]];
  var SOURCE_SHORT = { real: "Real", observation: "Observation", test: "Test", automated: "Automated" };
  var STAGE = [["first_impression", "First impression"], ["onboarding", "Sign-up / onboarding"], ["creating_schedule", "Creating a schedule"],
    ["adding_commitments", "Adding tasks / commitments"], ["planning", "Planning"], ["prioritizing", "Prioritizing"],
    ["completing_work", "Completing work"], ["adjusting_plans", "Adjusting plans"], ["reviewing_progress", "Reviewing progress"],
    ["returning", "Returning to the app"], ["other", "Other"]];
  // Best guess when an admin hasn't set a stage — always labeled "inferred"
  var STAGE_FROM_FEATURE = { home: "first_impression", the_idea: "first_impression", early_access: "first_impression",
    your_week: "creating_schedule", calendars: "adding_commitments", replan: "adjusting_plans", reflect: "reviewing_progress",
    account: "returning", practice: "other", other: "other" };
  var STATUS = [
    ["new", "New", "Logged; nobody has reviewed the evidence yet."],
    ["investigating", "Investigating", "Actively reviewing the feedback and evidence."],
    ["needs_research", "Needs more research", "Not enough evidence to decide — needs interviews, a usability test, or more feedback."],
    ["planned", "Planned", "Decided to address it; work hasn't started."],
    ["in_development", "In development", "The change is being built."],
    ["testing", "Testing", "The change is live and an experiment is collecting evidence."],
    ["validated", "Validated", "Evidence shows the change helped."],
    ["rejected", "Rejected", "Decided not to address it — the reason is in the decision log."],
    ["deferred", "Deferred", "A real problem, but not a priority now; revisit later."]
  ];
  var PRIORITY = [["unset", "Not set"], ["now", "Now"], ["next", "Next"], ["later", "Later"], ["do_not_build", "Do not build yet"]];
  var LEVEL = [["unknown", "Unknown"], ["low", "Low"], ["moderate", "Moderate"], ["high", "High"]];
  var DECISION = [["pending", "Pending"], ["keep", "Keep"], ["iterate", "Iterate"], ["revert", "Revert"], ["inconclusive", "Inconclusive"]];
  var DEMO_FEATURES = [
    ["calendar_google", "Connected Google Calendar"], ["calendar_notion", "Connected Notion"], ["calendar_ics", "Uploaded a calendar file"],
    ["event_added", "Added an event by hand"], ["replan_used", "Tried Replan my day"], ["replan_applied", "Applied a replan"],
    ["reflection_viewed", "Saw a reflection"], ["reflection_step_added", "Added a suggested next step"],
    ["quiz_completed", "Finished the practice quiz"], ["waitlist_joined", "Answered the early-access form"], ["feedback_sent", "Sent feedback"],
    ["week_copied", "Copied last week's plan"], ["colors_customized", "Customized calendar colors"],
    ["repeat_used", "Added a repeating class"], ["setup_started", "Started \"Set up my week\""]
  ];
  var label = function (list, key) { var m = list.filter(function (x) { return x[0] === key; })[0]; return m ? m[1] : (key || "—"); };

  var state = { overview: null, insights: null, feedback: [], selected: {}, filters: { source: "real", status: "", category: "", feature: "", problem: "" } };

  /* ---------- small helpers ---------- */
  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function api(url, options) {
    return fetch(url, Object.assign({ credentials: "same-origin" }, options || {})).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
    });
  }
  function send(method, url, body) {
    return api(url, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  function when(value) {
    if (!value) return "—";
    var d = new Date(String(value).replace(" ", "T") + "Z");
    return isNaN(d) ? value : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function day(value) { return value ? String(value).slice(0, 10) : "—"; }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function card(title, sub, id) {
    var c = el("section", "results-card");
    if (id) c.id = id;
    if (title) c.appendChild(el("h2", null, title));
    if (sub) c.appendChild(el("p", "sub", sub));
    return c;
  }
  function select(options, value, allLabel) {
    var s = el("select");
    if (allLabel !== undefined) { var a = el("option", null, allLabel); a.value = ""; s.appendChild(a); }
    options.forEach(function (o) { var opt = el("option", null, o[1]); opt.value = o[0]; s.appendChild(opt); });
    s.value = value == null ? "" : String(value);
    return s;
  }
  function field(labelText, control, hint) {
    var l = el("label", "quick-add-field insight-field");
    l.appendChild(el("span", null, labelText));
    l.appendChild(control);
    if (hint) l.appendChild(el("small", "insight-hint", hint));
    return l;
  }
  function textarea(value, rows, max, placeholder) {
    var t = el("textarea");
    t.rows = rows || 2;
    t.maxLength = max || 2000;
    t.value = value || "";
    if (placeholder) t.placeholder = placeholder;
    return t;
  }
  function input(value, max, placeholder, type) {
    var i = el("input");
    i.type = type || "text";
    if (max) i.maxLength = max;
    i.value = value || "";
    if (placeholder) i.placeholder = placeholder;
    return i;
  }
  function bars(rows, total, unit) {
    var ul = el("ul", "bars");
    if (!total) { ul.appendChild(el("li", "empty-note", "Nothing yet.")); return ul; }
    rows.forEach(function (row) {
      var share = pct(row[1], total);
      var li = el("li", "bar-row");
      li.title = row[0] + ": " + row[1] + " " + unit + (row[2] ? " — " + row[2] : "");
      li.appendChild(el("span", "bar-label", row[0]));
      li.appendChild(el("span", "bar-value", (row[2] ? row[2] + "  ·  " : "") + row[1]));
      var track = el("span", "bar-track");
      track.setAttribute("aria-hidden", "true");
      var fill = el("span", "bar-fill" + (row[1] ? "" : " is-zero"));
      fill.style.width = share + "%";
      track.appendChild(fill);
      li.appendChild(track);
      ul.appendChild(li);
    });
    return ul;
  }
  function kpi(value, name, note) {
    var d = el("div", "kpi");
    d.appendChild(el("div", "kpi-value", String(value)));
    d.appendChild(el("div", "kpi-label", name));
    d.appendChild(el("div", "kpi-note", note || ""));
    return d;
  }
  function badge(text, cls) { return el("span", "fb-badge " + (cls || ""), text); }
  function saveRow(onSave) {
    var wrap = el("div", "insight-save");
    var btn = el("button", "btn btn-primary btn-small", "Save");
    btn.type = "button";
    var msg = el("span", "admin-save-msg");
    msg.setAttribute("aria-live", "polite");
    btn.addEventListener("click", function () {
      btn.disabled = true;
      msg.textContent = "Saving…";
      msg.className = "admin-save-msg";
      onSave().then(function (r) {
        btn.disabled = false;
        if (r.ok) { msg.textContent = "✓ Saved"; }
        else { msg.textContent = "Couldn't save (" + (r.body.error || r.status) + ")"; msg.className = "admin-save-msg is-error"; }
      });
    });
    wrap.appendChild(btn);
    wrap.appendChild(msg);
    return wrap;
  }
  function problemOptions() {
    return (state.insights ? state.insights.problems : []).map(function (p) { return [String(p.id), "P-" + p.id + " · " + p.title]; });
  }
  function problemById(id) {
    return (state.insights ? state.insights.problems : []).filter(function (p) { return p.id === id; })[0] || null;
  }
  function evidenceLine(p) {
    var bits = [p.real_feedback + " real feedback", p.real_testers + " tester account" + (p.real_testers === 1 ? "" : "s"), p.observations + " observation" + (p.observations === 1 ? "" : "s")];
    if (p.excluded) bits.push(p.excluded + " test item" + (p.excluded === 1 ? "" : "s") + " excluded");
    return bits.join(" · ");
  }
  function copyText(text, statusEl) {
    function fallback() {
      var ta = textarea(text, 10, 1000000);
      ta.className = "insight-copy-fallback";
      ta.readOnly = true;
      statusEl.textContent = "Copying isn't allowed here — select the text below and copy it.";
      statusEl.after(ta);
      ta.select();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { statusEl.textContent = "✓ Copied — paste it into your chat with Claude."; }, fallback);
    } else fallback();
  }

  /* ---------- export formats (PRODUCT_LOOP.md / prompt §17, §26) ---------- */
  function feedbackRecord(f) {
    var p = f.problem_id ? problemById(f.problem_id) : null;
    var stage = f.journey_stage ? label(STAGE, f.journey_stage)
      : label(STAGE, STAGE_FROM_FEATURE[f.feature]) + " (inferred from \"" + label(FEATURE, f.feature) + "\"; not confirmed)";
    var sourceText = {
      real: "Real user feedback (in-app form, signed-in tester)",
      observation: "Manual observation logged by an admin",
      test: "TEST DATA — not real user evidence",
      automated: "AUTOMATED TEST DATA — not real user evidence"
    }[f.source];
    var lines = [
      "Feedback ID: FB-" + f.id,
      "Date: " + day(f.created_at),
      "Source: " + sourceText,
      "User Type: " + (f.user_type || UNKNOWN),
      "Journey Stage: " + stage,
      "",
      "Original Feedback: \"" + f.message + "\"",
      "",
      "Tester-selected type: " + label(CATEGORY, f.category).replace(/^\S+ /, ""),
      "Part of site: " + label(FEATURE, f.feature) + (f.page && f.page !== "observation" ? " (page " + f.page + ")" : ""),
      "Rating: " + (f.rating ? f.rating + "/5" : "Not given"),
      "Anonymous tester code: " + f.tester + (f.source === "real" ? " (one account — not a verified unique person)" : ""),
      "Linked problem: " + (p ? "P-" + p.id + " \"" + p.title + "\" (status: " + label(STATUS, p.status) + ")" : "None"),
      "Admin notes: " + (f.admin_notes || "None"),
      "",
      "Observed Problem: " + UNKNOWN,
      "Underlying User Need: " + (p && p.user_need ? p.user_need : UNKNOWN),
      "Category: " + UNKNOWN,
      "Theme: " + (p && p.theme ? p.theme : UNKNOWN),
      "Evidence Strength: " + UNKNOWN,
      "Frequency: " + UNKNOWN,
      "Impact: " + UNKNOWN,
      "Affected Users: " + UNKNOWN,
      "Possible Root Cause: " + UNKNOWN,
      "Potential Solutions: " + (p && p.potential_solutions ? p.potential_solutions : UNKNOWN),
      "Smallest Useful Change: " + (p && p.smallest_change ? p.smallest_change : UNKNOWN),
      "Priority: " + (p ? label(PRIORITY, p.priority) : UNKNOWN),
      "Status: " + label(FB_STATUS, f.status) + " (feedback item)",
      "Hypothesis: " + UNKNOWN,
      "Validation Method: " + UNKNOWN,
      "Result: " + UNKNOWN,
      "Next Decision: " + UNKNOWN
    ];
    return lines.join("\n");
  }
  function exportHeader(items) {
    var counts = { real: 0, observation: 0, test: 0, automated: 0 };
    items.forEach(function (f) { counts[f.source]++; });
    return [
      "TIMEWISE FEEDBACK EXPORT — " + new Date().toISOString().slice(0, 10),
      items.length + " item(s): " + counts.real + " real tester feedback, " + counts.observation + " manual observation(s), " +
        counts.test + " test, " + counts.automated + " automated.",
      "Test and automated items are NOT evidence of real user experience.",
      "Tester codes are anonymous account codes, not verified unique people. Fields marked \"" + UNKNOWN + "\" have not been analyzed yet.",
      "Please analyze this using the TimeWise User Feedback & Product Improvement process.",
      "", "==========", ""
    ].join("\n");
  }
  function problemRecord(p) {
    return [
      "Problem P-" + p.id + ": " + p.title,
      "Theme: " + (p.theme || UNKNOWN) + " · Priority: " + label(PRIORITY, p.priority) + " · Status: " + label(STATUS, p.status),
      "Evidence: " + evidenceLine(p),
      "USER: " + (p.ps_user || UNKNOWN), "SITUATION: " + (p.ps_situation || UNKNOWN),
      "PROBLEM: " + (p.ps_problem || UNKNOWN), "IMPACT: " + (p.ps_impact || UNKNOWN),
      "What we know: " + (p.known || UNKNOWN), "What we think: " + (p.interpretation || UNKNOWN), "What we don't know: " + (p.unknowns || UNKNOWN),
      "Severity — frequency: " + label(LEVEL, p.sev_frequency) + ", impact: " + label(LEVEL, p.sev_impact) + ", reach: " + label(LEVEL, p.sev_reach) +
        ", core-value relevance: " + label(LEVEL, p.sev_core) + ", confidence: " + label(LEVEL, p.sev_confidence),
      "Severity reasoning: " + (p.severity_reasoning || UNKNOWN),
      "User need: " + (p.user_need || UNKNOWN), "Opportunity: " + (p.opportunity || UNKNOWN),
      "Potential solutions: " + (p.potential_solutions || UNKNOWN), "Smallest useful change: " + (p.smallest_change || UNKNOWN), "Risk: " + (p.risk || UNKNOWN)
    ].join("\n");
  }
  function experimentRecord(x) {
    return [
      "Experiment E-" + x.id + ": " + x.title + (x.problem_id ? " (for P-" + x.problem_id + ")" : ""),
      "Hypothesis: We believe that " + (x.hypothesis || UNKNOWN), "Change: We will " + (x.change_desc || UNKNOWN),
      "Target users: " + (x.target_users || UNKNOWN), "Expected behavior: " + (x.expected_behavior || UNKNOWN),
      "Success evidence: " + (x.success_evidence || UNKNOWN), "Failure evidence: " + (x.failure_evidence || UNKNOWN),
      "Started: " + (x.started_on || UNKNOWN) + " · Ended: " + (x.ended_on || "Not yet"),
      "Before: " + (x.before_state || UNKNOWN), "After: " + (x.after_state || UNKNOWN), "Actual result: " + (x.actual_result || UNKNOWN),
      "Decision: " + label(DECISION, x.decision) + " · Next decision: " + (x.next_decision || UNKNOWN)
    ].join("\n");
  }
  function decisionRecord(d) {
    return [
      "Decision: " + d.title, "Date: " + (d.decided_on || UNKNOWN),
      "Problem: " + (d.problem_text || (d.problem_id ? "P-" + d.problem_id : UNKNOWN)), "Evidence: " + (d.evidence || UNKNOWN),
      "Interpretation: " + (d.interpretation || UNKNOWN), "Options Considered: " + (d.options_considered || UNKNOWN),
      "Decision Made: " + (d.decision_made || UNKNOWN), "Reason: " + (d.reason || UNKNOWN),
      "Experiment: " + (d.experiment_id ? "E-" + d.experiment_id : "None"), "Result: " + (d.result || UNKNOWN),
      "What We Learned: " + (d.learned || UNKNOWN), "Next Decision: " + (d.next_decision || UNKNOWN)
    ].join("\n");
  }

  /* ---------- tabs ---------- */
  var TABS = [["overview", "Overview"], ["inbox", "Feedback inbox"], ["problems", "Problems & queue"], ["experiments", "Experiments"], ["decisions", "Decision log"], ["testers", "Testers"]];
  var panels = {};
  function renderShell(account) {
    root.innerHTML = "";
    var head = el("div", "results-head");
    var left = el("div");
    left.appendChild(el("h1", null, "Admin dashboard"));
    left.appendChild(el("p", null, "Signed in as " + account.user.email + " · feedback → evidence → problem → experiment → decision"));
    head.appendChild(left);
    var refresh = el("button", "btn btn-secondary btn-small", "Refresh");
    refresh.type = "button";
    refresh.addEventListener("click", function () { loadAll(); });
    head.appendChild(refresh);
    root.appendChild(head);

    var tabs = el("div", "admin-tabs");
    tabs.setAttribute("role", "tablist");
    TABS.forEach(function (t) {
      var b = el("button", "admin-tab", t[1]);
      b.type = "button";
      b.id = "tab-" + t[0];
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", "panel-" + t[0]);
      b.addEventListener("click", function () { showTab(t[0]); });
      tabs.appendChild(b);
      var panel = el("div", "admin-panel");
      panel.id = "panel-" + t[0];
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", "tab-" + t[0]);
      panels[t[0]] = panel;
    });
    root.appendChild(tabs);
    TABS.forEach(function (t) { root.appendChild(panels[t[0]]); });
  }
  function showTab(name) {
    // Redraw data tabs on open so their evidence counts and problem lists are current
    if (state.insights) {
      if (name === "problems") renderProblems();
      else if (name === "experiments") renderExperiments();
      else if (name === "decisions") renderDecisions();
      else if (name === "inbox") { renderInboxShell(); loadInbox(); }
    }
    TABS.forEach(function (t) {
      var on = t[0] === name;
      panels[t[0]].hidden = !on;
      var b = document.getElementById("tab-" + t[0]);
      b.setAttribute("aria-selected", String(on));
      b.classList.toggle("is-active", on);
    });
    try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ }
  }

  /* ---------- Overview ---------- */
  function renderOverview() {
    var o = state.insights.overview, ov = state.overview, p = panels.overview;
    p.innerHTML = "";
    if (!o.realFeedback) {
      var note = el("p", "insight-banner", "No real tester feedback yet. Nothing on this page is evidence about users until real testers send feedback" +
        (o.excludedTestItems ? " — " + o.excludedTestItems + " test item(s) are stored but excluded." : "."));
      p.appendChild(note);
    }
    p.appendChild(renderLaunch(ov.launch));
    var k = el("div", "kpis kpis-6");
    k.appendChild(kpi(o.realFeedback, "Real feedback", o.newRealFeedback + " new · " + o.unlinkedRealFeedback + " not linked to a problem"));
    k.appendChild(kpi(o.openProblems, "Open problems", o.investigating + " being investigated / researched"));
    k.appendChild(kpi(o.awaitingValidation, "Awaiting validation", "problems in Testing"));
    k.appendChild(kpi(o.validated, "Validated improvements", o.implemented + " implemented (testing + validated)"));
    k.appendChild(kpi(o.observations, "Manual observations", "logged by admins; separate from real feedback"));
    k.appendChild(kpi(ov.users.total, "Tester accounts", "+" + ov.users.newThisWeek + " this week · " + ov.users.activeThisWeek + " signed in this week"));
    p.appendChild(k);
    if (o.excludedTestItems) p.appendChild(el("p", "insight-footnote", o.excludedTestItems + " test/automated item(s) excluded from every number on this page."));

    // Top user problems
    var order = { now: 0, next: 1, later: 2, unset: 3, do_not_build: 4 };
    var open = state.insights.problems.filter(function (x) { return ["validated", "rejected", "deferred"].indexOf(x.status) === -1; })
      .sort(function (a, b) { return (order[a.priority] - order[b.priority]) || (b.real_feedback - a.real_feedback); });
    var top = card("Top user problems", "Open problems, by priority then amount of real evidence. Severity is your judgment, shown as Unknown until set.");
    if (!open.length) top.appendChild(el("p", "empty-note", "No open problems yet. Group related feedback into a problem on the Problems & queue tab."));
    else {
      var wrap = el("div", "table-scroll");
      var t = el("table");
      var hr = el("tr");
      ["Problem", "Priority", "Tester accounts", "Real feedback", "Observations", "Impact", "Confidence", "Status"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
      var thead = el("thead"); thead.appendChild(hr); t.appendChild(thead);
      var tb = el("tbody");
      open.slice(0, 10).forEach(function (x) {
        var tr = el("tr");
        var titleTd = el("td", "insight-td-title", "P-" + x.id + " · " + x.title);
        tr.appendChild(titleTd);
        [label(PRIORITY, x.priority), x.real_testers, x.real_feedback, x.observations, label(LEVEL, x.sev_impact), label(LEVEL, x.sev_confidence), label(STATUS, x.status)]
          .forEach(function (v) { tr.appendChild(el("td", null, String(v))); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); top.appendChild(wrap);
    }
    p.appendChild(top);

    var grid = el("div", "grid-2col");
    // Themes (free text, from the problems you've defined)
    var themes = {};
    state.insights.problems.forEach(function (x) {
      var key = x.theme || "No theme yet";
      themes[key] = themes[key] || [0, 0];
      themes[key][0]++;
      themes[key][1] += x.real_feedback;
    });
    var themeRows = Object.keys(themes).sort(function (a, b) { return themes[b][1] - themes[a][1]; })
      .map(function (k2) { return [k2, themes[k2][1], themes[k2][0] + " problem" + (themes[k2][0] === 1 ? "" : "s")]; });
    var tc = card("Feedback themes", "Themes come from the problems you define — not a fixed list. Numbers are linked real feedback.");
    tc.appendChild(themeRows.length ? bars(themeRows, Math.max.apply(null, themeRows.map(function (r) { return r[1]; }).concat([1])), "real feedback") : el("p", "empty-note", "No themes yet."));
    grid.appendChild(tc);
    var fb = ov.feedback, totalFb = Object.values(fb.byCategory).reduce(function (a, b) { return a + b; }, 0);
    var stuck = card("Where testers get stuck", "Real feedback per part of the site; the first number counts “confusing” + “didn't work”.");
    stuck.appendChild(bars(fb.byFeature.map(function (f) { return [label(FEATURE, f.feature), f.total, f.problems + " problem" + (f.problems === 1 ? "" : "s")]; }), totalFb, "notes"));
    grid.appendChild(stuck);
    p.appendChild(grid);

    // Opportunities
    var opp = card("Product opportunities", "Problem → Evidence → Opportunity → Proposed change, for problems where you've written an opportunity.");
    var withOpp = state.insights.problems.filter(function (x) { return x.opportunity || x.smallest_change; });
    if (!withOpp.length) opp.appendChild(el("p", "empty-note", "None yet."));
    withOpp.forEach(function (x) {
      var row = el("div", "insight-opp");
      [["Problem", "P-" + x.id + " · " + x.title], ["Evidence", evidenceLine(x)], ["Opportunity", x.opportunity || UNKNOWN], ["Proposed change", x.smallest_change || UNKNOWN]]
        .forEach(function (pair, i) {
          var cell = el("div", "insight-opp-cell");
          cell.appendChild(el("span", "insight-opp-label", (i ? "→ " : "") + pair[0]));
          cell.appendChild(el("span", null, pair[1]));
          row.appendChild(cell);
        });
      opp.appendChild(row);
    });
    p.appendChild(opp);

    var grid2 = el("div", "grid-2col");
    var types = card("Real feedback by type", totalFb + " real notes");
    types.appendChild(bars(CATEGORY.map(function (c) { return [c[1], fb.byCategory[c[0]] || 0]; }), totalFb, "notes"));
    grid2.appendChild(types);
    var ea = ov.earlyAccess;
    var usage = card("What visitors tried", "Anonymous browser IDs (not unique people — one person on two devices counts twice). " + ea.visitors + " browser IDs total.");
    usage.appendChild(bars(DEMO_FEATURES.map(function (f) { return [f[1], ea.features[f[0]] || 0]; }), ea.visitors, "browser IDs"));
    grid2.appendChild(usage);
    p.appendChild(grid2);
  }

  /* ---------- Feedback inbox ---------- */
  var inboxList, inboxCount, copyStatus;
  function renderInboxShell() {
    var p = panels.inbox;
    p.innerHTML = "";
    var c = card("Feedback inbox", "Testers appear as anonymous account codes. Link feedback to a problem to build evidence; relabel anything from testing as Test data.");
    var bar = el("div", "admin-filters");
    [["source", "Source", SOURCE], ["status", "Status", FB_STATUS], ["category", "Type", CATEGORY], ["feature", "Part of site", FEATURE]].forEach(function (f) {
      var s = select(f[2], state.filters[f[0]], "All");
      s.addEventListener("change", function () { state.filters[f[0]] = s.value; loadInbox(); });
      bar.appendChild(field(f[1], s));
    });
    var ps = select([["none", "Not linked to a problem"]].concat(problemOptions()), state.filters.problem, "All");
    ps.addEventListener("change", function () { state.filters.problem = ps.value; loadInbox(); });
    bar.appendChild(field("Problem", ps));
    c.appendChild(bar);

    var tools = el("div", "insight-toolbar");
    var all = el("button", "btn btn-secondary btn-small", "Select all shown");
    all.type = "button";
    all.addEventListener("click", function () {
      var allOn = state.feedback.every(function (f) { return state.selected[f.id]; });
      state.feedback.forEach(function (f) { if (allOn) delete state.selected[f.id]; else state.selected[f.id] = f; });
      renderInboxList();
    });
    var copy = el("button", "btn btn-primary btn-small", "Copy selected for AI analysis");
    copy.type = "button";
    copy.addEventListener("click", function () {
      var items = Object.keys(state.selected).map(function (k) { return state.selected[k]; }).sort(function (a, b) { return a.id - b.id; });
      if (!items.length) { copyStatus.textContent = "Select at least one item first."; return; }
      copyText(exportHeader(items) + items.map(feedbackRecord).join("\n\n----------\n\n"), copyStatus);
    });
    var obs = el("button", "btn btn-secondary btn-small", "+ Log an observation");
    obs.type = "button";
    obs.addEventListener("click", function () { obsForm.hidden = !obsForm.hidden; });
    inboxCount = el("span", "insight-count");
    tools.appendChild(all); tools.appendChild(copy); tools.appendChild(obs); tools.appendChild(inboxCount);
    c.appendChild(tools);
    copyStatus = el("p", "insight-copy-status");
    copyStatus.setAttribute("aria-live", "polite");
    c.appendChild(copyStatus);

    var obsForm = observationForm();
    obsForm.hidden = true;
    c.appendChild(obsForm);

    inboxList = el("div", "admin-feedback-list");
    c.appendChild(inboxList);
    p.appendChild(c);
  }
  function observationForm() {
    var f = el("div", "insight-form insight-obs");
    f.appendChild(el("h3", null, "Log a manual observation"));
    f.appendChild(el("p", "sub", "For things you saw or heard in an interview, usability test, or conversation. Don't include names or identifying details."));
    var cat = select(CATEGORY, "confusing"), feat = select(FEATURE, "other"), stage = select(STAGE, "", "Unknown"),
      type = input("", 60, "e.g. Athlete (self-described) — optional"), prob = select(problemOptions(), "", "No problem yet"),
      msg = textarea("", 3, 2000, "What happened, in plain words. Quote the person if you can.");
    var row = el("div", "insight-grid");
    row.appendChild(field("Type", cat)); row.appendChild(field("Part of site", feat)); row.appendChild(field("Journey stage", stage));
    row.appendChild(field("User type (only if they told you)", type)); row.appendChild(field("Evidence for problem", prob));
    f.appendChild(row);
    f.appendChild(field("Observation", msg));
    f.appendChild(saveRow(function () {
      return send("POST", "/api/admin/observations", {
        category: cat.value, feature: feat.value, journeyStage: stage.value || null, userType: type.value.trim() || null,
        problemId: prob.value || null, message: msg.value
      }).then(function (r) { if (r.ok) { msg.value = ""; loadAll(); } return r; });
    }));
    return f;
  }
  function loadInbox() {
    inboxList.innerHTML = "";
    inboxList.appendChild(el("p", "empty-note", "Loading…"));
    var q = Object.keys(state.filters).filter(function (k) { return state.filters[k]; })
      .map(function (k) { return k + "=" + encodeURIComponent(state.filters[k]); }).join("&");
    return api("/api/admin/feedback" + (q ? "?" + q : "")).then(function (r) {
      state.feedback = r.ok ? r.body.feedback : [];
      renderInboxList(r.ok ? null : "Couldn't load feedback.");
    });
  }
  function renderInboxList(error) {
    inboxList.innerHTML = "";
    var n = Object.keys(state.selected).length;
    inboxCount.textContent = state.feedback.length + " shown · " + n + " selected";
    if (error) { inboxList.appendChild(el("p", "empty-note", error)); return; }
    if (!state.feedback.length) {
      inboxList.appendChild(el("p", "empty-note", state.filters.source === "real"
        ? "No real tester feedback matches these filters. (Source filter is set to Real — choose All to include test items and observations.)"
        : "No feedback matches these filters."));
      return;
    }
    state.feedback.forEach(function (f) { inboxList.appendChild(feedbackItem(f)); });
  }
  function feedbackItem(f) {
    var item = el("article", "admin-feedback is-" + f.status + " source-" + f.source);
    var head = el("div", "account-feedback-head");
    var pick = el("input");
    pick.type = "checkbox";
    pick.checked = !!state.selected[f.id];
    pick.setAttribute("aria-label", "Select FB-" + f.id + " for AI analysis");
    pick.addEventListener("change", function () {
      if (pick.checked) state.selected[f.id] = f; else delete state.selected[f.id];
      inboxCount.textContent = state.feedback.length + " shown · " + Object.keys(state.selected).length + " selected";
    });
    head.appendChild(pick);
    head.appendChild(el("span", "fb-id", "FB-" + f.id));
    head.appendChild(badge(SOURCE_SHORT[f.source], "src-" + f.source));
    head.appendChild(badge(label(CATEGORY, f.category), "is-" + f.category));
    head.appendChild(el("span", "muted", label(FEATURE, f.feature) + (f.rating ? " · rated " + f.rating + "/5" : "") + " · " + when(f.created_at) + " · " + f.tester));
    item.appendChild(head);
    item.appendChild(el("p", "account-feedback-msg", f.message));
    var stageText = f.journey_stage ? label(STAGE, f.journey_stage) : label(STAGE, STAGE_FROM_FEATURE[f.feature]) + " (inferred)";
    item.appendChild(el("p", "admin-feedback-from", "Journey stage: " + stageText + (f.user_type ? " · User type: " + f.user_type : "")));

    var controls = el("div", "admin-feedback-controls");
    var status = select(FB_STATUS, f.status), source = select(SOURCE, f.source),
      prob = select(problemOptions(), f.problem_id ? String(f.problem_id) : "", "No problem"),
      stage = select(STAGE, f.journey_stage || "", "Inferred / unknown"),
      notes = textarea(f.admin_notes, 2, 2000, "Private notes (testers never see these)");
    controls.appendChild(field("Status", status));
    controls.appendChild(field("Source", source));
    controls.appendChild(field("Evidence for problem", prob));
    controls.appendChild(field("Journey stage", stage));
    var nf = field("Private notes", notes);
    nf.classList.add("admin-notes");
    controls.appendChild(nf);
    controls.appendChild(saveRow(function () {
      return send("PATCH", "/api/admin/feedback/" + f.id, {
        status: status.value, source: source.value, problemId: prob.value || null,
        journeyStage: stage.value || null, adminNotes: notes.value.trim() || null
      }).then(function (r) {
        if (r.ok) {
          f.status = status.value; f.source = source.value; f.problem_id = prob.value ? Number(prob.value) : null;
          f.journey_stage = stage.value || null; f.admin_notes = notes.value.trim() || null;
          item.className = "admin-feedback is-" + f.status + " source-" + f.source;
          refreshInsights();
        }
        return r;
      });
    }));
    item.appendChild(controls);
    return item;
  }

  /* ---------- Problems & queue ---------- */
  var problemFilter = { status: "", priority: "" };
  function renderProblems() {
    var p = panels.problems;
    p.innerHTML = "";
    var c = card("Problems & improvement queue", "Each problem is an underlying user need that one or more feedback items point to. Evidence counts are calculated from linked feedback — real feedback only.");
    var legend = el("details", "insight-legend");
    legend.appendChild(el("summary", null, "What each status means"));
    var dl = el("dl");
    STATUS.forEach(function (s) { dl.appendChild(el("dt", null, s[1])); dl.appendChild(el("dd", null, s[2])); });
    legend.appendChild(dl);
    c.appendChild(legend);

    var bar = el("div", "admin-filters");
    var fs = select(STATUS.map(function (s) { return [s[0], s[1]]; }), problemFilter.status, "All statuses");
    fs.addEventListener("change", function () { problemFilter.status = fs.value; renderProblems(); });
    var fp = select(PRIORITY, problemFilter.priority, "All priorities");
    fp.addEventListener("change", function () { problemFilter.priority = fp.value; renderProblems(); });
    bar.appendChild(field("Status", fs)); bar.appendChild(field("Priority", fp));
    var add = el("button", "btn btn-primary btn-small", "+ New problem");
    add.type = "button";
    add.addEventListener("click", function () { list.insertBefore(problemCard(null), list.firstChild); });
    var copyAll = el("button", "btn btn-secondary btn-small", "Copy all for AI analysis");
    copyAll.type = "button";
    var cs = el("p", "insight-copy-status");
    copyAll.addEventListener("click", function () {
      var ins = state.insights;
      copyText("TIMEWISE PRODUCT INSIGHTS SNAPSHOT — " + new Date().toISOString().slice(0, 10) +
        "\nEvidence counts include REAL tester feedback only; observations listed separately; test data excluded.\n\n== PROBLEMS ==\n\n" +
        (ins.problems.map(problemRecord).join("\n\n") || "None") + "\n\n== EXPERIMENTS ==\n\n" +
        (ins.experiments.map(experimentRecord).join("\n\n") || "None") + "\n\n== DECISIONS ==\n\n" +
        (ins.decisions.map(decisionRecord).join("\n\n") || "None"), cs);
    });
    bar.appendChild(add); bar.appendChild(copyAll);
    c.appendChild(bar);
    c.appendChild(cs);

    var list = el("div", "insight-list");
    var items = state.insights.problems.filter(function (x) {
      return (!problemFilter.status || x.status === problemFilter.status) && (!problemFilter.priority || x.priority === problemFilter.priority);
    });
    if (!items.length) list.appendChild(el("p", "empty-note", "No problems here yet."));
    items.forEach(function (x) { list.appendChild(problemCard(x)); });
    c.appendChild(list);
    p.appendChild(c);
  }
  function problemCard(x) {
    var isNew = !x;
    x = x || { title: "", status: "new", priority: "unset", sev_frequency: "unknown", sev_impact: "unknown", sev_reach: "unknown", sev_core: "unknown", sev_confidence: "unknown", real_feedback: 0, real_testers: 0, observations: 0, excluded: 0 };
    var d = el("details", "insight-card");
    if (isNew) d.open = true;
    var s = el("summary");
    s.appendChild(el("strong", null, isNew ? "New problem" : "P-" + x.id + " · " + x.title));
    if (!isNew) {
      var meta = el("span", "insight-card-meta");
      meta.appendChild(badge(label(PRIORITY, x.priority), "prio-" + x.priority));
      meta.appendChild(badge(label(STATUS, x.status), "st-" + x.status));
      if (x.theme) meta.appendChild(el("span", "muted", x.theme));
      meta.appendChild(el("span", "muted", evidenceLine(x)));
      s.appendChild(meta);
    }
    d.appendChild(s);

    var f = el("div", "insight-form");
    var v = {
      title: input(x.title, 120, "Short name for the problem"), theme: input(x.theme, 60, "e.g. Clarity, Prioritization — your words"),
      psUser: textarea(x.ps_user, 2, 1000, "Who is experiencing the problem?"), psSituation: textarea(x.ps_situation, 2, 1000, "When does it happen?"),
      psProblem: textarea(x.ps_problem, 2, 1000, "What is difficult?"), psImpact: textarea(x.ps_impact, 2, 1000, "What happens because of it?"),
      known: textarea(x.known, 3, 3000, "Direct evidence only — e.g. “3 real feedback items say…”"),
      interpretation: textarea(x.interpretation, 3, 3000, "Your interpretation of the evidence"),
      unknowns: textarea(x.unknowns, 3, 3000, "Questions that still need research"),
      sevFrequency: select(LEVEL, x.sev_frequency), sevImpact: select(LEVEL, x.sev_impact), sevReach: select(LEVEL, x.sev_reach),
      sevCore: select(LEVEL, x.sev_core), sevConfidence: select(LEVEL, x.sev_confidence),
      severityReasoning: textarea(x.severity_reasoning, 2, 2000, "Why these levels?"),
      userNeed: textarea(x.user_need, 2, 1000, "What does the user actually need?"), opportunity: textarea(x.opportunity, 2, 1000, "What could TimeWise do differently?"),
      potentialSolutions: textarea(x.potential_solutions, 3, 2000, "One or more options"), smallestChange: textarea(x.smallest_change, 2, 1000, "Simplest change that would test the idea"),
      risk: textarea(x.risk, 2, 1000, "What could go wrong?"),
      priority: select(PRIORITY, x.priority), status: select(STATUS.map(function (st) { return [st[0], st[1]]; }), x.status)
    };
    var g1 = el("div", "insight-grid");
    g1.appendChild(field("Problem title", v.title)); g1.appendChild(field("Theme", v.theme));
    g1.appendChild(field("Priority", v.priority)); g1.appendChild(field("Status", v.status, (STATUS.filter(function (st) { return st[0] === x.status; })[0] || [])[2]));
    f.appendChild(g1);
    f.appendChild(el("h4", "insight-h", "Problem statement"));
    var g2 = el("div", "insight-grid insight-grid-2");
    g2.appendChild(field("User", v.psUser)); g2.appendChild(field("Situation", v.psSituation));
    g2.appendChild(field("Problem", v.psProblem)); g2.appendChild(field("Impact", v.psImpact));
    f.appendChild(g2);
    f.appendChild(el("h4", "insight-h", "Observation vs. interpretation"));
    var g3 = el("div", "insight-grid insight-grid-3");
    g3.appendChild(field("What we know", v.known)); g3.appendChild(field("What we think", v.interpretation)); g3.appendChild(field("What we don't know", v.unknowns));
    f.appendChild(g3);
    f.appendChild(el("h4", "insight-h", "Severity"));
    var g4 = el("div", "insight-grid insight-grid-5");
    g4.appendChild(field("Frequency", v.sevFrequency)); g4.appendChild(field("Impact", v.sevImpact)); g4.appendChild(field("Reach", v.sevReach));
    g4.appendChild(field("Core-value relevance", v.sevCore)); g4.appendChild(field("Confidence", v.sevConfidence));
    f.appendChild(g4);
    f.appendChild(field("Reasoning", v.severityReasoning));
    f.appendChild(el("h4", "insight-h", "Opportunity"));
    var g5 = el("div", "insight-grid insight-grid-2");
    g5.appendChild(field("User need", v.userNeed)); g5.appendChild(field("Product opportunity", v.opportunity));
    g5.appendChild(field("Potential solutions", v.potentialSolutions)); g5.appendChild(field("Smallest useful change", v.smallestChange));
    f.appendChild(g5);
    f.appendChild(field("Risk", v.risk));

    f.appendChild(saveRow(function () {
      var body = {};
      Object.keys(v).forEach(function (k) { body[k] = v[k].value; });
      return (isNew ? send("POST", "/api/admin/problems", body) : send("PATCH", "/api/admin/problems/" + x.id, body)).then(function (r) {
        if (r.ok) refreshInsights().then(function () { if (isNew) renderProblems(); });
        return r;
      });
    }));

    if (!isNew) {
      var linked = el("div", "insight-linked");
      var show = el("button", "btn btn-secondary btn-small", "Show linked feedback");
      show.type = "button";
      var cs = el("p", "insight-copy-status");
      show.addEventListener("click", function () {
        show.disabled = true;
        api("/api/admin/feedback?problem=" + x.id).then(function (r) {
          var items = r.ok ? r.body.feedback : [];
          var ul = el("ul", "insight-linked-list");
          if (!items.length) ul.appendChild(el("li", "empty-note", "No feedback linked yet — link items from the Feedback inbox."));
          items.forEach(function (it) {
            var li = el("li");
            li.appendChild(badge(SOURCE_SHORT[it.source], "src-" + it.source));
            li.appendChild(el("span", "muted", " FB-" + it.id + " · " + it.tester + " · "));
            li.appendChild(el("span", null, it.message));
            ul.appendChild(li);
          });
          linked.appendChild(ul);
          var copy = el("button", "btn btn-primary btn-small", "Copy problem + its feedback for AI analysis");
          copy.type = "button";
          copy.addEventListener("click", function () {
            copyText(problemRecord(x) + "\n\n== LINKED FEEDBACK ==\n\n" + exportHeader(items) + items.map(feedbackRecord).join("\n\n----------\n\n"), cs);
          });
          linked.appendChild(copy);
          linked.appendChild(cs);
        });
      });
      linked.appendChild(show);
      f.appendChild(linked);
    }
    d.appendChild(f);
    return d;
  }

  /* ---------- Experiments ---------- */
  function renderExperiments() {
    var p = panels.experiments;
    p.innerHTML = "";
    var c = card("Experiments", "Small changes that test a hypothesis. A result is evidence, not proof — note what else could explain it.");
    var add = el("button", "btn btn-primary btn-small", "+ New experiment");
    add.type = "button";
    var list = el("div", "insight-list");
    add.addEventListener("click", function () { list.insertBefore(experimentCard(null), list.firstChild); });
    c.appendChild(add);
    if (!state.insights.experiments.length) list.appendChild(el("p", "empty-note", "No experiments yet."));
    state.insights.experiments.forEach(function (x) { list.appendChild(experimentCard(x)); });
    c.appendChild(list);
    p.appendChild(c);
  }
  function experimentCard(x) {
    var isNew = !x;
    x = x || { decision: "pending" };
    var d = el("details", "insight-card");
    if (isNew) d.open = true;
    var s = el("summary");
    s.appendChild(el("strong", null, isNew ? "New experiment" : "E-" + x.id + " · " + x.title));
    if (!isNew) {
      var meta = el("span", "insight-card-meta");
      meta.appendChild(badge(label(DECISION, x.decision), "dec-" + x.decision));
      meta.appendChild(el("span", "muted", (x.problem_id ? "P-" + x.problem_id + " · " : "") + "started " + (x.started_on || "—") + (x.ended_on ? " · ended " + x.ended_on : "")));
      s.appendChild(meta);
    }
    d.appendChild(s);
    var f = el("div", "insight-form");
    var v = {
      title: input(x.title, 120, "Short name"), problemId: select(problemOptions(), x.problem_id ? String(x.problem_id) : "", "No problem"),
      startedOn: input(x.started_on, 10, "", "date"), endedOn: input(x.ended_on, 10, "", "date"), decision: select(DECISION, x.decision),
      hypothesis: textarea(x.hypothesis, 2, 1500, "We believe that…"), changeDesc: textarea(x.change_desc, 2, 1500, "We will…"),
      targetUsers: textarea(x.target_users, 2, 500, "For…"), expectedBehavior: textarea(x.expected_behavior, 2, 1500, "We expect users to…"),
      successEvidence: textarea(x.success_evidence, 2, 1500, "We will look for…"), failureEvidence: textarea(x.failure_evidence, 2, 1500, "It may not be working if…"),
      beforeState: textarea(x.before_state, 2, 2000, "What was happening before (behavior + feedback)"),
      afterState: textarea(x.after_state, 2, 2000, "What happened after (behavior + feedback)"),
      actualResult: textarea(x.actual_result, 2, 2000, "What actually happened — including anything else that could explain it"),
      nextDecision: textarea(x.next_decision, 2, 1500, "Depending on the evidence, we will…")
    };
    var g1 = el("div", "insight-grid insight-grid-5");
    g1.appendChild(field("Title", v.title)); g1.appendChild(field("For problem", v.problemId)); g1.appendChild(field("Started", v.startedOn));
    g1.appendChild(field("Ended", v.endedOn)); g1.appendChild(field("Decision", v.decision));
    f.appendChild(g1);
    var g2 = el("div", "insight-grid insight-grid-2");
    [["Hypothesis", "hypothesis"], ["Change", "changeDesc"], ["Target users", "targetUsers"], ["Expected behavior", "expectedBehavior"],
     ["Success evidence", "successEvidence"], ["Failure evidence", "failureEvidence"], ["Before", "beforeState"], ["After", "afterState"],
     ["Actual result", "actualResult"], ["Next decision", "nextDecision"]].forEach(function (pair) { g2.appendChild(field(pair[0], v[pair[1]])); });
    f.appendChild(g2);
    f.appendChild(saveRow(function () {
      var body = {};
      Object.keys(v).forEach(function (k) { body[k] = v[k].value || (k === "problemId" ? null : v[k].value); });
      body.problemId = v.problemId.value || null;
      return (isNew ? send("POST", "/api/admin/experiments", body) : send("PATCH", "/api/admin/experiments/" + x.id, body)).then(function (r) {
        if (r.ok) refreshInsights().then(function () { if (isNew) renderExperiments(); });
        return r;
      });
    }));
    d.appendChild(f);
    return d;
  }

  /* ---------- Decision log ---------- */
  function renderDecisions() {
    var p = panels.decisions;
    p.innerHTML = "";
    var c = card("Decision log", "A record of product decisions and the evidence behind them, so questions aren't revisited without new evidence.");
    var add = el("button", "btn btn-primary btn-small", "+ Log a decision");
    add.type = "button";
    var list = el("div", "insight-list");
    add.addEventListener("click", function () { list.insertBefore(decisionCard(null), list.firstChild); });
    c.appendChild(add);
    if (!state.insights.decisions.length) list.appendChild(el("p", "empty-note", "No decisions logged yet."));
    state.insights.decisions.forEach(function (x) { list.appendChild(decisionCard(x)); });
    c.appendChild(list);
    p.appendChild(c);
  }
  function decisionCard(x) {
    var isNew = !x;
    x = x || { decided_on: new Date().toISOString().slice(0, 10) };
    var d = el("details", "insight-card");
    if (isNew) d.open = true;
    var s = el("summary");
    s.appendChild(el("strong", null, isNew ? "New decision" : x.title));
    if (!isNew) s.appendChild(el("span", "insight-card-meta muted", (x.decided_on || "—") + (x.problem_id ? " · P-" + x.problem_id : "") + (x.experiment_id ? " · E-" + x.experiment_id : "")));
    d.appendChild(s);
    var f = el("div", "insight-form");
    var expOpts = state.insights.experiments.map(function (e) { return [String(e.id), "E-" + e.id + " · " + e.title]; });
    var v = {
      title: input(x.title, 120, "Decision, in a few words"), decidedOn: input(x.decided_on, 10, "", "date"),
      problemId: select(problemOptions(), x.problem_id ? String(x.problem_id) : "", "No problem"),
      experimentId: select(expOpts, x.experiment_id ? String(x.experiment_id) : "", "No experiment"),
      problemText: textarea(x.problem_text, 2, 2000), evidence: textarea(x.evidence, 2, 3000), interpretation: textarea(x.interpretation, 2, 3000),
      optionsConsidered: textarea(x.options_considered, 2, 3000), decisionMade: textarea(x.decision_made, 2, 2000), reason: textarea(x.reason, 2, 3000),
      result: textarea(x.result, 2, 3000), learned: textarea(x.learned, 2, 3000), nextDecision: textarea(x.next_decision, 2, 2000)
    };
    var g1 = el("div", "insight-grid");
    g1.appendChild(field("Decision", v.title)); g1.appendChild(field("Date", v.decidedOn));
    g1.appendChild(field("Problem", v.problemId)); g1.appendChild(field("Experiment", v.experimentId));
    f.appendChild(g1);
    var g2 = el("div", "insight-grid insight-grid-2");
    [["Problem", "problemText"], ["Evidence", "evidence"], ["Interpretation", "interpretation"], ["Options considered", "optionsConsidered"],
     ["Decision made", "decisionMade"], ["Reason", "reason"], ["Result", "result"], ["What we learned", "learned"], ["Next decision", "nextDecision"]]
      .forEach(function (pair) { g2.appendChild(field(pair[0], v[pair[1]])); });
    f.appendChild(g2);
    f.appendChild(saveRow(function () {
      var body = {};
      Object.keys(v).forEach(function (k) { body[k] = v[k].value; });
      body.problemId = v.problemId.value || null;
      body.experimentId = v.experimentId.value || null;
      return (isNew ? send("POST", "/api/admin/decisions", body) : send("PATCH", "/api/admin/decisions/" + x.id, body)).then(function (r) {
        if (r.ok) refreshInsights().then(function () { if (isNew) renderDecisions(); });
        return r;
      });
    }));
    d.appendChild(f);
    return d;
  }

  /* ---------- Testers (account management) ---------- */
  // The Oct 20 goal: 50 users / 25 activated / 10 returned (admins excluded)
  function renderLaunch(L) {
    var c = card("Launch scoreboard: goal by Oct 20", "Users = signed in with Google. Activated = saved 3+ of their own events (not Maya's). Returned = active on 2+ different days. Admin accounts are not counted.", "launch");
    if (!L || L.notReady) {
      c.appendChild(el("p", "insight-banner", "Launch tracking isn't set up yet: run migrations/0003_launch_tracking.sql in the D1 console (see ACCOUNTS_SETUP.md)."));
      return c;
    }
    var goals = [[L.users, 50, "Users"], [L.activated, 25, "Activated"], [L.returned, 10, "Returned"]];
    var k = el("div", "kpis launch-kpis");
    goals.forEach(function (g) {
      var d = kpi(g[0] + " / " + g[1], g[2], Math.min(100, Math.round(g[0] / g[1] * 100)) + "% of goal");
      var bar = el("div", "launch-bar");
      var fill = el("span");
      fill.style.width = Math.min(100, g[0] / g[1] * 100) + "%";
      bar.appendChild(fill);
      d.appendChild(bar);
      k.appendChild(d);
    });
    k.appendChild(kpi(L.contactOk, "OK to email", "said yes to one feedback email"));
    c.appendChild(k);
    var mins = Math.round(L.medianVisitSeconds / 60);
    c.appendChild(el("p", "sub", L.visits + " visits from " + L.browsers + " browser IDs (" + L.returningBrowsers + " came back another day) · typical visit about " +
      (mins ? mins + " min" : "under a minute") + ". Browser IDs aren't people: one person on two devices counts twice."));
    if (L.bySource.length) {
      var wrap = el("div", "table-scroll");
      var t = el("table");
      var hr = el("tr");
      ["Link tag (?from=)", "Visits", "Browser IDs", "Users", "Activated", "Returned"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
      var thead = el("thead"); thead.appendChild(hr); t.appendChild(thead);
      var tb = el("tbody");
      L.bySource.forEach(function (r) {
        var tr = el("tr");
        [r.source, r.visits, r.browsers, r.users, r.activated, r.returned].forEach(function (v) { tr.appendChild(el("td", null, String(v))); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); c.appendChild(wrap);
    }
    return c;
  }

  function renderTesters() {
    var p = panels.testers;
    p.innerHTML = "";
    var c = card("Tester accounts", "For account management only — feedback analysis uses anonymous codes. Roles change only via SQL (see ACCOUNTS_SETUP.md).");
    var wrap = el("div", "table-scroll");
    var t = el("table");
    var hr = el("tr");
    ["Name", "Email", "Role", "Status", "Joined", "Came from", "Days active", "Own events", "OK to email", "Weeks saved", "Feedback"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    var thead = el("thead"); thead.appendChild(hr); t.appendChild(thead);
    var tb = el("tbody");
    t.appendChild(tb); wrap.appendChild(t); c.appendChild(wrap);
    p.appendChild(c);
    api("/api/admin/users").then(function (r) {
      (r.body.users || []).forEach(function (u) {
        var tr = el("tr");
        [u.name || "—", u.email, u.role, u.status, when(u.created_at), u.source || "direct", u.days_active == null ? "—" : u.days_active,
          u.own_events == null ? "—" : u.own_events, u.contact_ok ? "Yes" : "No", u.weeks_saved, u.feedback_sent].forEach(function (val) { tr.appendChild(el("td", null, String(val))); });
        tb.appendChild(tr);
      });
    });
  }

  /* ---------- loading ---------- */
  function refreshInsights() {
    return Promise.all([api("/api/admin/insights"), api("/api/admin/overview")]).then(function (rs) {
      if (rs[0].ok) state.insights = rs[0].body;
      if (rs[1].ok) state.overview = rs[1].body;
      renderOverview();
    });
  }
  function loadAll() {
    return Promise.all([api("/api/admin/insights"), api("/api/admin/overview")]).then(function (rs) {
      if (rs[0].status === 403 || rs[1].status === 403) { denied("Your account doesn't have admin access."); return false; }
      if (!rs[0].ok || !rs[1].ok) { denied("Couldn't load the dashboard. If you just deployed, make sure the database migration ran (see PRODUCT_LOOP.md)."); return false; }
      state.insights = rs[0].body;
      state.overview = rs[1].body;
      renderOverview();
      renderInboxShell();
      loadInbox();
      renderProblems();
      renderExperiments();
      renderDecisions();
      renderTesters();
      return true;
    });
  }
  function denied(text) {
    root.innerHTML = "";
    var c = card("Admins only", text);
    var home = el("a", "btn btn-primary btn-small", "Back to TimeWise");
    home.href = "index.html";
    c.appendChild(home);
    root.appendChild(c);
  }

  window.TimeWise.ready.then(function (account) {
    if (!account.available) { denied("This page only works on the live Cloudflare site."); return; }
    if (!account.signedIn) {
      denied("Sign in with an admin account to see this page.");
      var a = el("a", "btn btn-secondary btn-small", "Sign in");
      a.href = window.TimeWise.signInUrl("/admin.html");
      root.querySelector(".results-card").appendChild(a);
      return;
    }
    renderShell(account);
    loadAll().then(function (ok) {
      if (!ok) return;
      var start = (window.location.hash || "").slice(1);
      showTab(TABS.some(function (t) { return t[0] === start; }) ? start : "overview");
    });
  });
})();
