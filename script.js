/* ==========================================================================
   TimeWise — Pitch Site Behavior
   Sections: 1. Mobile nav toggle  2. Question bank  3. Local storage helpers
   4. App state  5. Screen switching  6. Home screen rendering
   7. Quiz rendering & answer handling  8. Summary rendering  9. Event wiring
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

  /* ---------- 10. Connect Your Calendars ----------
     Google Calendar / Notion buttons are a UI preview only — clicking them
     never contacts a real account or server, it just simulates the
     experience with clearly-labeled sample data. The .ics file upload
     below is fully functional: it reads and parses the file entirely in
     the browser using the File API, and nothing is ever uploaded anywhere. */
  const providerButtons = document.querySelectorAll(".provider-btn");
  const providerStatusGrid = document.getElementById("providerStatusGrid");

  function addDays(date, days) {
    var result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function formatSampleDate(date, hour, minute) {
    var d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  var PROVIDER_SAMPLE_EVENTS = {
    google: function () {
      var tomorrow = addDays(new Date(), 1);
      var inTwoDays = addDays(new Date(), 2);
      return [
        "BIO 201 Lecture — " + formatSampleDate(tomorrow, 10, 0),
        "Shift at Campus Café — " + formatSampleDate(tomorrow, 14, 0),
        "Study Group: Calc II — " + formatSampleDate(inTwoDays, 18, 0)
      ];
    },
    notion: function () {
      return [
        "Draft essay outline",
        "Club officer meeting notes due",
        "Apply to summer internship — due Friday"
      ];
    }
  };

  providerButtons.forEach(function (btn) {
    // Remember the button's original label so disconnecting can restore it
    btn.dataset.originalHtml = btn.innerHTML;

    btn.addEventListener("click", function () {
      var provider = btn.getAttribute("data-provider");
      var label = btn.getAttribute("data-label");
      var existingCard = document.getElementById("providerCard-" + provider);

      // Clicking a connected button disconnects it again
      if (btn.classList.contains("is-connected")) {
        btn.classList.remove("is-connected");
        btn.innerHTML = btn.dataset.originalHtml;
        if (existingCard) existingCard.remove();
        return;
      }

      if (btn.disabled) return;

      btn.disabled = true;
      btn.innerHTML = "Connecting…";

      setTimeout(function () {
        btn.disabled = false;
        btn.classList.add("is-connected");
        btn.innerHTML = "✓ Connected — " + label;

        var events = PROVIDER_SAMPLE_EVENTS[provider] ? PROVIDER_SAMPLE_EVENTS[provider]() : [];
        var card = document.createElement("div");
        card.className = "provider-sample-card";
        card.id = "providerCard-" + provider;

        var title = document.createElement("div");
        title.className = "provider-sample-title";
        title.innerHTML = label + ' <span class="demo-badge">Demo</span>';
        card.appendChild(title);

        var ul = document.createElement("ul");
        events.forEach(function (text) {
          var li = document.createElement("li");
          li.textContent = text;
          ul.appendChild(li);
        });
        card.appendChild(ul);

        if (providerStatusGrid) providerStatusGrid.appendChild(card);
      }, 900);
    });
  });

  /* ---------- 11. Calendar file (.ics) upload — real, client-side only ---------- */
  const icsFileInput = document.getElementById("icsFileInput");
  const icsStatus = document.getElementById("icsStatus");
  const calendarEventsPreview = document.getElementById("calendarEventsPreview");
  const calendarEventsList = document.getElementById("calendarEventsList");

  var MAX_ICS_SIZE = 2 * 1024 * 1024; // 2MB is plenty for a calendar export

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
        current = { title: "Untitled event", start: null, allDay: false, location: "" };
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
      } else if (prop === "LOCATION") {
        current.location = unescapeIcsText(value);
      }
    });

    events.sort(function (a, b) {
      return a.start - b.start;
    });

    return events;
  }

  function formatEventDate(event) {
    var datePart = event.start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    if (event.allDay) return datePart + " · All day";
    return datePart + " · " + event.start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function renderIcsEvents(upcomingEvents, totalParsed) {
    if (!calendarEventsList || !icsStatus || !calendarEventsPreview) return;
    calendarEventsList.innerHTML = "";

    if (totalParsed === 0) {
      icsStatus.textContent = "Couldn't find any events in that file.";
      icsStatus.className = "ics-status is-error";
      calendarEventsPreview.hidden = true;
      return;
    }

    if (upcomingEvents.length === 0) {
      icsStatus.textContent = "Found " + totalParsed + " event" + (totalParsed === 1 ? "" : "s") +
        " in that file, but none of them are upcoming.";
      icsStatus.className = "ics-status is-success";
      calendarEventsPreview.hidden = true;
      return;
    }

    upcomingEvents.slice(0, 25).forEach(function (event) {
      var li = document.createElement("li");

      var title = document.createElement("span");
      title.className = "calendar-event-title";
      title.textContent = event.title;

      var time = document.createElement("span");
      time.className = "calendar-event-time";
      time.textContent = formatEventDate(event) + (event.location ? " · " + event.location : "");

      li.appendChild(title);
      li.appendChild(time);
      calendarEventsList.appendChild(li);
    });

    icsStatus.textContent = "Found " + upcomingEvents.length + " upcoming event" +
      (upcomingEvents.length === 1 ? "" : "s") + ".";
    icsStatus.className = "ics-status is-success";
    calendarEventsPreview.hidden = false;
  }

  if (icsFileInput) {
    icsFileInput.addEventListener("change", function () {
      var file = icsFileInput.files && icsFileInput.files[0];
      if (!file) return;

      if (file.size > MAX_ICS_SIZE) {
        icsStatus.textContent = "That file is a bit large for the demo — try a smaller export.";
        icsStatus.className = "ics-status is-error";
        return;
      }

      icsStatus.textContent = "Reading your calendar…";
      icsStatus.className = "ics-status";

      var reader = new FileReader();
      reader.onload = function () {
        try {
          var allEvents = parseIcs(String(reader.result));
          var now = new Date();
          var upcoming = allEvents.filter(function (event) {
            return event.start >= now;
          });
          renderIcsEvents(upcoming, allEvents.length);
        } catch (err) {
          icsStatus.textContent = "Couldn't read that file — make sure it's a .ics calendar export.";
          icsStatus.className = "ics-status is-error";
          calendarEventsPreview.hidden = true;
        }
      };
      reader.onerror = function () {
        icsStatus.textContent = "Couldn't read that file. Please try again.";
        icsStatus.className = "ics-status is-error";
      };
      reader.readAsText(file);
    });
  }

  // Initial paint
  renderHome();
  showScreen("home");
})();
