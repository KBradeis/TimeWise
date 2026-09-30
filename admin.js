/* ==========================================================================
   TimeWise — Admin dashboard (admin.html)
   Every number and list comes from /api/admin/*, which the server only
   answers for accounts whose role is 'admin' in the database. Hiding this
   page from the menu is a convenience, not the protection.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.getElementById("adminRoot");
  if (!root || !window.TimeWise) return;

  var CATEGORY = [["worked_well", "👍 Worked well"], ["confusing", "🤔 Confusing"], ["broken", "🐞 Didn't work"], ["idea", "💡 Idea"]];
  var FEATURE = [["home", "Home"], ["the_idea", "The Idea"], ["your_week", "Your week"], ["calendars", "Calendars"], ["replan", "Replan"],
    ["reflect", "Plan vs. Reality"], ["practice", "Practice"], ["early_access", "Early access"], ["account", "My account"], ["other", "Other"]];
  var STATUS = [["new", "New"], ["reviewing", "Reviewing"], ["resolved", "Resolved"]];
  var DEMO_FEATURES = [
    ["calendar_google", "Connected Google Calendar"], ["calendar_notion", "Connected Notion"], ["calendar_ics", "Uploaded a calendar file"],
    ["event_added", "Added an event by hand"], ["replan_used", "Tried Replan my day"], ["replan_applied", "Applied a replan"],
    ["reflection_viewed", "Saw a reflection"], ["reflection_step_added", "Added a suggested next step"],
    ["quiz_completed", "Finished the practice quiz"], ["waitlist_joined", "Answered the early-access form"], ["feedback_sent", "Sent feedback"]
  ];
  var label = function (list, key) { var m = list.filter(function (x) { return x[0] === key; })[0]; return m ? m[1] : key; };
  var filters = { status: "", category: "", feature: "" };

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

  function when(value) {
    if (!value) return "—";
    var d = new Date(String(value).replace(" ", "T") + "Z");
    return isNaN(d) ? value : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

  function card(title, sub, id) {
    var c = el("section", "results-card");
    if (id) c.id = id;
    c.appendChild(el("h2", null, title));
    if (sub) c.appendChild(el("p", "sub", sub));
    return c;
  }

  // Horizontal bars: one brand hue, value labels in text ink (same pattern as results.html)
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

  function denied(text) {
    root.innerHTML = "";
    var c = card("Admins only", text);
    var home = el("a", "btn btn-primary btn-small", "Back to TimeWise");
    home.href = "index.html";
    c.appendChild(home);
    root.appendChild(c);
  }

  /* ----- Overview ----- */
  function renderOverview(data) {
    var fb = data.feedback;
    var totalFb = Object.values(fb.byCategory).reduce(function (a, b) { return a + b; }, 0);
    var kpis = el("div", "kpis");
    kpis.appendChild(kpi(data.users.total, "Testers signed up", "+" + data.users.newThisWeek + " this week"));
    kpis.appendChild(kpi(data.users.activeThisWeek, "Signed in this week", "last 7 days"));
    kpis.appendChild(kpi(fb.byStatus.new || 0, "New feedback", totalFb + " notes in total"));
    kpis.appendChild(kpi(data.earlyAccess.responses, "Early-access answers", data.earlyAccess.visitors + " unique visitors"));
    root.appendChild(kpis);

    var grid = el("div", "grid-2col");
    var stuck = card("Where people get stuck", "Feedback per part of the site. The first number counts “confusing” + “didn't work” notes.");
    stuck.appendChild(bars(fb.byFeature.map(function (f) { return [label(FEATURE, f.feature), f.total, f.problems + " problem" + (f.problems === 1 ? "" : "s")]; }), totalFb, "notes"));
    var types = card("Feedback by type", totalFb + " notes");
    types.appendChild(bars(CATEGORY.map(function (c) { return [c[1], fb.byCategory[c[0]] || 0]; }), totalFb, "notes"));
    grid.appendChild(stuck);
    grid.appendChild(types);
    root.appendChild(grid);

    var usage = card("What visitors tried", "Anonymous: share of unique visitors who used each feature at least once. Full early-access survey answers are on results.html.");
    usage.appendChild(bars(DEMO_FEATURES.map(function (f) { return [f[1], data.earlyAccess.features[f[0]] || 0]; }), data.earlyAccess.visitors, "visitors"));
    root.appendChild(usage);
  }

  /* ----- Feedback inbox ----- */
  var inbox, inboxList;

  function renderInboxShell() {
    inbox = card("Feedback inbox", "Newest first. Status and notes are only visible to admins — testers just see Received / Being reviewed / Resolved.", "inbox");
    var bar = el("div", "admin-filters");
    [["status", "Status", STATUS], ["category", "Type", CATEGORY], ["feature", "Part of site", FEATURE]].forEach(function (f) {
      var l = el("label", "quick-add-field");
      l.appendChild(el("span", null, f[1]));
      var s = el("select");
      var all = el("option", null, "All");
      all.value = "";
      s.appendChild(all);
      f[2].forEach(function (opt) { var o = el("option", null, opt[1]); o.value = opt[0]; s.appendChild(o); });
      s.addEventListener("change", function () { filters[f[0]] = s.value; loadInbox(); });
      l.appendChild(s);
      bar.appendChild(l);
    });
    inbox.appendChild(bar);
    inboxList = el("div", "admin-feedback-list");
    inbox.appendChild(inboxList);
    root.appendChild(inbox);
  }

  function loadInbox() {
    inboxList.innerHTML = "";
    inboxList.appendChild(el("p", "empty-note", "Loading…"));
    var q = Object.keys(filters).filter(function (k) { return filters[k]; }).map(function (k) { return k + "=" + encodeURIComponent(filters[k]); }).join("&");
    api("/api/admin/feedback" + (q ? "?" + q : "")).then(function (r) {
      inboxList.innerHTML = "";
      if (!r.ok) { inboxList.appendChild(el("p", "empty-note", "Couldn't load feedback.")); return; }
      if (!r.body.feedback.length) { inboxList.appendChild(el("p", "empty-note", "No feedback matches these filters yet.")); return; }
      r.body.feedback.forEach(function (f) { inboxList.appendChild(feedbackItem(f)); });
    });
  }

  function feedbackItem(f) {
    var item = el("article", "admin-feedback is-" + f.status);
    var head = el("div", "account-feedback-head");
    head.appendChild(el("span", "fb-badge is-" + f.category, label(CATEGORY, f.category)));
    head.appendChild(el("span", "muted", label(FEATURE, f.feature) + (f.rating ? " · rated " + f.rating + "/5" : "") + " · " + when(f.created_at)));
    item.appendChild(head);
    item.appendChild(el("p", "account-feedback-msg", f.message));
    item.appendChild(el("p", "admin-feedback-from", "From " + (f.user_name || "a deleted account") + (f.user_email ? " · " + f.user_email : "") + " · on " + f.page));

    var controls = el("div", "admin-feedback-controls");
    var sl = el("label", "quick-add-field");
    sl.appendChild(el("span", null, "Status"));
    var status = el("select");
    STATUS.forEach(function (s) { var o = el("option", null, s[1]); o.value = s[0]; status.appendChild(o); });
    status.value = f.status;
    sl.appendChild(status);
    var nl = el("label", "quick-add-field admin-notes");
    nl.appendChild(el("span", null, "Private notes"));
    var notes = el("textarea");
    notes.rows = 2;
    notes.maxLength = 2000;
    notes.value = f.admin_notes || "";
    notes.placeholder = "e.g. Same issue as #12 — rename the button";
    nl.appendChild(notes);
    var save = el("button", "btn btn-primary btn-small", "Save");
    save.type = "button";
    var msg = el("span", "admin-save-msg");
    msg.setAttribute("aria-live", "polite");
    save.addEventListener("click", function () {
      save.disabled = true;
      msg.textContent = "Saving…";
      api("/api/admin/feedback/" + f.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status.value, adminNotes: notes.value.trim() || null })
      }).then(function (r) {
        save.disabled = false;
        msg.textContent = r.ok ? "✓ Saved" : "Couldn't save";
        if (r.ok) item.className = "admin-feedback is-" + status.value;
      });
    });
    controls.appendChild(sl);
    controls.appendChild(nl);
    controls.appendChild(save);
    controls.appendChild(msg);
    item.appendChild(controls);
    return item;
  }

  /* ----- Users ----- */
  function renderUsers() {
    var c = card("Testers", "Everyone who has signed in. Roles can only be changed by the site owner directly in the database (see ACCOUNTS_SETUP.md).", "users");
    var wrap = el("div", "table-scroll");
    var table = el("table");
    var thead = el("thead");
    var hr = el("tr");
    ["Name", "Email", "Role", "Status", "Joined", "Last sign-in", "Weeks saved", "Feedback"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    thead.appendChild(hr);
    var tbody = el("tbody");
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    c.appendChild(wrap);
    root.appendChild(c);
    api("/api/admin/users").then(function (r) {
      (r.body.users || []).forEach(function (u) {
        var tr = el("tr");
        [u.name || "—", u.email, u.role, u.status, when(u.created_at), when(u.last_login_at), u.weeks_saved, u.feedback_sent].forEach(function (v) { tr.appendChild(el("td", null, String(v))); });
        tbody.appendChild(tr);
      });
    });
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
    api("/api/admin/overview").then(function (r) {
      if (r.status === 403) { denied("Your account doesn't have admin access."); return; }
      if (!r.ok) { denied("Couldn't load the dashboard. Please refresh."); return; }
      root.innerHTML = "";
      var head = el("div", "results-head");
      var left = el("div");
      left.appendChild(el("h1", null, "Admin dashboard"));
      left.appendChild(el("p", null, "Signed in as " + account.user.email + " · updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })));
      head.appendChild(left);
      var refresh = el("button", "btn btn-secondary btn-small", "Refresh");
      refresh.type = "button";
      refresh.addEventListener("click", function () { window.location.reload(); });
      head.appendChild(refresh);
      root.appendChild(head);
      renderOverview(r.body);
      renderInboxShell();
      loadInbox();
      renderUsers();
    });
  });
})();
