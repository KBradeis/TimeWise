# TimeWise — Pitch Website

A pitch website for **TimeWise**, a time management skill-practice app concept for college
students. This is a static, front-end-only site meant to explain and demo the product idea —
it is **not** the production app.

TimeWise helps students reflect on how they actually spend their time, connect that reflection
to their goals and deadlines, and leave each short practice session with a realistic next step —
combining honest self-awareness with practical planning support, instead of just another task
tracker.

## What's on the site

- **Hero** — the pitch in one screen, with primary/secondary calls to action
- **Problem** — the everyday challenges college students face (deadlines, procrastination,
  overload, balancing school/work/life)
- **Solution** — how TimeWise's practice-session model works
- **Features** — the core feature set as scannable cards
- **How It Works** — a simple 4-step flow
- **Live demo** — a fully working mock-up of the practice experience: a phone-style card with a
  home screen, a 10-question practice session (one question at a time, multiple choice,
  immediate supportive feedback, live score/streak/XP/progress bar), and a session summary with
  a takeaway and next steps. Progress is saved in the browser so returning visitors see their
  best streak, total XP, and completed sessions.
- **Audience** — who the concept is for
- **Why TimeWise is different** — how it compares to typical planners/trackers
- **Footer** — navigation and a closing note

## File structure

```
TimeWise/
├── index.html          # Page structure and content (semantic HTML5)
├── styles.css          # All styling: layout, color system, responsive rules
├── script.js           # Demo interactivity: quiz logic, stats, localStorage
├── assets/
│   └── favicon.svg     # Simple SVG clock-mark favicon (no external images)
└── README.md           # This file
```

There is no build step and no backend — just three files and a folder of assets.

## Running it locally

You have two easy options:

**Option 1 — just open it**
Double-click `index.html` (or right-click → Open With → your browser). Everything works,
including the interactive demo. The only thing you'll lose offline is the Google Fonts webfont,
which gracefully falls back to a system font.

**Option 2 — serve it locally** (recommended if your browser restricts local file access)
From inside the `TimeWise` folder, run one of:

```bash
# Python 3
python3 -m http.server 8000

# Node (if you have npx available)
npx serve .
```

Then visit `http://localhost:8000` in your browser.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository (as the repo root, or a subfolder — see note below).
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch".
4. Choose your default branch (e.g. `main`) and the `/ (root)` folder, then save.
5. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/` within a
   minute or two.

If you'd rather set this up from the command line instead of the folder already being tracked:

```bash
cd TimeWise
git init
git add .
git commit -m "Add TimeWise pitch site"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

> If this folder lives inside a larger repository (for example, alongside other class
> projects) and you want GitHub Pages to serve it directly, either publish it as its own
> repository, or point GitHub Pages at a subfolder using a GitHub Actions Pages workflow —
> the default "deploy from branch" option only serves from the repo root or `/docs`.

## Design choices

- **Color system** — a purple-to-blue gradient as the primary brand color (calm, focused,
  modern), with green for encouragement/success and orange for energy/streaks — chosen so
  positive states (correct answers, XP, streaks) always read as warm and rewarding rather than
  clinical.
- **Typography** — "Baloo 2" for headings (rounded, friendly, approachable) and "Nunito" for
  body text (clean and easy to scan), both loaded from Google Fonts with a system-font fallback
  so the page still looks good offline.
- **Layout** — generous spacing, rounded cards, and soft shadows throughout to keep the page
  feeling calm and uncluttered rather than dense or corporate.
- **Tone** — every piece of copy (especially in the demo's feedback messages) was written to be
  encouraging and non-judgmental, even when an answer is "wrong." The goal is to make practicing
  time management feel safe, not stressful.
- **The mock app preview** — built entirely with HTML/CSS/JS (no images or paid assets) so it's
  easy to read, easy to modify, and loads instantly. It doubles as a real demo: the question
  bank, scoring, streak logic, and progress bar all genuinely work.
- **Accessibility** — semantic HTML landmarks, visible keyboard focus states, an
  `aria-live` region for quiz feedback, a labeled progress bar, and color choices checked for
  readable contrast against their backgrounds.
- **Responsiveness** — a mobile-first breakpoint set collapses multi-column grids to a single
  column, swaps the nav for a hamburger menu, and keeps buttons and tap targets comfortably
  large on small screens.

## Customizing

- Update copy directly in `index.html` — each section is clearly commented.
- Add or edit demo questions in the `QUESTIONS` array near the top of `script.js`. Each entry
  needs a `question`, four `choices`, a `correctIndex` (0–3), and both a correct and incorrect
  `feedback` message.
- Colors and spacing live as CSS custom properties at the top of `styles.css` (`:root`), so a
  palette change is mostly a matter of editing a handful of variables.
