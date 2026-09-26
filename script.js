/* ==========================================================================
   TimeWise — Pitch Site Behavior
   Sections: 1. Mobile nav toggle  2. Question bank  3. Local storage helpers
   4. App state  5. Screen switching  6. Home screen rendering
   7. Quiz rendering & answer handling  8. Summary rendering  9. Event wiring
   10. Your Week grid  11. Quick add  12. Google Calendar + Notion
   13. .ics upload  14. Plan vs. Reality  15. Replan my day
   16. Early access + anonymous feature counts
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- 1. Mobile nav toggle ---------- */
  const navToggle = document.getElementById("navToggle");
  const primaryNav = document.getElementById("primaryNav");

  if (navToggle && primaryNav) {
    navToggle.addEventListener("click", function () {
      const isOpen = primaryNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Close the mobile menu after a nav link is tapped
    primaryNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        primaryNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- 2. Question bank ----------
     10 short time-management questions for the practice demo.
     Each question has 4 choices; correctIndex points to the right one.
     Correct-answer letters are intentionally arranged so the same
     letter never appears correct twice in a row (2,1,3,0,2,3,1,0,2,1). */
  const QUESTIONS = [
    {
      question: "It's Sunday night and you realize you have three assignments due this week. What's the most helpful first step?",
      choices: [
        "Start with whichever one feels easiest and hope for the best",
        "Scroll social media until the stress passes",
        "List each deadline and jot down roughly how long each task will take",
        "Wait until Wednesday to see which one becomes most urgent"
      ],
      correctIndex: 2,
      feedbackCorrect: "Exactly — a quick deadline map turns an overwhelming week into a clear plan.",
      feedbackIncorrect: "Totally understandable instinct. A quick deadline map (C) usually makes the week feel a lot more manageable."
    },
    {
      question: "You just received a big project due in three weeks. When's the most useful time to start planning?",
      choices: [
        "The night before it's due",
        "Right away — even just to break it into smaller steps",
        "After every other smaller assignment is finished",
        "Only once you start to feel stressed about it"
      ],
      correctIndex: 1,
      feedbackCorrect: "Great instinct! Early planning turns a big project into a series of small, doable wins.",
      feedbackIncorrect: "No worries — starting early (B), even just to outline steps, makes big projects way less intimidating."
    },
    {
      question: "You keep picking up your phone every few minutes while trying to study. What's a supportive next move?",
      choices: [
        "Decide you just aren't a disciplined person",
        "Try to study and text at the same time",
        "Give up on studying for tonight",
        "Study in short focused sprints with your phone out of reach"
      ],
      correctIndex: 3,
      feedbackCorrect: "Yes! Short, focused sprints make it much easier to resist the phone pull.",
      feedbackIncorrect: "That's a common struggle, not a character flaw. Try short sprints with your phone out of reach (D)."
    },
    {
      question: "You have a work shift, a study group, and a paper due — all in the same week. What helps most?",
      choices: [
        "Block out time for each commitment on a calendar, even roughly",
        "Try to remember everything without writing it down",
        "Cancel the study group without telling anyone",
        "Only think about whichever thing is due first"
      ],
      correctIndex: 0,
      feedbackCorrect: "Right! Putting everything on a calendar — even loosely — helps you spot conflicts before they become emergencies.",
      feedbackIncorrect: "It happens to everyone. Blocking time for each commitment (A), even roughly, helps you spot conflicts early."
    },
    {
      question: "You finish a task earlier than expected. What's a time-management-friendly way to use the extra time?",
      choices: [
        "Immediately start doomscrolling",
        "Feel guilty for finishing early",
        "Get a head start on your next deadline or take an intentional break",
        "Add on tasks you weren't planning to do today"
      ],
      correctIndex: 2,
      feedbackCorrect: "Love that. Using extra time intentionally — getting ahead or resting on purpose — keeps your momentum going.",
      feedbackIncorrect: "No judgment here — next time try C: get a head start or take an intentional break."
    },
    {
      question: "You've been putting off an assignment for a few days. What's the most realistic next step?",
      choices: [
        "Wait for motivation to magically show up",
        "Tell yourself you'll definitely start tomorrow",
        "Avoid thinking about it until it's due",
        "Commit to just 10 focused minutes on it right now"
      ],
      correctIndex: 3,
      feedbackCorrect: "Exactly — a tiny 10-minute start is often all it takes to break through procrastination.",
      feedbackIncorrect: "Procrastination happens to everyone. Try D: commit to just 10 minutes — momentum tends to follow."
    },
    {
      question: "Your week feels overloaded with classes, work, and family responsibilities. What's a good starting point?",
      choices: [
        "Try to do everything at 100% with no adjustments",
        "Identify your must-dos versus your nice-to-dos this week",
        "Drop everything that feels hard",
        "Ignore the schedule and hope it works out"
      ],
      correctIndex: 1,
      feedbackCorrect: "Yes! Separating must-dos from nice-to-dos gives you permission to focus where it matters most.",
      feedbackIncorrect: "That's a lot to carry. Try B: sort your must-dos from your nice-to-dos first."
    },
    {
      question: "You want to make sure a deadline doesn't sneak up on you again. What helps most?",
      choices: [
        "Set a reminder a few days before the deadline, not just on the day",
        "Rely on remembering it later",
        "Only think about deadlines the morning they're due",
        "Ask a friend to remind you if they happen to think of it"
      ],
      correctIndex: 0,
      feedbackCorrect: "Smart move! A reminder a few days out gives you real buffer time to prepare.",
      feedbackIncorrect: "Easy to miss! Try A next time: set a reminder a few days early, not just on the day."
    },
    {
      question: "You just had a rough, unproductive day. What's the most helpful mindset going into tomorrow?",
      choices: [
        "Tell yourself you're bad at managing time",
        "Try to make up for it by overworking tomorrow",
        "Notice what happened without judgment and adjust your plan",
        "Skip planning altogether since it 'didn't work'"
      ],
      correctIndex: 2,
      feedbackCorrect: "That's the mindset! Reflecting without judgment is how real progress happens over time.",
      feedbackIncorrect: "One rough day doesn't undo your progress. Try C: reflect without judgment and adjust."
    },
    {
      question: "Looking back at this week, what's a sign your time was aligned with your goals?",
      choices: [
        "You were busy every single hour",
        "You made progress on things that actually matter to you",
        "You said yes to every request that came your way",
        "You didn't check your calendar at all"
      ],
      correctIndex: 1,
      feedbackCorrect: "Exactly! Busy isn't the goal — progress on what matters to you is.",
      feedbackIncorrect: "Being busy doesn't always mean progress. B is the real marker: progress on what matters to you."
    }
  ];

  const XP_PER_CORRECT = 15;
  const LETTERS = ["A", "B", "C", "D"];
  const STORAGE_KEY = "timewise-demo-progress";

  /* ---------- 3. Local storage helpers ----------
     Wrapped in try/catch so the demo still works if storage is
     unavailable (private browsing, blocked cookies, etc). */
  function loadProgress() {
    const fallback = { totalXp: 0, bestStreak: 0, sessionsCompleted: 0, focusGoal: "" };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return Object.assign(fallback, parsed);
    } catch (err) {
      return fallback;
    }
  }

  function saveProgress(progress) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (err) {
      /* Storage unavailable — the demo simply won't persist between visits. */
    }
  }

  /* ---------- 4. App state ---------- */
  let progress = loadProgress();

  let session = {
    index: 0,
    score: 0,
    streak: 0,
    bestStreakThisSession: 0,
    xpEarned: 0,
    answered: false
  };

  /* ---------- 5. Screen switching ---------- */
  const screens = {
    home: document.getElementById("screenHome"),
    quiz: document.getElementById("screenQuiz"),
    summary: document.getElementById("screenSummary")
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      if (!screens[key]) return;
      screens[key].hidden = key !== name;
    });
  }

  /* ---------- 6. Home screen rendering ---------- */
  const homeGreeting = document.getElementById("homeGreeting");
  const homeBestStreak = document.getElementById("homeBestStreak");
  const homeTotalXp = document.getElementById("homeTotalXp");
  const homeSessions = document.getElementById("homeSessions");
  const focusGoalInput = document.getElementById("focusGoalInput");

  function renderHome() {
    if (homeGreeting) {
      homeGreeting.textContent = progress.sessionsCompleted > 0
        ? "Welcome back! Ready for another round?"
        : "Welcome! Let's practice a time management skill.";
    }
    if (homeBestStreak) homeBestStreak.textContent = String(progress.bestStreak);
    if (homeTotalXp) homeTotalXp.textContent = String(progress.totalXp);
    if (homeSessions) homeSessions.textContent = String(progress.sessionsCompleted);
    if (focusGoalInput && progress.focusGoal) {
      focusGoalInput.value = progress.focusGoal;
    }
  }

  /* ---------- 7. Quiz rendering & answer handling ---------- */
  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  const quizScore = document.getElementById("quizScore");
  const quizStreak = document.getElementById("quizStreak");
  const quizXp = document.getElementById("quizXp");
  const quizQuestionCount = document.getElementById("quizQuestionCount");
  const quizQuestion = document.getElementById("quizQuestion");
  const answerList = document.getElementById("answerList");
  const feedbackBanner = document.getElementById("feedbackBanner");
  const feedbackText = document.getElementById("feedbackText");
  const nextQuestionBtn = document.getElementById("nextQuestionBtn");

  function startSession() {
    // Save the optional focus goal so the home screen can personalize copy
    if (focusGoalInput) {
      progress.focusGoal = focusGoalInput.value.trim();
      saveProgress(progress);
    }

    session = {
      index: 0,
      score: 0,
      streak: 0,
      bestStreakThisSession: 0,
      xpEarned: 0,
      answered: false
    };

    showScreen("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const total = QUESTIONS.length;
    const current = QUESTIONS[session.index];

    session.answered = false;

    // Progress bar + stats
    const percent = Math.round((session.index / total) * 100);
    if (progressFill) progressFill.style.width = percent + "%";
    if (progressBar) progressBar.setAttribute("aria-valuenow", String(session.index));
    if (quizScore) quizScore.textContent = String(session.score);
    if (quizStreak) quizStreak.textContent = String(session.streak);
    if (quizXp) quizXp.textContent = String(session.xpEarned);
    if (quizQuestionCount) {
      quizQuestionCount.textContent = "Question " + (session.index + 1) + " of " + total;
    }
    if (quizQuestion) quizQuestion.textContent = current.question;

    // Build answer buttons fresh for each question
    if (answerList) {
      answerList.innerHTML = "";
      current.choices.forEach(function (choiceText, choiceIndex) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "answer-btn";
        btn.setAttribute("data-index", String(choiceIndex));

        const letter = document.createElement("span");
        letter.className = "answer-letter";
        letter.textContent = LETTERS[choiceIndex];

        const label = document.createElement("span");
        label.textContent = choiceText;

        btn.appendChild(letter);
        btn.appendChild(label);
        btn.addEventListener("click", function () {
          handleAnswer(choiceIndex, btn);
        });

        answerList.appendChild(btn);
      });
    }

    if (feedbackBanner) feedbackBanner.hidden = true;
  }

  function handleAnswer(choiceIndex, buttonEl) {
    if (session.answered) return;
    session.answered = true;

    const current = QUESTIONS[session.index];
    const isCorrect = choiceIndex === current.correctIndex;

    // Lock all answer buttons and reveal correct/incorrect styling
    const allButtons = answerList.querySelectorAll(".answer-btn");
    allButtons.forEach(function (btn) {
      btn.disabled = true;
      const btnIndex = Number(btn.getAttribute("data-index"));
      if (btnIndex === current.correctIndex) {
        btn.classList.add("is-correct");
      } else if (btn === buttonEl) {
        btn.classList.add("is-incorrect");
      }
    });

    if (isCorrect) {
      session.score += 1;
      session.streak += 1;
      session.xpEarned += XP_PER_CORRECT;
      session.bestStreakThisSession = Math.max(session.bestStreakThisSession, session.streak);
    } else {
      session.streak = 0;
    }

    // Refresh stats row immediately so score/streak/XP feel live
    if (quizScore) quizScore.textContent = String(session.score);
    if (quizStreak) quizStreak.textContent = String(session.streak);
    if (quizXp) quizXp.textContent = String(session.xpEarned);

    if (feedbackText) {
      feedbackText.textContent = isCorrect ? current.feedbackCorrect : current.feedbackIncorrect;
    }
    if (feedbackBanner) feedbackBanner.hidden = false;
    if (nextQuestionBtn) {
      nextQuestionBtn.textContent = session.index === QUESTIONS.length - 1 ? "See My Results" : "Next Question";
      nextQuestionBtn.focus();
    }
  }

  function goToNextQuestion() {
    if (session.index < QUESTIONS.length - 1) {
      session.index += 1;
      renderQuestion();
    } else {
      finishSession();
    }
  }

  /* ---------- 8. Summary rendering ---------- */
  const summaryScore = document.getElementById("summaryScore");
  const summaryStreak = document.getElementById("summaryStreak");
  const summaryXp = document.getElementById("summaryXp");
  const summaryTakeaway = document.getElementById("summaryTakeaway");
  const summaryNextSteps = document.getElementById("summaryNextSteps");

  function finishSession() {
    const total = QUESTIONS.length;
    track("quiz_completed");

    // Fill the progress bar completely for a satisfying finish
    if (progressFill) progressFill.style.width = "100%";

    // Update persistent progress
    progress.totalXp += session.xpEarned;
    progress.bestStreak = Math.max(progress.bestStreak, session.bestStreakThisSession);
    progress.sessionsCompleted += 1;
    saveProgress(progress);

    if (summaryScore) summaryScore.textContent = session.score + "/" + total;
    if (summaryStreak) summaryStreak.textContent = String(session.bestStreakThisSession);
    if (summaryXp) summaryXp.textContent = "+" + session.xpEarned;

    if (summaryTakeaway) {
      summaryTakeaway.textContent = buildTakeaway(session.score, total);
    }
    if (summaryNextSteps) {
      summaryNextSteps.innerHTML = "";
      buildNextSteps().forEach(function (stepText) {
        const li = document.createElement("li");
        li.textContent = stepText;
        summaryNextSteps.appendChild(li);
      });
    }

    showScreen("summary");
  }

  function buildTakeaway(score, total) {
    const goal = progress.focusGoal ? " with \"" + progress.focusGoal + "\" in mind" : "";
    if (score === total) {
      return "You showed strong instincts for planning ahead and staying kind to yourself" + goal + ". That mindset is what makes habits stick.";
    }
    if (score >= total * 0.7) {
      return "You're already reflecting on your time thoughtfully" + goal + ". A few small tweaks can make your plan even more realistic.";
    }
    if (score >= total * 0.4) {
      return "You're building awareness of where your time goes" + goal + " — that's the first and hardest step. Progress, not perfection.";
    }
    return "Every session is practice, not a test. You showed up and reflected" + goal + ", and that's exactly how the habit gets built.";
  }

  function buildNextSteps() {
    return [
      "Pick one deadline this week and block time for it on your calendar.",
      "Try a single 10-minute focused sprint on the task you've been avoiding.",
      "Check in with yourself tomorrow: did your time match what mattered most?"
    ];
  }

  /* ---------- 9. Event wiring ---------- */
  const startPracticeBtn = document.getElementById("startPracticeBtn");
  const restartPracticeBtn = document.getElementById("restartPracticeBtn");
  const backHomeBtn = document.getElementById("backHomeBtn");

  if (startPracticeBtn) startPracticeBtn.addEventListener("click", startSession);
  if (restartPracticeBtn) restartPracticeBtn.addEventListener("click", startSession);
  if (nextQuestionBtn) nextQuestionBtn.addEventListener("click", goToNextQuestion);
  if (backHomeBtn) {
    backHomeBtn.addEventListener("click", function () {
      renderHome();
      showScreen("home");
    });
  }

  /* ---------- 10. Your Week — the shared schedule ----------
     Every input in the Calendars section (quick add, the Google/Notion
     preview, and the .ics upload) pushes events into `weekEvents`, and
     renderAll() repaints both the week grid and the Plan vs. Reality
     check-in below it. Event shape:
       { id, title, dayIndex (0 = Mon … 6 = Sun), startMinutes, endMinutes,
         allDay, category ("class" | "assignment" | "personal" | "timewise"),
         source ("sample" | "manual" | "google" | "notion" | "ics" | "timewise"),
         reality: null | { status, detail } }
     Nothing here is saved — it all lives in memory for this page visit. */
  var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var CATEGORIES = ["class", "assignment", "personal", "timewise"];
  var SOURCE_TAGS = { "google-demo": "Demo", "notion-demo": "Demo", google: "Google", notion: "Notion", timewise: "TimeWise" };
  var STATUS_ICONS = { done: "✓", over: "⏱", swapped: "↷", skipped: "✕" };
  var STATUS_LABELS = { done: "Done", over: "Ran over", swapped: "Swapped", skipped: "Skipped" };

  function startOfWeek(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  var weekStart = startOfWeek(new Date());
  var todayIndex = (new Date().getDay() + 6) % 7;

  function dateForDay(dayIndex) {
    var d = new Date(weekStart);
    d.setDate(d.getDate() + dayIndex);
    return d;
  }

  function dayIndexForDate(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    var diff = Math.round((d - weekStart) / 86400000);
    return diff >= 0 && diff < 7 ? diff : -1;
  }

  function formatMinutes(total) {
    var h = Math.floor(total / 60) % 24;
    var m = total % 60;
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ":" + (m < 10 ? "0" : "") + m + " " + (h >= 12 ? "PM" : "AM");
  }

  function formatEventTime(ev) {
    if (ev.allDay) return "All day";
    if (ev.endMinutes == null) return formatMinutes(ev.startMinutes);
    return formatMinutes(ev.startMinutes) + " – " + formatMinutes(ev.endMinutes);
  }

  function eventDuration(ev) {
    if (ev.allDay) return 0;
    if (ev.endMinutes != null && ev.endMinutes > ev.startMinutes) return ev.endMinutes - ev.startMinutes;
    return 60;
  }

  function eventEnd(ev) {
    return ev.startMinutes + eventDuration(ev);
  }

  function roundUpTo(value, step) {
    return Math.ceil(value / step) * step;
  }

  function weekRangeLabel() {
    var opts = { month: "short", day: "numeric" };
    return weekStart.toLocaleDateString(undefined, opts) + " – " + dateForDay(6).toLocaleDateString(undefined, opts);
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = "ics-status" + (kind ? " is-" + kind : "");
  }

  var weekEvents = [];
  var nextEventId = 1;

  function addWeekEvent(data) {
    var ev = {
      id: nextEventId++,
      title: String(data.title || "Untitled event").slice(0, 80),
      dayIndex: data.dayIndex,
      startMinutes: data.startMinutes || 0,
      endMinutes: data.endMinutes == null ? null : Math.min(data.endMinutes, 1439),
      allDay: !!data.allDay,
      category: CATEGORIES.indexOf(data.category) !== -1 ? data.category : "personal",
      source: data.source || "manual",
      reality: null
    };
    weekEvents.push(ev);
    return ev;
  }

  function removeWeekEvents(predicate) {
    weekEvents = weekEvents.filter(function (ev) { return !predicate(ev); });
  }

  function findWeekEvent(id) {
    for (var i = 0; i < weekEvents.length; i++) {
      if (weekEvents[i].id === id) return weekEvents[i];
    }
    return null;
  }

  function eventsForDay(dayIndex) {
    return weekEvents
      .filter(function (ev) { return ev.dayIndex === dayIndex; })
      .sort(function (a, b) {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.startMinutes - b.startMinutes;
      });
  }

  /* Maya's week — the same student from the Storyboard. Loaded on page open so
     visitors see a realistic week immediately; "Clear my week" removes it.
     [dayIndex, title, startMinutes, endMinutes, category] */
  var SAMPLE_WEEK = [
    [0, "BUS 131A Lecture", 570, 650, "class"],
    [0, "Econ problem set", 660, 750, "assignment"],
    [0, "Shift at Campus Café", 840, 1020, "personal"],
    [0, "Gym", 1080, 1140, "personal"],
    [0, "Essay draft", 1200, 1320, "assignment"],
    [1, "BIO 201 Lecture", 600, 675, "class"],
    [1, "BIO 201 Lab", 780, 900, "class"],
    [1, "Club officer meeting", 1050, 1110, "personal"],
    [1, "Read Ch. 5 + notes", 1170, 1260, "assignment"],
    [2, "BUS 131A Lecture", 570, 650, "class"],
    [2, "Econ problem set", 660, 750, "assignment"],
    [2, "Shift at Campus Café", 840, 1020, "personal"],
    [2, "Essay draft", 1200, 1320, "assignment"],
    [3, "BIO 201 Lecture", 600, 675, "class"],
    [3, "Study group: Calc II", 1080, 1200, "assignment"],
    [3, "Econ problem set due", 1439, null, "assignment"],
    [4, "BUS 131A Lecture", 570, 650, "class"],
    [4, "Group project meeting", 720, 780, "class"],
    [4, "Shift at Campus Café", 840, 1080, "personal"],
    [5, "Laundry + errands", 660, 750, "personal"],
    [5, "Dinner with friends", 1110, 1230, "personal"],
    [6, "Weekly reset: plan next week", 1020, 1050, "personal"],
    [6, "Essay final pass", 1140, 1260, "assignment"]
  ];

  function loadSampleWeek() {
    SAMPLE_WEEK.forEach(function (row) {
      addWeekEvent({ dayIndex: row[0], title: row[1], startMinutes: row[2], endMinutes: row[3], category: row[4], source: "sample" });
    });
  }

  const weekGrid = document.getElementById("weekGrid");
  const weekClearBtn = document.getElementById("weekClearBtn");
  const weekGridNote = document.getElementById("weekGridNote");

  function buildWeekEventChip(ev) {
    var li = document.createElement("li");
    li.className = "week-event week-event-" + ev.category + (ev.reality ? " is-" + ev.reality.status : "");

    var time = document.createElement("span");
    time.className = "week-event-time";
    if (ev.reality) {
      var status = document.createElement("span");
      status.className = "week-event-status";
      status.textContent = STATUS_ICONS[ev.reality.status] + " ";
      status.title = STATUS_LABELS[ev.reality.status];
      time.appendChild(status);
    }
    time.appendChild(document.createTextNode(formatEventTime(ev)));
    li.appendChild(time);

    var title = document.createElement("span");
    title.className = "week-event-title";
    title.textContent = ev.title;
    li.appendChild(title);

    if (SOURCE_TAGS[ev.source]) {
      var tag = document.createElement("span");
      tag.className = "week-event-tag";
      tag.textContent = SOURCE_TAGS[ev.source];
      li.appendChild(tag);
    }

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "week-event-remove";
    remove.setAttribute("aria-label", "Remove " + ev.title);
    remove.textContent = "×";
    remove.addEventListener("click", function () {
      removeWeekEvents(function (item) { return item.id === ev.id; });
      renderAll();
    });
    li.appendChild(remove);

    return li;
  }

  function renderWeekGrid() {
    if (!weekGrid) return;
    weekGrid.innerHTML = "";

    for (var i = 0; i < 7; i++) {
      var col = document.createElement("div");
      col.className = "week-day" + (i === todayIndex ? " is-today" : "");

      var head = document.createElement("div");
      head.className = "week-day-head";
      var name = document.createElement("span");
      name.className = "week-day-name";
      name.textContent = DAY_SHORT[i];
      var date = document.createElement("span");
      date.className = "week-day-date";
      date.textContent = dateForDay(i).getDate();
      head.appendChild(name);
      head.appendChild(date);
      if (i === todayIndex) {
        var badge = document.createElement("span");
        badge.className = "week-today-badge";
        badge.textContent = "Today";
        head.appendChild(badge);
      }
      col.appendChild(head);

      var list = document.createElement("ul");
      list.className = "week-day-events";
      var dayEvents = eventsForDay(i);
      if (!dayEvents.length) {
        var empty = document.createElement("li");
        empty.className = "week-day-empty";
        empty.textContent = "Free";
        list.appendChild(empty);
      }
      dayEvents.forEach(function (ev) { list.appendChild(buildWeekEventChip(ev)); });
      col.appendChild(list);

      weekGrid.appendChild(col);
    }

    if (weekClearBtn) weekClearBtn.textContent = weekEvents.length ? "Clear my week" : "Load Maya's sample week";
    if (weekGridNote) {
      var hasSample = weekEvents.some(function (ev) { return ev.source === "sample"; });
      weekGridNote.textContent = hasSample
        ? "Showing Maya's sample week — add your own events below, or clear it to start fresh."
        : weekRangeLabel();
    }
  }

  function renderAll() {
    renderWeekGrid();
    renderReality();
    // Keep an open (not yet applied) replan in sync with the grid
    renderReplanBlocks();
    if (replanState.plan && !replanState.applied) replanState.plan = buildReplan();
    renderReplanResult();
  }

  if (weekClearBtn) {
    weekClearBtn.addEventListener("click", function () {
      if (weekEvents.length) {
        weekEvents = [];
        realityState.shown = {};
        realityState.added = {};
        replanState.plan = null;
        providerButtons.forEach(resetProviderButton);
        setStatus(providerStatusNote, "", "");
        setStatus(icsStatus, "", "");
      } else {
        loadSampleWeek();
      }
      renderAll();
    });
  }

  /* ---------- 11. Add an event by hand ---------- */
  const quickAddForm = document.getElementById("quickAddForm");
  const quickAddTitle = document.getElementById("quickAddTitle");
  const quickAddCategory = document.getElementById("quickAddCategory");
  const quickAddDate = document.getElementById("quickAddDate");
  const quickAddStart = document.getElementById("quickAddStart");
  const quickAddEnd = document.getElementById("quickAddEnd");
  const quickAddStatus = document.getElementById("quickAddStatus");

  function toInputDate(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function parseTimeInput(value) {
    if (!value) return null;
    var parts = value.split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  if (quickAddDate) {
    quickAddDate.value = toInputDate(dateForDay(todayIndex));
    quickAddDate.min = toInputDate(weekStart);
    quickAddDate.max = toInputDate(dateForDay(6));
  }

  if (quickAddForm) {
    quickAddForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var title = quickAddTitle.value.trim();
      if (!title) return;

      var parts = quickAddDate.value.split("-");
      var dayIndex = parts.length === 3
        ? dayIndexForDate(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])))
        : -1;
      if (dayIndex === -1) {
        setStatus(quickAddStatus, "The demo grid shows this week only (" + weekRangeLabel() + ") — pick a date in that range.", "error");
        return;
      }

      var start = parseTimeInput(quickAddStart.value);
      if (start == null) return;
      var end = parseTimeInput(quickAddEnd.value);
      if (end != null && end <= start) end = null;

      addWeekEvent({
        title: title,
        dayIndex: dayIndex,
        startMinutes: start,
        endMinutes: end,
        category: quickAddCategory.value,
        source: "manual"
      });
      renderAll();
      setStatus(quickAddStatus, "Added “" + title + "” to " + DAY_NAMES[dayIndex] + ".", "success");
      track("event_added");
      quickAddTitle.value = "";
      quickAddEnd.value = "";
      quickAddTitle.focus();
    });
  }

  /* ---------- 12. Google Calendar + Notion — real, read-only connections ----------
     Google Calendar: runs entirely in the visitor's browser using Google
       Identity Services. It only needs the OAuth Client ID below (not a
       secret). See README → "Connecting Google Calendar".
     Notion: goes through the small Cloudflare Worker in worker.js, because
       Notion's API can't be called from a browser and its sign-in needs a
       secret. See README → "Connecting Notion".
     Both are read-only and only fetch this Monday–Sunday week. If a
     connection isn't set up on this copy of the site (no Client ID yet, or
     running on GitHub Pages / locally), its button falls back to the old
     preview with clearly labeled sample events, so the page never breaks. */
  var GOOGLE_CLIENT_ID = ""; // e.g. "123456789-abc123.apps.googleusercontent.com"
  var GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
  var MAX_GOOGLE_CALENDARS = 10;

  const providerButtons = document.querySelectorAll(".provider-btn");
  const providerStatusNote = document.getElementById("providerStatusNote");
  const googleBtn = document.querySelector('.provider-btn[data-provider="google"]');
  const notionBtn = document.querySelector('.provider-btn[data-provider="notion"]');

  // "real" once a real connection is available; otherwise the sample preview is used
  var providerMode = { google: GOOGLE_CLIENT_ID ? "real" : "preview", notion: "preview" };
  var googleTokenClient = null;
  var googleAccessToken = null;

  var PROVIDER_SAMPLE_EVENTS = {
    google: function () {
      var d1 = Math.min(todayIndex + 1, 6);
      var d2 = Math.min(todayIndex + 2, 6);
      return [
        { dayIndex: d1, title: "Advising appointment", startMinutes: 930, endMinutes: 960, category: "personal" },
        { dayIndex: d1, title: "Office hours: BIO 201", startMinutes: 720, endMinutes: 780, category: "class" },
        { dayIndex: d2, title: "Career fair", startMinutes: 780, endMinutes: 900, category: "personal" }
      ];
    },
    notion: function () {
      return [
        { dayIndex: todayIndex, title: "Draft essay outline", startMinutes: 1260, endMinutes: 1320, category: "assignment" },
        { dayIndex: Math.min(todayIndex + 1, 6), title: "Club meeting notes due", startMinutes: 1200, endMinutes: null, category: "assignment" },
        { dayIndex: 4, title: "Internship application due", startMinutes: 1020, endMinutes: null, category: "assignment" }
      ];
    }
  };

  function resetProviderButton(btn) {
    btn.classList.remove("is-connected");
    btn.disabled = false;
    if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
  }

  function setProviderBusy(btn, text) {
    btn.disabled = true;
    btn.textContent = text;
  }

  function setProviderConnected(btn, label) {
    btn.disabled = false;
    btn.classList.add("is-connected");
    btn.textContent = "✓ Connected — " + label;
    btn.title = "Click to disconnect";
  }

  function removeProviderEvents(provider) {
    removeWeekEvents(function (ev) { return ev.source === provider || ev.source === provider + "-demo"; });
  }

  function parseLocalDate(str) {
    var p = String(str).slice(0, 10).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  /* Puts real events from a calendar into the grid. The first time real data
     arrives, Maya's sample week is cleared so visitors see only their own
     schedule. Items: { title, start: Date, end: Date|null, allDay } */
  function replaceWithRealEvents(source, items) {
    removeProviderEvents(source);
    var clearedSample = weekEvents.some(function (ev) { return ev.source === "sample"; });
    if (clearedSample) removeWeekEvents(function (ev) { return ev.source === "sample"; });

    var added = 0;
    items.forEach(function (item) {
      var dayIndex = dayIndexForDate(item.start);
      if (dayIndex === -1 || added >= MAX_ICS_EVENTS_IN_WEEK) return;
      var startMinutes = item.allDay ? 0 : item.start.getHours() * 60 + item.start.getMinutes();
      var endMinutes = null;
      if (!item.allDay && item.end && dayIndexForDate(item.end) === dayIndex) {
        endMinutes = item.end.getHours() * 60 + item.end.getMinutes();
        if (endMinutes <= startMinutes) endMinutes = null;
      }
      addWeekEvent({
        title: item.title,
        dayIndex: dayIndex,
        startMinutes: startMinutes,
        endMinutes: endMinutes,
        allDay: item.allDay,
        category: guessCategory(item.title),
        source: source
      });
      added++;
    });

    track("calendar_" + source);
    if (clearedSample) {
      replanState.plan = null;
      realityState.shown = {};
      realityState.added = {};
      realityState.dayIndex = defaultRealityDay();
    }
    renderAll();
    return { added: added, clearedSample: clearedSample };
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  /* ----- Preview fallback (used when a real connection isn't set up) ----- */
  function togglePreview(btn, provider, label) {
    if (btn.classList.contains("is-connected")) {
      resetProviderButton(btn);
      removeProviderEvents(provider);
      renderAll();
      setStatus(providerStatusNote, "Disconnected " + label + " — its sample events were removed.", "");
      return;
    }
    setProviderBusy(btn, "Connecting…");
    setTimeout(function () {
      setProviderConnected(btn, label + " (preview)");
      var events = PROVIDER_SAMPLE_EVENTS[provider]();
      events.forEach(function (data) {
        data.source = provider + "-demo";
        addWeekEvent(data);
      });
      renderAll();
      setStatus(providerStatusNote, "Preview only: added " + events.length + " sample events marked “Demo”. " +
        "A real " + label + " connection isn't set up on this copy of the site yet (see the README).", "success");
    }, 700);
  }

  /* ----- Google Calendar (Google Identity Services, browser-only) ----- */
  function initGoogle() {
    if (!GOOGLE_CLIENT_ID) return;
    var script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = function () {
      googleTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPE,
        callback: function (response) {
          if (response.error) {
            googleFailed("Google didn't connect (" + response.error + ").");
            return;
          }
          if (!google.accounts.oauth2.hasGrantedAllScopes(response, GOOGLE_SCOPE)) {
            googleFailed("TimeWise needs permission to see your calendar — tick that box on Google's screen and try again.");
            return;
          }
          googleAccessToken = response.access_token;
          loadGoogleWeek();
        },
        error_callback: function (err) {
          googleFailed(err && err.type === "popup_closed"
            ? "The Google sign-in window was closed — nothing was connected."
            : "Couldn't open Google sign-in. If your browser blocked a pop-up, allow it and try again.");
        }
      });
    };
    script.onerror = function () {
      googleFailed("Couldn't load Google sign-in — check your connection or ad blocker.");
    };
    document.head.appendChild(script);
  }

  function googleFailed(message) {
    resetProviderButton(googleBtn);
    setStatus(providerStatusNote, message, "error");
  }

  function googleGet(path, params) {
    var url = "https://www.googleapis.com/calendar/v3" + path + "?" + new URLSearchParams(params).toString();
    return fetch(url, { headers: { Authorization: "Bearer " + googleAccessToken } }).then(function (res) {
      if (!res.ok) throw new Error("Google responded with " + res.status);
      return res.json();
    });
  }

  function loadGoogleWeek() {
    setProviderBusy(googleBtn, "Loading your week…");
    googleGet("/users/me/calendarList", { minAccessRole: "reader", maxResults: "50" })
      .then(function (list) {
        // Calendars ticked in the visitor's Google Calendar sidebar, primary first
        var calendars = (list.items || [])
          .filter(function (cal) { return cal.selected || cal.primary; })
          .slice(0, MAX_GOOGLE_CALENDARS);
        return Promise.all(calendars.map(function (cal) {
          return googleGet("/calendars/" + encodeURIComponent(cal.id) + "/events", {
            timeMin: weekStart.toISOString(),
            timeMax: dateForDay(7).toISOString(),
            singleEvents: "true", // expands repeating events (like weekly classes)
            orderBy: "startTime",
            maxResults: "100"
          }).then(function (data) { return data.items || []; }, function () { return []; });
        })).then(function (lists) {
          return { calendars: calendars.length, items: [].concat.apply([], lists) };
        });
      })
      .then(function (result) {
        var items = result.items
          .filter(function (ev) { return ev.status !== "cancelled" && ev.start; })
          .map(function (ev) {
            var allDay = !ev.start.dateTime;
            return {
              title: ev.summary || "(No title)",
              start: allDay ? parseLocalDate(ev.start.date) : new Date(ev.start.dateTime),
              end: ev.end && ev.end.dateTime ? new Date(ev.end.dateTime) : null,
              allDay: allDay
            };
          });
        var outcome = replaceWithRealEvents("google", items);
        setProviderConnected(googleBtn, "Google Calendar");
        setStatus(providerStatusNote, "Added " + plural(outcome.added, "event") + " from " +
          plural(result.calendars, "Google calendar") + " for this week" +
          (outcome.clearedSample ? " (Maya's sample week was cleared)" : "") +
          ". Read-only — nothing in your Google account was changed.", "success");
      })
      .catch(function (err) {
        googleFailed("Couldn't load your Google Calendar: " + err.message + ".");
      });
  }

  function disconnectGoogle() {
    if (googleAccessToken && window.google) google.accounts.oauth2.revoke(googleAccessToken, function () {});
    googleAccessToken = null;
    resetProviderButton(googleBtn);
    removeProviderEvents("google");
    renderAll();
    setStatus(providerStatusNote, "Disconnected Google Calendar and removed its events from this page.", "");
  }

  /* ----- Notion (through the Worker's /api/notion/* routes) ----- */
  var NOTION_ERRORS = {
    denied: "You cancelled the Notion connection — nothing was shared.",
    state: "That Notion sign-in expired or came from another tab — please try again.",
    token: "Notion didn't accept the sign-in. Double-check the client ID, secret, and redirect URI (see the README).",
    not_configured: "Notion isn't set up on this copy of the site yet (see the README)."
  };

  function checkNotion() {
    // Show the result of a sign-in that just redirected back here, then tidy the URL
    var params = new URLSearchParams(window.location.search);
    var returned = params.get("notion");
    if (returned === "error") {
      setStatus(providerStatusNote, NOTION_ERRORS[params.get("reason")] || "Notion didn't connect — please try again.", "error");
    }
    if (returned && window.history.replaceState) {
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    }

    if (window.location.protocol === "file:") return;
    fetch("/api/notion/status", { credentials: "same-origin" })
      .then(function (res) {
        var isJson = (res.headers.get("Content-Type") || "").indexOf("application/json") !== -1;
        return res.ok && isJson ? res.json() : null;
      })
      .then(function (status) {
        if (!status || !status.configured) return; // not on the Cloudflare Worker, or no secrets yet
        providerMode.notion = "real";
        if (status.connected) loadNotionWeek(status.workspace);
      })
      .catch(function () { /* stays in preview mode */ });
  }

  // Result message from the sign-in pop-up (see backToSite() in worker.js)
  window.addEventListener("message", function (e) {
    if (e.origin !== window.location.origin || !e.data || e.data.type !== "timewise-notion") return;
    if (e.data.result === "connected") {
      fetch("/api/notion/status", { credentials: "same-origin" })
        .then(function (res) { return res.json(); })
        .then(function (status) { loadNotionWeek(status.workspace); })
        .catch(function () { loadNotionWeek(""); });
    } else {
      resetProviderButton(notionBtn);
      setStatus(providerStatusNote, NOTION_ERRORS[e.data.reason] || "Notion didn't connect — please try again.", "error");
    }
  });

  function loadNotionWeek(workspace) {
    setProviderBusy(notionBtn, "Loading from Notion…");
    var start = toInputDate(dateForDay(-1)); // a day of padding each side for time zones
    var end = toInputDate(dateForDay(7));
    fetch("/api/notion/events?start=" + start + "&end=" + end, { credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) throw new Error("not_connected");
        if (!res.ok) throw new Error("Notion responded with " + res.status);
        return res.json();
      })
      .then(function (data) {
        var items = (data.events || []).map(function (ev) {
          var allDay = String(ev.start).length <= 10;
          return {
            title: ev.title,
            start: allDay ? parseLocalDate(ev.start) : new Date(ev.start),
            end: ev.end && String(ev.end).length > 10 ? new Date(ev.end) : null,
            allDay: allDay
          };
        });
        var outcome = replaceWithRealEvents("notion", items);
        setProviderConnected(notionBtn, "Notion" + (workspace ? " (" + workspace + ")" : ""));

        var message;
        if (!data.databases) {
          message = "Connected, but no databases with a Date property were shared. Disconnect, reconnect, and pick " +
            "a database like a task list or assignment tracker on Notion's screen.";
        } else if (!outcome.added) {
          message = "Connected! None of your " + plural(data.databases, "shared database") + " have items dated this week.";
        } else {
          message = "Added " + plural(outcome.added, "item") + " from " + plural(data.databases, "Notion database") +
            (outcome.clearedSample ? " (Maya's sample week was cleared)" : "") + ". Read-only — nothing in Notion was changed.";
        }
        setStatus(providerStatusNote, message, "success");
      })
      .catch(function (err) {
        resetProviderButton(notionBtn);
        setStatus(providerStatusNote, err.message === "not_connected"
          ? "Your Notion sign-in expired — click Connect Notion to reconnect."
          : "Couldn't load from Notion: " + err.message + ".", "error");
      });
  }

  function disconnectNotion() {
    fetch("/api/notion/disconnect", { method: "POST", credentials: "same-origin" }).catch(function () {});
    resetProviderButton(notionBtn);
    removeProviderEvents("notion");
    renderAll();
    setStatus(providerStatusNote, "Disconnected Notion and removed its items from this page. To fully revoke access, " +
      "remove TimeWise under Settings → Connections in Notion.", "");
  }

  /* ----- Button wiring ----- */
  providerButtons.forEach(function (btn) {
    btn.dataset.originalHtml = btn.innerHTML;

    btn.addEventListener("click", function () {
      var provider = btn.getAttribute("data-provider");
      var label = btn.getAttribute("data-label");
      if (btn.disabled) return;

      if (providerMode[provider] !== "real") {
        togglePreview(btn, provider, label);
        return;
      }

      if (provider === "google") {
        if (btn.classList.contains("is-connected")) return disconnectGoogle();
        if (!googleTokenClient) {
          setStatus(providerStatusNote, "Google sign-in is still loading — try again in a moment.", "error");
          return;
        }
        setProviderBusy(btn, "Waiting for Google…");
        googleTokenClient.requestAccessToken(); // must run directly inside the click, or pop-up blockers step in
      } else if (provider === "notion") {
        if (btn.classList.contains("is-connected")) return disconnectNotion();
        // Sign in through a pop-up so anything already on the grid stays put;
        // if pop-ups are blocked, fall back to a normal full-page redirect.
        var popup = window.open("/api/notion/login?popup=1", "timewise-notion", "width=560,height=720");
        if (!popup) {
          setProviderBusy(btn, "Opening Notion…");
          window.location.href = "/api/notion/login";
          return;
        }
        setProviderBusy(btn, "Waiting for Notion…");
        var watchPopup = setInterval(function () {
          if (popup.closed) {
            clearInterval(watchPopup);
            if (btn.textContent === "Waiting for Notion…") resetProviderButton(btn); // closed without finishing
          }
        }, 800);
      }
    });
  });

  /* ---------- 13. Calendar file (.ics) upload — real, client-side only ---------- */
  const icsFileInput = document.getElementById("icsFileInput");
  const icsStatus = document.getElementById("icsStatus");

  var MAX_ICS_SIZE = 2 * 1024 * 1024; // 2MB is plenty for a calendar export
  var MAX_ICS_EVENTS_IN_WEEK = 60;
  var ICS_DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

  function unescapeIcsText(value) {
    return value
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
  }

  function parseIcsDate(raw) {
    // raw looks like "20260925T140000Z", "20260925T140000", or "20260925"
    var isUtc = /Z$/.test(raw);
    var datePart = raw.slice(0, 8);
    var year = Number(datePart.slice(0, 4));
    var month = Number(datePart.slice(4, 6)) - 1;
    var day = Number(datePart.slice(6, 8));

    if (raw.length <= 8) {
      return { date: new Date(year, month, day), allDay: true };
    }

    var timePart = raw.slice(9, 15);
    var hour = Number(timePart.slice(0, 2)) || 0;
    var minute = Number(timePart.slice(2, 4)) || 0;
    var second = Number(timePart.slice(4, 6)) || 0;

    var date = isUtc
      ? new Date(Date.UTC(year, month, day, hour, minute, second))
      : new Date(year, month, day, hour, minute, second);

    return { date: date, allDay: false };
  }

  function parseIcs(text) {
    // Unfold wrapped lines: a continuation line starts with a space or tab (RFC 5545)
    var rawLines = text.split(/\r\n|\n|\r/);
    var lines = [];
    rawLines.forEach(function (line) {
      if ((line.charAt(0) === " " || line.charAt(0) === "\t") && lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
    });

    var events = [];
    var current = null;

    lines.forEach(function (line) {
      if (line === "BEGIN:VEVENT") {
        current = { title: "Untitled event", start: null, end: null, allDay: false, location: "", rrule: null };
        return;
      }
      if (line === "END:VEVENT") {
        if (current && current.start) events.push(current);
        current = null;
        return;
      }
      if (!current) return;

      var colonIndex = line.indexOf(":");
      if (colonIndex === -1) return;
      var propRaw = line.slice(0, colonIndex);
      var value = line.slice(colonIndex + 1);
      var prop = propRaw.split(";")[0].toUpperCase();

      if (prop === "SUMMARY") {
        current.title = unescapeIcsText(value) || "Untitled event";
      } else if (prop === "DTSTART") {
        var parsed = parseIcsDate(value);
        current.start = parsed.date;
        current.allDay = parsed.allDay;
      } else if (prop === "DTEND") {
        current.end = parseIcsDate(value).date;
      } else if (prop === "RRULE") {
        current.rrule = value;
      } else if (prop === "LOCATION") {
        current.location = unescapeIcsText(value);
      }
    });

    events.sort(function (a, b) {
      return a.start - b.start;
    });

    return events;
  }

  function parseRrule(value) {
    var rule = {};
    value.split(";").forEach(function (part) {
      var kv = part.split("=");
      if (kv.length === 2) rule[kv[0].toUpperCase()] = kv[1];
    });
    return rule;
  }

  /* Returns the start times of every occurrence of `event` that falls in this
     Monday–Sunday week. Handles one-off events plus the simple DAILY / WEEKLY
     repeats that class schedules use (INTERVAL, BYDAY, UNTIL, COUNT). */
  function occurrencesThisWeek(event) {
    var startDay = new Date(event.start);
    startDay.setHours(0, 0, 0, 0);
    var rule = event.rrule ? parseRrule(event.rrule) : null;

    if (!rule || (rule.FREQ !== "DAILY" && rule.FREQ !== "WEEKLY")) {
      return dayIndexForDate(event.start) !== -1 ? [new Date(event.start)] : [];
    }

    var interval = Math.max(1, Number(rule.INTERVAL) || 1);
    var count = rule.COUNT ? Number(rule.COUNT) : null;
    var until = null;
    if (rule.UNTIL) {
      until = parseIcsDate(rule.UNTIL).date;
      if (rule.UNTIL.length <= 8) until.setHours(23, 59, 59, 999);
    }
    var byDay = rule.BYDAY
      ? rule.BYDAY.split(",").map(function (code) {
          return ICS_DAY_CODES.indexOf(code.replace(/^[+-]?\d+/, "").toUpperCase());
        }).filter(function (i) { return i !== -1; })
      : [(startDay.getDay() + 6) % 7];
    var weeksBetween = Math.round((weekStart - startOfWeek(startDay)) / (7 * 86400000));

    var dates = [];
    for (var i = 0; i < 7; i++) {
      var day = dateForDay(i);
      if (day < startDay) continue;
      var occurrence = new Date(day);
      occurrence.setHours(event.start.getHours(), event.start.getMinutes(), 0, 0);
      if (until && occurrence > until) continue;

      if (rule.FREQ === "DAILY") {
        var daysBetween = Math.round((day - startDay) / 86400000);
        if (daysBetween % interval !== 0) continue;
        if (count && daysBetween / interval >= count) continue;
      } else {
        if (byDay.indexOf(i) === -1) continue;
        if (weeksBetween % interval !== 0) continue;
        if (count && (weeksBetween / interval) * byDay.length >= count) continue;
      }
      dates.push(occurrence);
    }
    return dates;
  }

  function guessCategory(title) {
    var t = title.toLowerCase();
    if (/\b(due|assignment|homework|hw|quiz|exam|midterm|final|essay|paper|project|problem set|pset|submit|submission|deadline|reading)\b/.test(t)) {
      return "assignment";
    }
    if (/\b(lecture|class|lab|seminar|recitation|section|discussion|office hours|tutorial)\b/.test(t) ||
        /\b[a-z]{2,4}\s?\d{2,3}[a-z]?\b/.test(t)) {
      return "class";
    }
    return "personal";
  }

  if (icsFileInput) {
    icsFileInput.addEventListener("change", function () {
      var file = icsFileInput.files && icsFileInput.files[0];
      if (!file) return;

      if (file.size > MAX_ICS_SIZE) {
        setStatus(icsStatus, "That file is a bit large for the demo — try a smaller export.", "error");
        icsFileInput.value = "";
        return;
      }

      setStatus(icsStatus, "Reading your calendar…", "");

      var reader = new FileReader();
      reader.onload = function () {
        try {
          var allEvents = parseIcs(String(reader.result));
          if (!allEvents.length) {
            setStatus(icsStatus, "Couldn't find any events in that file.", "error");
            return;
          }

          // A new upload replaces the previous one
          removeWeekEvents(function (ev) { return ev.source === "ics"; });
          var added = 0;
          allEvents.forEach(function (event) {
            occurrencesThisWeek(event).forEach(function (occ) {
              if (added >= MAX_ICS_EVENTS_IN_WEEK) return;
              var startMinutes = occ.getHours() * 60 + occ.getMinutes();
              var endMinutes = null;
              if (!event.allDay && event.end) {
                var length = Math.round((event.end - event.start) / 60000);
                if (length > 0 && startMinutes + length < 1440) endMinutes = startMinutes + length;
              }
              addWeekEvent({
                title: event.title,
                dayIndex: dayIndexForDate(occ),
                startMinutes: event.allDay ? 0 : startMinutes,
                endMinutes: endMinutes,
                allDay: event.allDay,
                category: guessCategory(event.title),
                source: "ics"
              });
              added++;
            });
          });
          renderAll();

          var total = allEvents.length + " event" + (allEvents.length === 1 ? "" : "s");
          if (added) {
            track("calendar_ics");
            setStatus(icsStatus, "Added " + added + " event" + (added === 1 ? "" : "s") + " from this week to your grid (" +
              total + " in the file).", "success");
          } else {
            setStatus(icsStatus, "Found " + total + " in that file, but none fall in this week (" + weekRangeLabel() + ").", "success");
          }
        } catch (err) {
          setStatus(icsStatus, "Couldn't read that file — make sure it's a .ics calendar export.", "error");
        } finally {
          icsFileInput.value = ""; // lets the same file be chosen again
        }
      };
      reader.onerror = function () {
        setStatus(icsStatus, "Couldn't read that file. Please try again.", "error");
        icsFileInput.value = "";
      };
      reader.readAsText(file);
    });
  }

  /* ---------- 14. Plan vs. Reality ----------
     Pick a day, mark what actually happened to each planned block, and a
     small rule-based engine (buildReflection) turns it into one insight and
     one concrete next step — which can be added straight onto the next day
     in the week grid. No AI or server involved: every rule is below. */
  var REALITY_STATUSES = ["done", "over", "swapped", "skipped"];
  var REALITY_REASONS = [
    ["", "What got in the way? (optional)"],
    ["overflow", "Something earlier ran long"],
    ["energy", "Ran out of energy"],
    ["urgent", "Something urgent came up"],
    ["distracted", "Got distracted"],
    ["bigger", "It was bigger than I planned"],
    ["avoid", "Didn't feel like starting it"]
  ];
  var OVERRUN_OPTIONS = [15, 30, 45, 60, 90];

  const realityDayTabs = document.getElementById("realityDayTabs");
  const realityDayTitle = document.getElementById("realityDayTitle");
  const realityFutureNote = document.getElementById("realityFutureNote");
  const realityList = document.getElementById("realityList");
  const realityReflectBtn = document.getElementById("realityReflectBtn");
  const realityExampleBtn = document.getElementById("realityExampleBtn");
  const realityResult = document.getElementById("realityResult");

  var realityState = { dayIndex: todayIndex, shown: {}, added: {} };

  function reflectableEvents(dayIndex) {
    return eventsForDay(dayIndex).filter(function (ev) { return !ev.allDay; });
  }

  function defaultRealityDay() {
    for (var i = todayIndex; i >= 0; i--) {
      if (reflectableEvents(i).length) return i;
    }
    return todayIndex;
  }

  /* ----- The reflection engine ----- */
  function slipPhrase(ev) {
    return ev.reality.status === "skipped" ? "got skipped" : "got swapped out";
  }

  function nextDayInfo(dayIndex) {
    var target = dayIndex < 6 ? dayIndex + 1 : -1;
    var when = target === -1 ? "next Monday" : (dayIndex === todayIndex ? "tomorrow" : "on " + DAY_NAMES[target]);
    return { target: target, when: when };
  }

  function findFreeSlot(dayIndex, from, to, duration) {
    var busy = reflectableEvents(dayIndex);
    var cursor = roundUpTo(from, 15);
    for (var i = 0; i < busy.length; i++) {
      var s = busy[i].startMinutes;
      var e = eventEnd(busy[i]);
      if (e <= cursor) continue;
      if (s >= cursor + duration && cursor + duration <= to) return cursor;
      cursor = Math.max(cursor, roundUpTo(e, 15));
      if (cursor + duration > to) return null;
    }
    return cursor + duration <= to ? cursor : null;
  }

  // "Add an N-minute buffer after <anchor block> tomorrow"
  // The anchor is the same block tomorrow if it repeats, otherwise the block
  // closest in time of day to where today's trouble happened.
  function bufferStep(dayIndex, preferTitle, preferMinutes, minutes, why) {
    var next = nextDayInfo(dayIndex);
    minutes = Math.min(Math.max(roundUpTo(minutes, 15), 15), 60);

    if (next.target === -1) {
      return { parts: ["Build a ", { b: minutes + "-minute buffer" }, " into next week after your longest block, " + why], action: null };
    }

    var candidates = reflectableEvents(next.target).filter(function (ev) { return ev.source !== "timewise"; });
    var anchor = null;
    if (preferTitle) {
      anchor = candidates.filter(function (ev) { return ev.title.toLowerCase() === preferTitle.toLowerCase(); })[0] || null;
    }
    if (!anchor && candidates.length) {
      anchor = candidates.slice().sort(function (a, b) {
        return Math.abs(a.startMinutes - preferMinutes) - Math.abs(b.startMinutes - preferMinutes);
      })[0];
    }

    if (!anchor) {
      return scheduleStep(dayIndex, {
        lead: ["Keep a ", { b: minutes + "-minute buffer" }, " open"],
        title: "Buffer", duration: minutes, from: 720, to: 1260,
        tail: "Slack in the plan is what keeps one delay from sinking the day."
      });
    }

    var start = eventEnd(anchor);
    return {
      parts: ["Add a ", { b: minutes + "-minute buffer" }, " after ", { b: anchor.title }, " " + next.when +
        " (it ends at " + formatMinutes(start) + "), " + why],
      action: { dayIndex: next.target, title: "Buffer after " + anchor.title, startMinutes: start, endMinutes: start + minutes }
    };
  }

  // "Do <something> tomorrow at <first free slot>"
  function scheduleStep(dayIndex, opts) {
    var next = nextDayInfo(dayIndex);
    var tail = opts.tail ? " " + opts.tail : "";
    if (next.target === -1) {
      return { parts: opts.lead.concat([" next Monday." + tail]), action: null };
    }
    var slot = findFreeSlot(next.target, opts.from, opts.to, opts.duration);
    if (slot === null) slot = findFreeSlot(next.target, 480, 1380, opts.duration);
    if (slot === null) {
      return { parts: opts.lead.concat([" " + next.when + " — that day looks packed, so pick the smallest version that fits." + tail]), action: null };
    }
    return {
      parts: opts.lead.concat([" " + next.when + " at ", { b: formatMinutes(slot) + " – " + formatMinutes(slot + opts.duration) }, "." + tail]),
      action: { dayIndex: next.target, title: opts.title, startMinutes: slot, endMinutes: slot + opts.duration }
    };
  }

  function buildReflection(dayIndex) {
    var events = reflectableEvents(dayIndex);
    var marked = events.filter(function (ev) { return ev.reality; });
    if (!marked.length) return null;

    var counts = { done: 0, over: 0, swapped: 0, skipped: 0 };
    var overMinutes = 0;
    marked.forEach(function (ev) {
      counts[ev.reality.status]++;
      if (ev.reality.status === "over") overMinutes += Number(ev.reality.detail) || 0;
    });

    var slips = marked.filter(function (ev) { return ev.reality.status === "swapped" || ev.reality.status === "skipped"; });
    var overs = marked.filter(function (ev) { return ev.reality.status === "over"; });

    var tally = {};
    var topReason = "";
    slips.forEach(function (ev) {
      var r = ev.reality.detail;
      if (!r) return;
      tally[r] = (tally[r] || 0) + 1;
      if (!topReason || tally[r] > tally[topReason]) topReason = r;
    });

    // A cascade = a block ran over and something *later* slipped because of it
    var cascade = null;
    overs.some(function (o) {
      var s = slips.filter(function (ev) {
        return ev.startMinutes > o.startMinutes && (!ev.reality.detail || ev.reality.detail === "overflow");
      })[0];
      if (s) cascade = { over: o, slip: s };
      return !!s;
    });

    var r = { events: events, marked: marked, counts: counts, overMinutes: overMinutes };
    var step;

    if (cascade) {
      var m = Number(cascade.over.reality.detail) || 30;
      r.title = "One overrun set off a chain reaction";
      r.insight = [{ b: cascade.over.title }, " ran about " + m + " minutes over, and ", { b: cascade.slip.title },
        " " + slipPhrase(cascade.slip) + " later. That's a cascade: one long block knocked over the rest of the plan. It's a planning gap, not an effort gap."];
      step = bufferStep(dayIndex, cascade.over.title, cascade.over.startMinutes, m, "so one long block can't sink the next one.");
    } else if (slips.length) {
      var s = slips.filter(function (ev) { return ev.reality.detail === topReason; })[0] || slips[0];
      var dur = Math.min(eventDuration(s), 120);
      var reason = topReason || (s.startMinutes >= 1080 ? "energy" : "");

      if (reason === "energy") {
        r.title = "Your energy ran out before your plan did";
        r.insight = [{ b: s.title }, " was planned for " + formatMinutes(s.startMinutes) +
          (s.startMinutes >= 1080 ? ", after a full day," : "") + " and it " + slipPhrase(s) +
          ". When the blocks that slip are the tiring ones, that's an energy pattern — not a motivation problem."];
        step = scheduleStep(dayIndex, {
          lead: ["Move ", { b: s.title }, " to when you're fresher"],
          title: s.title + " (earlier slot)", duration: dur, from: 540, to: 1020,
          tail: "Save evenings for lighter tasks."
        });
      } else if (reason === "overflow") {
        r.title = "Something earlier ran long";
        r.insight = [{ b: s.title }, " " + slipPhrase(s) + " because an earlier block spilled over. When a day has zero slack, one delay pushes everything after it."];
        step = bufferStep(dayIndex, null, Math.max(s.startMinutes - 120, 480), 30, "so a delay has somewhere to land.");
      } else if (reason === "urgent") {
        r.title = "Surprises are part of a real week";
        r.insight = [{ b: s.title }, " " + slipPhrase(s) + " when something urgent came up. That's not a failure — it just means your plan needs room for the unexpected."];
        step = scheduleStep(dayIndex, {
          lead: ["Keep one ", { b: "45-minute flex block" }, " open"],
          title: "Flex block (for surprises)", duration: 45, from: 720, to: 1080,
          tail: "Whatever comes up gets that slot instead of your plan."
        });
      } else if (reason === "distracted") {
        r.title = "Starting was the hard part";
        r.insight = [{ b: s.title }, " " + slipPhrase(s) + " because your attention wandered. Long, open-ended blocks make that easy — short, defined ones make it harder."];
        step = scheduleStep(dayIndex, {
          lead: ["Start ", { b: s.title }, " with a 25-minute phone-away sprint"],
          title: "Focus sprint: " + s.title, duration: 25, from: 540, to: 1260,
          tail: "Just 25 minutes — you're allowed to stop after."
        });
      } else if (reason === "bigger") {
        var bigger = Math.min(roundUpTo(eventDuration(s) * 1.5, 15), 180);
        r.title = "The task was bigger than the time";
        r.insight = [{ b: s.title }, " needed more than the " + eventDuration(s) + " minutes you gave it. Most people underestimate tasks by about half — it's normal, and it's fixable."];
        step = scheduleStep(dayIndex, {
          lead: ["Give ", { b: s.title }, " " + bigger + " minutes instead of " + eventDuration(s)],
          title: s.title + " (1.5× time)", duration: bigger, from: 540, to: 1260,
          tail: "A plan that fits beats a plan that's perfect."
        });
      } else if (reason === "avoid") {
        r.title = "The first step felt too big";
        r.insight = [{ b: s.title }, " was hard to start. Avoidance usually means a task feels fuzzy or heavy — not that you're lazy."];
        step = scheduleStep(dayIndex, {
          lead: ["Shrink it to a ", { b: "15-minute first step" }, " on ", { b: s.title }],
          title: "First step: " + s.title, duration: 15, from: 540, to: 1260,
          tail: "Open it and write three bullet points. That's the whole goal."
        });
      } else {
        r.title = "One block didn't find its place";
        r.insight = [{ b: s.title }, " " + slipPhrase(s) + ". Instead of squeezing it in wherever it fits, give it a real home."];
        step = scheduleStep(dayIndex, {
          lead: ["Give ", { b: s.title }, " its own slot"],
          title: s.title + " (rescheduled)", duration: dur, from: 540, to: 1080,
          tail: "A specific time makes it far more likely to happen."
        });
      }
    } else if (overs.length) {
      var biggest = overs.slice().sort(function (a, b) { return (Number(b.reality.detail) || 0) - (Number(a.reality.detail) || 0); })[0];
      r.title = "Everything happened — it just took longer";
      r.insight = ["You kept every block you checked in on, but about " + overMinutes + " extra minutes spilled past the plan — mostly from ",
        { b: biggest.title }, ". Your time estimates are running a little short, which is really common."];
      step = bufferStep(dayIndex, biggest.title, biggest.startMinutes, Number(biggest.reality.detail) || 30, "so the extra time has somewhere to go.");
    } else {
      r.title = "Your plan matched your day";
      r.insight = ["Every block you checked in on happened as planned. That means the plan fit your real time and energy — exactly the skill TimeWise is built to practice."];
      step = scheduleStep(dayIndex, {
        lead: ["Add a ", { b: "10-minute plan-ahead check-in" }],
        title: "Plan-ahead check-in", duration: 10, from: 1230, to: 1380,
        tail: "Same shape, same wins."
      });
    }

    r.step = step.parts;
    r.action = step.action;
    return r;
  }

  /* Pre-fills a realistic set of answers so the demo can be shown in one click */
  function applyMayaAnswers(dayIndex) {
    var events = reflectableEvents(dayIndex);
    var n = events.length;
    events.forEach(function (ev, i) {
      if (n >= 3 && i === n - 1) ev.reality = { status: "skipped", detail: "energy" };
      else if (i === 1) ev.reality = { status: "over", detail: 45 };
      else if (i === 3) ev.reality = { status: "swapped", detail: "overflow" };
      else ev.reality = { status: "done", detail: "" };
    });
  }

  /* ----- Rendering ----- */
  function appendParts(el, parts) {
    parts.forEach(function (part) {
      if (typeof part === "string") {
        el.appendChild(document.createTextNode(part));
      } else {
        var strong = document.createElement("strong");
        strong.textContent = part.b;
        el.appendChild(strong);
      }
    });
  }

  function renderRealityTabs() {
    if (!realityDayTabs) return;
    realityDayTabs.innerHTML = "";
    for (var i = 0; i < 7; i++) {
      (function (dayIndex) {
        var events = reflectableEvents(dayIndex);
        var checked = events.filter(function (ev) { return ev.reality; }).length;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "reality-day-tab" + (dayIndex === todayIndex ? " is-today" : "");
        btn.dataset.day = dayIndex;
        btn.setAttribute("aria-pressed", String(dayIndex === realityState.dayIndex));

        var name = document.createElement("span");
        name.className = "reality-day-tab-name";
        name.textContent = DAY_SHORT[dayIndex] + " " + dateForDay(dayIndex).getDate();
        var meta = document.createElement("span");
        meta.className = "reality-day-tab-meta";
        if (events.length && checked === events.length) meta.textContent = "✓ Checked in";
        else if (dayIndex === todayIndex) meta.textContent = "Today";
        else meta.textContent = events.length + " block" + (events.length === 1 ? "" : "s");
        btn.appendChild(name);
        btn.appendChild(meta);

        btn.addEventListener("click", function () {
          realityState.dayIndex = dayIndex;
          renderReality();
          var again = realityDayTabs.querySelector('[data-day="' + dayIndex + '"]');
          if (again) again.focus();
        });
        realityDayTabs.appendChild(btn);
      })(i);
    }
  }

  function buildSelect(options, value, label) {
    var select = document.createElement("select");
    select.setAttribute("aria-label", label);
    options.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt[0];
      o.textContent = opt[1];
      if (String(opt[0]) === String(value)) o.selected = true;
      select.appendChild(o);
    });
    return select;
  }

  function setRealityStatus(id, status) {
    var ev = findWeekEvent(id);
    if (!ev) return;
    if (ev.reality && ev.reality.status === status) {
      ev.reality = null; // tapping the active choice again clears it
    } else {
      ev.reality = { status: status, detail: status === "over" ? 30 : "" };
    }
    delete realityState.added[realityState.dayIndex];
    renderWeekGrid();
    renderReality();
    var again = realityList.querySelector('[data-id="' + id + '"] .reality-choice.is-' + status);
    if (again) again.focus();
  }

  function renderRealityList() {
    if (!realityList) return;
    var day = realityState.dayIndex;
    var events = reflectableEvents(day);

    realityDayTitle.textContent = DAY_NAMES[day] + (day === todayIndex ? " (today)" : "");
    realityFutureNote.hidden = !(day > todayIndex && events.length);
    realityList.innerHTML = "";

    if (!events.length) {
      var empty = document.createElement("li");
      empty.className = "reality-empty-day";
      empty.textContent = "Nothing with a set time is planned for " + DAY_NAMES[day] +
        ". Add a few blocks in Your Week above, then come back to check in.";
      realityList.appendChild(empty);
      realityExampleBtn.hidden = true;
      realityReflectBtn.disabled = true;
      return;
    }
    realityExampleBtn.hidden = false;

    events.forEach(function (ev) {
      var li = document.createElement("li");
      li.className = "reality-item";
      li.dataset.id = ev.id;

      var info = document.createElement("div");
      info.className = "reality-item-info";
      var dot = document.createElement("span");
      dot.className = "reality-dot reality-dot-" + ev.category;
      var text = document.createElement("div");
      var title = document.createElement("span");
      title.className = "reality-item-title";
      title.textContent = ev.title;
      var time = document.createElement("span");
      time.className = "reality-item-time";
      time.textContent = formatEventTime(ev);
      text.appendChild(title);
      text.appendChild(time);
      info.appendChild(dot);
      info.appendChild(text);
      li.appendChild(info);

      var choices = document.createElement("div");
      choices.className = "reality-choices";
      choices.setAttribute("role", "group");
      choices.setAttribute("aria-label", "What happened to " + ev.title + "?");
      REALITY_STATUSES.forEach(function (status) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "reality-choice is-" + status;
        btn.setAttribute("aria-pressed", String(!!(ev.reality && ev.reality.status === status)));
        var icon = document.createElement("span");
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = STATUS_ICONS[status];
        btn.appendChild(icon);
        btn.appendChild(document.createTextNode(" " + STATUS_LABELS[status]));
        btn.addEventListener("click", function () { setRealityStatus(ev.id, status); });
        choices.appendChild(btn);
      });
      li.appendChild(choices);

      if (ev.reality && ev.reality.status !== "done") {
        var detail = document.createElement("label");
        detail.className = "reality-detail";
        var select;
        if (ev.reality.status === "over") {
          detail.appendChild(document.createTextNode("By about"));
          select = buildSelect(OVERRUN_OPTIONS.map(function (m) { return [m, m + " min"]; }), ev.reality.detail, "How long it ran over");
          select.addEventListener("change", function () {
            ev.reality.detail = Number(select.value);
            delete realityState.added[day];
            renderRealityResult();
          });
        } else {
          select = buildSelect(REALITY_REASONS, ev.reality.detail, "What got in the way of " + ev.title);
          select.addEventListener("change", function () {
            ev.reality.detail = select.value;
            delete realityState.added[day];
            renderRealityResult();
          });
        }
        detail.appendChild(select);
        li.appendChild(detail);
      }

      realityList.appendChild(li);
    });

    realityReflectBtn.disabled = !events.some(function (ev) { return ev.reality; });
  }

  function renderRealityResult() {
    if (!realityResult) return;
    var day = realityState.dayIndex;
    realityResult.innerHTML = "";
    var reflection = realityState.shown[day] ? buildReflection(day) : null;

    if (!reflection) {
      var placeholder = document.createElement("div");
      placeholder.className = "reality-placeholder";
      placeholder.innerHTML =
        '<span class="reality-placeholder-icon" aria-hidden="true">🔍</span>' +
        "<h4>Your reflection shows up here</h4>" +
        "<p>Mark what happened to each block, then tap <strong>See my reflection</strong>. " +
        "You'll get one honest insight and one realistic next step — no guilt trip.</p>";
      realityResult.appendChild(placeholder);
      return;
    }

    // Score
    var marked = reflection.marked.length;
    var score = document.createElement("div");
    score.className = "reality-score";
    var num = document.createElement("div");
    num.className = "reality-score-num";
    num.innerHTML = reflection.counts.done + "<small>/" + marked + "</small>";
    var label = document.createElement("div");
    label.className = "reality-score-label";
    label.textContent = "blocks went as planned";
    var sub = document.createElement("small");
    var subBits = [];
    if (reflection.overMinutes) subBits.push("+" + reflection.overMinutes + " min over plan");
    if (marked < reflection.events.length) subBits.push(marked + " of " + reflection.events.length + " checked in");
    sub.textContent = subBits.join(" · ");
    label.appendChild(sub);
    score.appendChild(num);
    score.appendChild(label);
    realityResult.appendChild(score);

    // Stacked bar + legend
    var bar = document.createElement("div");
    bar.className = "reality-bar";
    bar.setAttribute("role", "img");
    var legend = document.createElement("ul");
    legend.className = "reality-bar-legend";
    var summary = [];
    REALITY_STATUSES.forEach(function (status) {
      var count = reflection.counts[status];
      if (!count) return;
      var seg = document.createElement("span");
      seg.className = "reality-bar-seg is-" + status;
      seg.style.flexGrow = count;
      bar.appendChild(seg);
      var item = document.createElement("li");
      var swatch = document.createElement("span");
      swatch.className = "reality-bar-swatch is-" + status;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(STATUS_LABELS[status] + " " + count));
      legend.appendChild(item);
      summary.push(count + " " + STATUS_LABELS[status].toLowerCase());
    });
    bar.setAttribute("aria-label", summary.join(", "));
    realityResult.appendChild(bar);
    realityResult.appendChild(legend);

    // Insight
    var insight = document.createElement("div");
    insight.className = "reality-card reality-insight";
    insight.innerHTML = '<span class="pill pill-purple">🔍 What happened</span>';
    var h4 = document.createElement("h4");
    h4.textContent = reflection.title;
    var p = document.createElement("p");
    appendParts(p, reflection.insight);
    insight.appendChild(h4);
    insight.appendChild(p);
    realityResult.appendChild(insight);

    // Next step
    var next = document.createElement("div");
    next.className = "reality-card reality-next";
    next.innerHTML = '<span class="pill pill-green">➡️ Your next step</span>';
    var stepP = document.createElement("p");
    appendParts(stepP, reflection.step);
    next.appendChild(stepP);

    var addedEvent = realityState.added[day] ? findWeekEvent(realityState.added[day]) : null;
    if (addedEvent) {
      var done = document.createElement("p");
      done.className = "reality-added";
      done.tabIndex = -1;
      done.appendChild(document.createTextNode("✓ Added to " + DAY_NAMES[addedEvent.dayIndex] + " at " +
        formatMinutes(addedEvent.startMinutes) + ". "));
      var link = document.createElement("a");
      link.href = "#calendars";
      link.textContent = "See it in Your Week ↑";
      done.appendChild(link);
      next.appendChild(done);
    } else if (reflection.action) {
      var action = reflection.action;
      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-primary btn-small reality-add-btn";
      addBtn.textContent = "+ Add to " + DAY_NAMES[action.dayIndex] + "'s plan";
      addBtn.addEventListener("click", function () {
        var ev = addWeekEvent({
          title: action.title,
          dayIndex: action.dayIndex,
          startMinutes: action.startMinutes,
          endMinutes: action.endMinutes,
          category: "timewise",
          source: "timewise"
        });
        realityState.added[day] = ev.id;
        renderAll();
        track("reflection_step_added");
        var note = realityResult.querySelector(".reality-added");
        if (note) note.focus();
      });
      next.appendChild(addBtn);
    }
    realityResult.appendChild(next);
  }

  function renderReality() {
    renderRealityTabs();
    renderRealityList();
    renderRealityResult();
  }

  if (realityReflectBtn) {
    realityReflectBtn.addEventListener("click", function () {
      realityState.shown[realityState.dayIndex] = true;
      renderRealityResult();
      track("reflection_viewed");
      if (window.matchMedia("(max-width: 960px)").matches) {
        realityResult.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (realityExampleBtn) {
    realityExampleBtn.addEventListener("click", function () {
      // The example needs a reasonably full day to tell a story — if the
      // selected day is light, jump to the first busy day (Maya's Monday).
      if (reflectableEvents(realityState.dayIndex).length < 4) {
        for (var i = 0; i < 7; i++) {
          if (reflectableEvents(i).length >= 4) { realityState.dayIndex = i; break; }
        }
      }
      applyMayaAnswers(realityState.dayIndex);
      realityState.shown[realityState.dayIndex] = true;
      track("reflection_viewed");
      delete realityState.added[realityState.dayIndex];
      renderAll();
    });
  }

  /* ---------- 15. Replan my day ----------
     Storyboard Screen 3, working. Takes what's left of a day from the week
     grid, keeps fixed commitments (classes, shifts, meetings) where they are,
     and re-slots everything movable into the free gaps after "now + delay",
     with a short breather after each block. Whatever doesn't fit before the
     "stop working by" time moves to the next day's first free slot.
     Nothing changes in the grid until the visitor clicks "Apply". */
  var REPLAN_BREATHER = 10; // minutes of slack after each moved block
  var FIXED_KEYWORDS = /\b(shift|meeting|appointment|interview|practice|game|rehearsal|dinner|lunch|flight|office hours|call)\b/i;

  const replanForm = document.getElementById("replanForm");
  const replanDay = document.getElementById("replanDay");
  const replanNow = document.getElementById("replanNow");
  const replanDelay = document.getElementById("replanDelay");
  const replanEndBy = document.getElementById("replanEndBy");
  const replanNewTitle = document.getElementById("replanNewTitle");
  const replanNewLength = document.getElementById("replanNewLength");
  const replanBlocks = document.getElementById("replanBlocks");
  const replanExampleBtn = document.getElementById("replanExampleBtn");
  const replanResult = document.getElementById("replanResult");

  var replanState = { fixed: {}, plan: null, applied: false };

  function minutesToInput(total) {
    var h = Math.floor(total / 60), m = total % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function isFixedByDefault(ev) {
    if (ev.category === "class") return true;
    if (ev.category === "timewise" || ev.category === "assignment") return false;
    return FIXED_KEYWORDS.test(ev.title);
  }

  function isFixed(ev) {
    return Object.prototype.hasOwnProperty.call(replanState.fixed, ev.id) ? replanState.fixed[ev.id] : isFixedByDefault(ev);
  }

  function replanNowMinutes() {
    return parseTimeInput(replanNow.value) || 0;
  }

  function remainingBlocks(dayIndex, now) {
    return reflectableEvents(dayIndex).filter(function (ev) { return eventEnd(ev) > now; });
  }

  // First gap of `duration` minutes in [from, to] that avoids every busy interval
  function firstGap(busy, from, to, duration) {
    var sorted = busy.slice().sort(function (a, b) { return a[0] - b[0]; });
    var cursor = roundUpTo(from, 5);
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i][1] <= cursor) continue;
      if (sorted[i][0] >= cursor + duration) break;
      cursor = Math.max(cursor, roundUpTo(sorted[i][1], 5));
    }
    return cursor + duration <= to ? cursor : null;
  }

  function buildReplan() {
    var day = Number(replanDay.value);
    var now = replanNowMinutes();
    var delay = Number(replanDelay.value) || 0;
    var endBy = parseTimeInput(replanEndBy.value) || 1320;
    if (endBy <= now) endBy = Math.min(now + 120, 1439);
    var start = now + delay;

    var blocks = remainingBlocks(day, now);
    var fixed = blocks.filter(isFixed);
    var movable = blocks.filter(function (ev) { return !isFixed(ev); });

    var newTitle = replanNewTitle.value.trim();
    var items = movable.map(function (ev) {
      var inProgress = ev.startMinutes < now;
      return { ev: ev, title: ev.title, duration: inProgress ? eventEnd(ev) - now : eventDuration(ev), inProgress: inProgress };
    });
    // Something that just came up is usually the most time-sensitive, so it goes first
    if (newTitle) items.unshift({ ev: null, title: newTitle, duration: Number(replanNewLength.value) || 30, isNew: true });

    var busy = fixed.map(function (ev) { return [ev.startMinutes, eventEnd(ev)]; });
    var rows = [];
    var lateFor = [];

    fixed.forEach(function (ev) {
      if (ev.startMinutes >= now && ev.startMinutes < start) lateFor.push({ ev: ev, minutes: start - ev.startMinutes });
      rows.push({ kind: "fixed", title: ev.title, ev: ev, before: formatEventTime(ev), after: formatEventTime(ev), sortKey: ev.startMinutes });
    });

    var deferred = [];
    items.forEach(function (item) {
      var slot = firstGap(busy, start, endBy, item.duration);
      if (slot === null) {
        deferred.push(item);
        return;
      }
      busy.push([slot, slot + item.duration + REPLAN_BREATHER]);
      var before = item.isNew ? "New" : formatEventTime(item.ev);
      var after = formatMinutes(slot) + " – " + formatMinutes(slot + item.duration);
      var kind = item.isNew ? "new" : (item.ev.startMinutes === slot && !item.inProgress ? "same" : "moved");
      rows.push({ kind: kind, title: item.title, ev: item.ev, before: before, after: after, start: slot, end: slot + item.duration, sortKey: slot, isNew: item.isNew });
    });

    // What doesn't fit today goes to the next day's first free daytime slot
    var nextDay = day < 6 ? day + 1 : -1;
    deferred.forEach(function (item) {
      var slot = nextDay === -1 ? null : findFreeSlot(nextDay, 540, 1260, Math.min(item.duration, 180));
      rows.push({
        kind: "deferred",
        title: item.title,
        ev: item.ev,
        isNew: item.isNew,
        before: item.isNew ? "New" : formatEventTime(item.ev),
        after: nextDay === -1 ? "Next week" : DAY_SHORT[nextDay] + (slot === null ? "" : " " + formatMinutes(slot)),
        nextDay: nextDay,
        start: slot,
        end: slot === null ? null : slot + Math.min(item.duration, 180),
        sortKey: 2000 + rows.length
      });
    });

    rows.sort(function (a, b) { return a.sortKey - b.sortKey; });
    var scheduledMinutes = busy.reduce(function (sum, b) {
      return sum + Math.max(0, Math.min(b[1], endBy) - Math.max(b[0], start));
    }, 0);

    return {
      day: day, now: now, delay: delay, start: start, endBy: endBy, rows: rows,
      counts: {
        fixed: fixed.length,
        moved: rows.filter(function (r) { return r.kind === "moved" || r.kind === "new"; }).length,
        deferred: deferred.length
      },
      lateFor: lateFor,
      freeMinutes: Math.max(0, endBy - start - scheduledMinutes)
    };
  }

  function renderReplanDays() {
    if (!replanDay) return;
    var current = replanDay.value;
    replanDay.innerHTML = "";
    for (var i = 0; i < 7; i++) {
      var opt = document.createElement("option");
      opt.value = i;
      opt.textContent = DAY_NAMES[i] + (i === todayIndex ? " (today)" : "");
      replanDay.appendChild(opt);
    }
    replanDay.value = current !== "" ? current : String(todayIndex);
  }

  function renderReplanBlocks() {
    if (!replanBlocks) return;
    var day = Number(replanDay.value);
    var blocks = remainingBlocks(day, replanNowMinutes());
    replanBlocks.innerHTML = "";
    if (!blocks.length) {
      var empty = document.createElement("li");
      empty.className = "reality-empty-day";
      empty.textContent = "Nothing left on " + DAY_NAMES[day] + " after this time. Pick an earlier time or another day — or add blocks in Your Week above.";
      replanBlocks.appendChild(empty);
      return;
    }
    blocks.forEach(function (ev) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      var fixed = isFixed(ev);
      btn.type = "button";
      btn.className = "replan-block" + (fixed ? " is-fixed" : "");
      btn.setAttribute("aria-pressed", String(fixed));
      btn.setAttribute("aria-label", ev.title + ", " + formatEventTime(ev) + ": " + (fixed ? "fixed time" : "can move") + ". Tap to switch.");
      var dot = document.createElement("span");
      dot.className = "reality-dot reality-dot-" + ev.category;
      var text = document.createElement("span");
      text.className = "replan-block-text";
      var title = document.createElement("strong");
      title.textContent = ev.title;
      var time = document.createElement("small");
      time.textContent = formatEventTime(ev);
      text.appendChild(title);
      text.appendChild(time);
      var tag = document.createElement("span");
      tag.className = "replan-block-tag";
      tag.textContent = fixed ? "📌 Fixed" : "↔ Can move";
      btn.appendChild(dot);
      btn.appendChild(text);
      btn.appendChild(tag);
      btn.addEventListener("click", function () {
        replanState.fixed[ev.id] = !isFixed(ev);
        renderReplanBlocks();
        var again = replanBlocks.querySelectorAll(".replan-block")[blocks.indexOf(ev)];
        if (again) again.focus();
        if (replanState.plan && !replanState.applied) runReplan();
      });
      li.appendChild(btn);
      replanBlocks.appendChild(li);
    });
  }

  function renderReplanResult() {
    if (!replanResult) return;
    replanResult.innerHTML = "";
    var plan = replanState.plan;

    if (!plan) {
      var placeholder = document.createElement("div");
      placeholder.className = "reality-placeholder";
      placeholder.innerHTML =
        '<span class="reality-placeholder-icon" aria-hidden="true">🔀</span>' +
        "<h4>Your new plan shows up here</h4>" +
        "<p>Tell TimeWise what changed and tap <strong>Replan the rest of my day</strong>. You'll see what stays, " +
        "what moves, and what can wait until tomorrow.</p>";
      replanResult.appendChild(placeholder);
      return;
    }

    // Summary sentence
    var summary = document.createElement("div");
    summary.className = "reality-card replan-summary";
    summary.innerHTML = '<span class="pill pill-purple">🔀 New plan from ' + formatMinutes(plan.start) + "</span>";
    var p = document.createElement("p");
    var bits = [];
    if (plan.counts.fixed) bits.push("kept " + plural(plan.counts.fixed, "fixed commitment") + " in place");
    if (plan.counts.moved) bits.push("fit " + plural(plan.counts.moved, "block") + " into the gaps");
    if (plan.counts.deferred) bits.push("moved " + plural(plan.counts.deferred, "block") + " to " +
      (plan.day < 6 ? DAY_NAMES[plan.day + 1] : "next week"));
    var sentence = bits.length ? bits.join(", ") : "nothing needed to change";
    p.textContent = sentence.charAt(0).toUpperCase() + sentence.slice(1) + ", so you still wrap up by " + formatMinutes(plan.endBy) +
      (plan.freeMinutes >= 15 && !plan.counts.deferred ? " — with about " + plan.freeMinutes + " free minutes to spare." : ".");
    summary.appendChild(p);
    plan.lateFor.forEach(function (late) {
      var warn = document.createElement("p");
      warn.className = "replan-warning";
      warn.textContent = "Heads up: at this pace you'll be about " + late.minutes + " min late to " + late.ev.title +
        ". Wrap up what you're doing early, or send a quick heads-up.";
      summary.appendChild(warn);
    });
    replanResult.appendChild(summary);

    // Before → after list
    var list = document.createElement("ol");
    list.className = "replan-rows";
    var LABELS = { fixed: "📌 Stays", same: "✓ Same time", moved: "↪ Moved", new: "✚ Added", deferred: "⏭ Tomorrow" };
    plan.rows.forEach(function (row) {
      var li = document.createElement("li");
      li.className = "replan-row is-" + row.kind;
      var title = document.createElement("span");
      title.className = "replan-row-title";
      title.textContent = row.title;
      var tag = document.createElement("span");
      tag.className = "replan-row-tag";
      tag.textContent = row.kind !== "deferred" ? LABELS[row.kind]
        : row.nextDay === -1 ? "⏭ Next week" : plan.day === todayIndex ? "⏭ Tomorrow" : "⏭ Next day";
      var times = document.createElement("span");
      times.className = "replan-row-times";
      if (row.kind === "fixed" || row.kind === "same") {
        times.textContent = row.after;
      } else {
        var before = document.createElement("s");
        before.textContent = row.before;
        if (row.isNew) {
          times.textContent = row.after;
        } else {
          times.appendChild(before);
          times.appendChild(document.createTextNode(" → " + row.after));
        }
      }
      li.appendChild(tag);
      li.appendChild(title);
      li.appendChild(times);
      list.appendChild(li);
    });
    replanResult.appendChild(list);

    // Apply
    var actions = document.createElement("div");
    actions.className = "replan-actions";
    if (replanState.applied) {
      var done = document.createElement("p");
      done.className = "reality-added";
      done.tabIndex = -1;
      done.appendChild(document.createTextNode("✓ Applied — Your Week is updated. "));
      var link = document.createElement("a");
      link.href = "#calendars";
      link.textContent = "See it ↑";
      done.appendChild(link);
      actions.appendChild(done);
    } else if (plan.counts.moved || plan.counts.deferred) {
      var apply = document.createElement("button");
      apply.type = "button";
      apply.className = "btn btn-primary btn-small";
      apply.textContent = "Apply to my week";
      apply.addEventListener("click", applyReplan);
      actions.appendChild(apply);
    }
    replanResult.appendChild(actions);
  }

  function runReplan() {
    replanState.plan = buildReplan();
    replanState.applied = false;
    renderReplanResult();
  }

  function applyReplan() {
    var plan = replanState.plan;
    if (!plan) return;
    plan.rows.forEach(function (row) {
      if (row.kind === "moved" || row.kind === "same") {
        row.ev.startMinutes = row.start;
        row.ev.endMinutes = row.end;
      } else if (row.kind === "new") {
        addWeekEvent({ title: row.title, dayIndex: plan.day, startMinutes: row.start, endMinutes: row.end,
          category: guessCategory(row.title), source: "manual" });
      } else if (row.kind === "deferred" && row.nextDay !== -1 && row.start !== null) {
        if (row.isNew) {
          addWeekEvent({ title: row.title, dayIndex: row.nextDay, startMinutes: row.start, endMinutes: row.end,
            category: guessCategory(row.title), source: "manual" });
        } else {
          row.ev.dayIndex = row.nextDay;
          row.ev.startMinutes = row.start;
          row.ev.endMinutes = row.end;
          row.ev.reality = null;
        }
      }
    });
    replanState.applied = true;
    replanNewTitle.value = "";
    renderAll();
    track("replan_applied");
    var note = replanResult.querySelector(".reality-added");
    if (note) note.focus();
  }

  function resetReplanTime() {
    var day = Number(replanDay.value);
    var now = new Date();
    var minutes = now.getHours() * 60 + Math.floor(now.getMinutes() / 5) * 5;
    // Outside waking hours (or on another day), start from midday so there's something to replan
    if (day !== todayIndex || minutes < 480 || minutes > 1260) minutes = 720;
    replanNow.value = minutesToInput(minutes);
  }

  function renderReplan() {
    renderReplanDays();
    renderReplanBlocks();
    renderReplanResult();
  }

  if (replanForm) {
    replanForm.addEventListener("submit", function (e) {
      e.preventDefault();
      runReplan();
      track("replan_used");
      if (window.matchMedia("(max-width: 960px)").matches) {
        replanResult.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    replanDay.addEventListener("change", function () {
      resetReplanTime();
      replanState.plan = null;
      renderReplanBlocks();
      renderReplanResult();
    });
    replanNow.addEventListener("change", function () {
      renderReplanBlocks();
      if (replanState.plan && !replanState.applied) runReplan();
    });
    [replanDelay, replanEndBy, replanNewLength].forEach(function (el) {
      el.addEventListener("change", function () {
        if (replanState.plan && !replanState.applied) runReplan();
      });
    });

    replanExampleBtn.addEventListener("click", function () {
      // Maya's Monday: Econ ran long, a recruiter wants a call back, and she wants her evening free
      var busiest = 0;
      for (var i = 0; i < 7; i++) {
        if (reflectableEvents(i).length > reflectableEvents(busiest).length) busiest = i;
      }
      replanDay.value = String(busiest);
      replanNow.value = "12:30";
      replanDelay.value = "45";
      replanEndBy.value = "20:00"; // she promised herself a night off
      replanNewTitle.value = "Call back internship recruiter";
      replanNewLength.value = "30";
      replanState.fixed = {};
      renderReplanBlocks();
      runReplan();
      track("replan_used");
    });
  }

  /* ---------- 16. Early access + anonymous feature counts ----------
     The form posts to the Worker's /api/waitlist (stored in Cloudflare D1).
     track() tells /api/track which demo features a visitor tried, once per
     feature per visitor, using a random ID kept in this browser — no names,
     no cookies. On hosts without the Worker (GitHub Pages, a local file),
     these calls simply fail quietly. See results.html to read the numbers. */
  var VISITOR_KEY = "timewise-visitor-id";
  var trackedThisPage = {};
  var visitorId = (function () {
    var id = null;
    try { id = window.localStorage.getItem(VISITOR_KEY); } catch (e) { /* storage blocked */ }
    if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
      id = window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
      try { window.localStorage.setItem(VISITOR_KEY, id); } catch (e) { /* fine — counts per visit instead */ }
    }
    return id;
  })();

  function track(event) {
    if (window.location.protocol === "file:" || trackedThisPage[event]) return;
    trackedThisPage[event] = true;
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: visitorId, event: event }),
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* ignore */ }
  }

  const earlyForm = document.getElementById("earlyAccessForm");
  const earlyStatus = document.getElementById("earlyStatus");
  const earlySubmit = document.getElementById("earlySubmit");
  const earlyThanks = document.getElementById("earlyThanks");
  const earlyThanksText = document.getElementById("earlyThanksText");

  if (earlyForm) {
    earlyForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(earlyForm);
      var payload = {
        visitorId: visitorId,
        email: String(data.get("email") || "").trim(),
        planning: data.get("planning") || "",
        struggle: data.get("struggle") || "",
        weekly: data.get("weekly") || "",
        website: data.get("website") || ""
      };

      if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        setStatus(earlyStatus, "That email doesn't look quite right — double-check it, or leave it blank.", "error");
        document.getElementById("earlyEmail").focus();
        return;
      }
      if (!payload.email && !payload.planning && !payload.struggle && !payload.weekly) {
        setStatus(earlyStatus, "Add your email or answer at least one question first.", "error");
        return;
      }

      earlySubmit.disabled = true;
      earlySubmit.textContent = "Sending…";
      setStatus(earlyStatus, "", "");

      fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            if (!res.ok) throw new Error(body.error || "status_" + res.status);
            return body;
          });
        })
        .then(function (body) {
          earlyForm.hidden = true;
          earlyThanks.hidden = false;
          earlyThanksText.textContent = (payload.email
            ? "We'll email " + payload.email + " when TimeWise is ready. "
            : "Your answers are in. ") +
            (body.responses > 1 ? "You're one of " + body.responses + " students who've weighed in so far." : "You're the very first to weigh in!");
          earlyThanks.focus();
        })
        .catch(function (err) {
          earlySubmit.disabled = false;
          earlySubmit.textContent = "Join early access";
          var messages = {
            not_configured: "Sign-ups aren't switched on for this copy of the site yet.",
            bad_email: "That email doesn't look quite right — double-check it, or leave it blank."
          };
          setStatus(earlyStatus, messages[err.message] ||
            (window.location.protocol === "file:" || /status_(404|405)/.test(err.message)
              ? "Sign-ups only work on the live site."
              : "Something went wrong — please try again in a moment."), "error");
        });
    });
  }

  // Initial calendar, replan + reflection paint, then look for real calendar connections
  loadSampleWeek();
  realityState.dayIndex = defaultRealityDay();
  renderReplanDays();
  resetReplanTime();
  renderAll();
  initGoogle();
  checkNotion();
  track("visit");

  // Initial paint
  renderHome();
  showScreen("home");
})();
