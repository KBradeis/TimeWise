/* ==========================================================================
   TimeWise — My account page (account.html)
   Everything here comes from /api/me/* and is filtered on the server by the
   signed-in user's session. No user ID is ever sent from this page.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.getElementById("accountRoot");
  if (!root || !window.TimeWise) return;

  var DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var CATEGORY = { worked_well: "👍 Worked well", confusing: "🤔 Confusing", broken: "🐞 Didn't work", idea: "💡 Idea" };
  var FEATURE = { home: "Home", the_idea: "The Idea", your_week: "Your week", calendars: "Calendars", replan: "Replan",
    reflect: "Plan vs. Reality", practice: "Practice", early_access: "Early access", account: "My account", other: "Other" };
  var STATUS = { new: "Received", reviewing: "Being reviewed", resolved: "Resolved" };
  var REALITY = { done: "✓ Done", over: "⏱ Ran over", swapped: "↷ Swapped", skipped: "✕ Skipped" };

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

  function niceDate(value) {
    if (!value) return "—";
    var s = String(value);
    var ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    // A plain date (a week's Monday) is a calendar day, not a moment — read it in local time
    var d = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(s.replace(" ", "T") + (s.length === 19 ? "Z" : ""));
    return isNaN(d) ? value : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function minutes(total) {
    var h = Math.floor(total / 60) % 24, m = total % 60;
    return (h % 12 === 0 ? 12 : h % 12) + ":" + (m < 10 ? "0" : "") + m + " " + (h >= 12 ? "PM" : "AM");
  }

  function card(title, id) {
    var c = el("section", "results-card account-card");
    if (id) c.id = id;
    c.appendChild(el("h2", null, title));
    root.appendChild(c);
    return c;
  }

  function renderSignedOut(configured) {
    root.innerHTML = "";
    var c = card("Sign in to see your account");
    c.appendChild(el("p", "sub", configured
      ? "Your saved weeks, reflections, and the feedback you've sent live here. Signing in uses your Google account — we only get your name and email."
      : "Accounts aren't switched on for this copy of the site yet."));
    if (configured) {
      var a = el("a", "btn btn-primary", "Sign in with Google");
      a.href = window.TimeWise.signInUrl("/account.html");
      c.appendChild(a);
    }
  }

  function renderProfile(user) {
    var c = card("Your profile");
    var dl = el("dl", "account-profile");
    [["Name", user.name || "—"], ["Email", user.email], ["Member since", niceDate(user.createdAt)],
     ["Account type", user.role === "admin" ? "Admin" : "Tester"]].forEach(function (row) {
      dl.appendChild(el("dt", null, row[0]));
      dl.appendChild(el("dd", null, row[1]));
    });
    c.appendChild(dl);
    var actions = el("div", "account-actions");
    var go = el("a", "btn btn-primary btn-small", "Open Try It");
    go.href = "try.html";
    var out = el("button", "btn btn-secondary btn-small", "Sign out");
    out.type = "button";
    out.addEventListener("click", window.TimeWise.signOut);
    actions.appendChild(go);
    if (user.role === "admin") {
      var adm = el("a", "btn btn-secondary btn-small", "Admin dashboard");
      adm.href = "admin.html";
      actions.appendChild(adm);
    }
    actions.appendChild(out);
    c.appendChild(actions);
  }

  function renderWeeks() {
    var c = card("Your saved weeks", "my-weeks");
    c.appendChild(el("p", "sub", "Your week on Try It saves automatically while you're signed in — events, replans, and Plan vs. Reality check-ins."));
    var list = el("div", "account-list");
    list.appendChild(el("p", "empty-note", "Loading…"));
    c.appendChild(list);
    api("/api/me/weeks").then(function (r) {
      list.innerHTML = "";
      var weeks = (r.body && r.body.weeks) || [];
      if (!weeks.length) {
        list.appendChild(el("p", "empty-note", "Nothing saved yet. Add or change something on Try It and it'll show up here."));
        return;
      }
      weeks.forEach(function (w) {
        var details = el("details", "account-week");
        var summary = el("summary");
        summary.appendChild(el("strong", null, "Week of " + niceDate(w.week_start)));
        summary.appendChild(el("span", "muted", " · " + w.events + " block" + (w.events === 1 ? "" : "s") + " · updated " + niceDate(w.updated_at)));
        details.appendChild(summary);
        var inner = el("div", "account-week-body", "Loading…");
        details.appendChild(inner);
        details.addEventListener("toggle", function () {
          if (!details.open || details.dataset.loaded) return;
          details.dataset.loaded = "1";
          api("/api/me/week?start=" + encodeURIComponent(w.week_start)).then(function (res) {
            inner.innerHTML = "";
            var events = (res.body && res.body.events) || [];
            if (!events.length) { inner.appendChild(el("p", "empty-note", "This week is empty.")); return; }
            var ul = el("ul", "account-events");
            events.slice().sort(function (a, b) { return a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes; }).forEach(function (ev) {
              var li = el("li");
              li.appendChild(el("span", "account-event-when", DAY_NAMES[ev.dayIndex] + " " + (ev.allDay ? "all day" : minutes(ev.startMinutes))));
              li.appendChild(el("span", "account-event-title", ev.title));
              if (ev.reality) li.appendChild(el("span", "account-event-status is-" + ev.reality.status, REALITY[ev.reality.status] + (ev.reality.status === "over" ? " " + ev.reality.detail + " min" : "")));
              ul.appendChild(li);
            });
            inner.appendChild(ul);
          });
        });
        list.appendChild(details);
      });
    });
  }

  function renderFeedback() {
    var c = card("Feedback you've sent", "my-feedback");
    var top = el("div", "account-card-head");
    top.appendChild(el("p", "sub", "Thank you! Here's what you've told us and where each note stands."));
    var send = el("button", "btn btn-primary btn-small", "Send feedback");
    send.type = "button";
    send.addEventListener("click", window.TimeWise.openFeedback);
    top.appendChild(send);
    c.appendChild(top);
    var list = el("div", "account-list");
    list.appendChild(el("p", "empty-note", "Loading…"));
    c.appendChild(list);
    api("/api/me/feedback").then(function (r) {
      list.innerHTML = "";
      var items = (r.body && r.body.feedback) || [];
      if (!items.length) { list.appendChild(el("p", "empty-note", "You haven't sent any feedback yet — the 💬 Feedback button is on every page.")); return; }
      items.forEach(function (f) {
        var item = el("article", "account-feedback");
        var head = el("div", "account-feedback-head");
        head.appendChild(el("span", "fb-badge is-" + f.category, CATEGORY[f.category] || f.category));
        head.appendChild(el("span", "muted", (FEATURE[f.feature] || f.feature) + " · " + niceDate(f.created_at)));
        head.appendChild(el("span", "fb-status is-" + f.status, STATUS[f.status] || f.status));
        item.appendChild(head);
        item.appendChild(el("p", "account-feedback-msg", f.message));
        list.appendChild(item);
      });
    });
  }

  function renderDelete(user) {
    var c = card("Delete my account");
    c.classList.add("account-danger");
    c.appendChild(el("p", "sub", "This permanently deletes your account and saved weeks and signs you out. Feedback you've sent is kept, but no longer linked to you."));
    var reveal = el("button", "btn btn-secondary btn-small", "Delete my account…");
    reveal.type = "button";
    var form = el("form", "account-delete-form");
    form.hidden = true;
    var label = el("label", "quick-add-field");
    label.appendChild(el("span", null, "Type DELETE to confirm"));
    var input = el("input");
    input.type = "text";
    input.autocomplete = "off";
    label.appendChild(input);
    var confirm = el("button", "btn btn-danger btn-small", "Permanently delete");
    confirm.type = "submit";
    var status = el("p", "ics-status");
    status.setAttribute("aria-live", "polite");
    form.appendChild(label);
    form.appendChild(confirm);
    form.appendChild(status);
    reveal.addEventListener("click", function () { form.hidden = false; reveal.hidden = true; input.focus(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (input.value !== "DELETE") { status.textContent = "Type DELETE in capital letters to confirm."; status.className = "ics-status is-error"; return; }
      confirm.disabled = true;
      api("/api/me/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) })
        .then(function (r) {
          if (r.ok) { window.location.href = "index.html"; return; }
          confirm.disabled = false;
          status.className = "ics-status is-error";
          status.textContent = r.body.error === "last_admin"
            ? "You're the only admin, so this account can't be deleted until another admin exists."
            : "That didn't work. Please try again.";
        });
    });
    c.appendChild(reveal);
    c.appendChild(form);
  }

  window.TimeWise.ready.then(function (account) {
    if (!account.available || !account.signedIn) { renderSignedOut(account.available && account.configured); return; }
    root.innerHTML = "";
    renderProfile(account.user);
    renderWeeks();
    renderFeedback();
    renderDelete(account.user);
    if (window.location.hash) {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  });
})();
