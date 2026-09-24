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
- **Storyboard** — a short narrative walkthrough ("A day with TimeWise, through Maya's eyes") showing
  four concrete screens: a color-coded dashboard, a "plan what matters today" screen, a "replan my day"
  screen for when things change, and an end-of-day reflection screen
- **Connect Your Calendars** — the pitch's centerpiece interactive demo: a live "Your Week" grid (Monday
  through Sunday, with today highlighted) that three different input methods all feed into — type in an
  event by hand, click "Connect Google Calendar" / "Connect Notion" to drop in clearly-labeled sample data
  (no real account is ever linked), or upload a genuinely real **.ics calendar file** (from Apple Calendar,
  Samsung Calendar, Outlook, Moodle, Google Calendar, etc.), parsed entirely in the browser. It's meant to
  make the product's core promise tangible: however your schedule is scattered today, TimeWise pulls it
  into one calm view. Nothing is ever sent to a server; see
  [Calendar linking](#calendar-linking-how-real-is-it) below for the full picture.
- **Live demo** — a fully working mock-up of the practice experience: a phone-style card with a
  home screen, a 10-question practice session (one question at a time, multiple choice,
  immediate supportive feedback, live score/streak/XP/progress bar), and a session summary with
  a takeaway and next steps. Progress is saved in the browser so returning visitors see their
  best streak, total XP, and completed sessions.
- **Audience** — who the concept is for
- **Why TimeWise is different** — how it compares to typical planners/trackers
- **Footer** — navigation and a closing note
- **Custom 404 page** (`404.html`) — an on-brand "page not found" screen with links back to the
  site and the demo, instead of a blank browser error
- **Social link previews** — Open Graph and Twitter Card meta tags in `index.html`'s `<head>`, so
  sharing the link on iMessage, Slack, Discord, Twitter/X, etc. shows a branded preview card
  (title, description, and image) instead of a bare link; see
  [Social previews & favicons](#social-previews--favicons) below

## File structure

```
TimeWise/
├── index.html               # Page structure and content (semantic HTML5)
├── 404.html                 # Custom "page not found" page (Cloudflare + GitHub Pages)
├── styles.css                # All styling: layout, color system, responsive rules
├── script.js                 # Demo interactivity: quiz logic, stats, calendar features, localStorage
├── favicon.ico                # Multi-resolution favicon fallback for older browsers
├── assets/
│   ├── favicon.svg            # Primary SVG clock-mark favicon (modern browsers)
│   ├── apple-touch-icon.png   # 180×180 home-screen icon (iOS/iPadOS)
│   └── og-image.jpg           # 1200×630 branded image for social link previews
├── wrangler.json              # Cloudflare Workers config (static-asset deployment + custom 404)
├── package.json               # Optional: adds the `wrangler` CLI as a dev dependency
├── .assetsignore               # Files Cloudflare shouldn't publish (README, config, etc.)
└── README.md                  # This file
```

The site itself has no build step and no backend — just HTML/CSS/JS and a folder of assets. The
`wrangler.json`/`package.json`/`.assetsignore` files exist only to support deploying to Cloudflare (see
below) and aren't needed to run the site locally or on GitHub Pages.

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

## Deploying to Cloudflare

Cloudflare's current guidance is to deploy static sites through **Workers with static assets**
rather than the older "Pages" product — this repo is already set up for that path via
`wrangler.json`.

**One-time setup:**

```bash
cd TimeWise
npm install          # installs the wrangler CLI (from package.json)
npx wrangler login   # opens a browser to authorize your Cloudflare account
```

**Preview locally** (optional — mirrors how it'll run on Cloudflare):

```bash
npm run dev
```

**Deploy:**

```bash
npm run deploy
```

That's it — no build command, no output directory to configure. Wrangler reads `wrangler.json`,
uploads everything in this folder except what's listed in `.assetsignore`, and gives you back a
`*.workers.dev` URL. To use a custom domain afterward, add it under your Worker's **Settings →
Domains & Routes** in the Cloudflare dashboard.

If you'd rather deploy without the CLI, Cloudflare's dashboard also supports connecting a GitHub
repository directly (**Workers & Pages → Create → Connect to Git**) — for this project, leave the
build command empty and it will pick up `wrangler.json` automatically.

## Social previews & favicons

The site now sends a proper preview card when its link is shared, instead of a bare URL:

- **Open Graph tags** (`og:title`, `og:description`, `og:image`, etc.) drive the preview on
  iMessage, Slack, Discord, LinkedIn, Facebook, and most other apps.
- **Twitter Card tags** (`twitter:card`, `twitter:title`, etc.) drive the preview specifically on
  Twitter/X.
- Both point at `assets/og-image.jpg`, a 1200×630 branded image, and at absolute URLs built from
  `https://kbradeis.github.io/TimeWise/` — the GitHub Pages address from the deploy instructions
  above.

**If you deploy anywhere other than that GitHub Pages URL** (a Cloudflare `*.workers.dev` address,
a custom domain, etc.), you need to update the four absolute URLs in the Open Graph/Twitter block
near the top of `index.html`'s `<head>` — look for the HTML comment right above them. Link
previews are fetched by the sharing app directly, so `og:image` has to be a real, reachable,
absolute URL — a relative path won't work here even though it works fine everywhere else on the
site.

Favicons follow the standard three-file pattern for broad compatibility: `assets/favicon.svg`
(crisp on modern browsers, including dark-mode-aware rendering), `favicon.ico` (a multi-resolution
fallback for older browsers that don't support SVG favicons), and `assets/apple-touch-icon.png`
(what shows up if someone adds the site to their iOS home screen).

## Custom 404 page

`404.html` is a small, on-brand page shown whenever someone hits a broken or missing link, instead
of a blank browser error. It reuses `styles.css` so it matches the rest of the site, and links back
to the homepage and the live demo. It's wired up for both deploy targets:

- **GitHub Pages** serves it automatically — no configuration needed, GitHub looks for a file
  literally named `404.html` at the root of the published site.
- **Cloudflare** is told about it explicitly via `wrangler.json`'s
  `assets.not_found_handling: "404-page"` setting, which tells Workers to serve `404.html` (with a
  proper `404` status code) for any unmatched route.

`404.html` deliberately links to `index.html` (not `/`), so it keeps working whether the site is
deployed at a domain root (Cloudflare) or under a subpath like `/TimeWise/` (GitHub Pages).

## Tracking traction: Cloudflare Web Analytics

Both `index.html` and `404.html` have a placeholder analytics snippet right before `</body>`. It's
inert until you swap in your own token — right now it won't send any data anywhere.

**Cloudflare Web Analytics** was chosen because it's free with no catch, doesn't use cookies or
any client-side storage (so no consent banner needed), and — since it's just a JS beacon — works
the same whether the site ends up on Cloudflare, GitHub Pages, or anywhere else. It gives you visit
counts, top pages, referrers (so you can tell whether a class Slack post or an Instagram share is
what's driving traffic), and visitor country/device — the passive "how much attention is this
getting" picture. It does not track specific in-page actions (like "who tried the quiz demo"); that
would need a heavier tool like Google Analytics.

**To turn it on:**

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Analytics & Logs → Web
   Analytics**.
2. Click **Add a site**, enter this site's hostname (e.g. `kbradeis.github.io` or your Cloudflare
   domain), and confirm it.
3. Cloudflare shows you a `<script>` snippet with a real token already filled in — copy the whole
   tag.
4. Paste it over the placeholder `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" ...>`
   line near the bottom of **both** `index.html` and `404.html` (so 404 hits get counted too).
5. Give it a few minutes after your next deploy — data shows up in the same dashboard page.

## Calendar linking: how real is it?

The "Connect Your Calendars" section is intentionally split into different levels of realness, and
all of them feed the same live "Your Week" grid — it says so on the page itself:

- **Adding an event by hand is fully functional.** The quick-add form writes straight into the
  in-memory `weekEvents` array (see `script.js`) and re-renders the grid — nothing is sent
  anywhere, and nothing persists once you leave the page.
- **Google Calendar and Notion** are a **preview only**. Clicking "Connect" never opens a real
  sign-in flow, never asks for real credentials, and never talks to Google or Notion's servers —
  it just drops clearly-labeled sample events onto the grid (and removes them again if you
  disconnect) to simulate what the connected state would look like. A real version of this would
  need OAuth (which needs a small backend to exchange tokens securely — Cloudflare Workers would
  be a natural fit alongside this site) and, for Google specifically, passing Google's
  app-verification review before it could work for more than a small list of test users.
- **The `.ics` calendar file upload is fully functional.** It reads whatever file you choose with
  the browser's File API and parses it entirely client-side (see the `parseIcs()` function in
  `script.js`), then drops any events that fall in the current Monday–Sunday window onto the grid
  — nothing is uploaded anywhere. This is also the most realistic way to cover calendars that
  don't offer a public API a website can connect to directly: Apple Calendar, Samsung Calendar,
  Outlook, and **Moodle** all export (or let you subscribe to) a standard `.ics` file. Moodle in
  particular has a built-in, self-serve calendar export a student can generate from their own
  account (no institutional/admin setup needed) — export it, then upload it here.

### Could this connect directly to Moodle (or Google/Notion) with no manual export/upload step?

Not without a backend, and for Moodle specifically, not without the school's IT department getting
involved. Moodle's Web Services REST API and LTI integrations can expose course, grade, or calendar
data automatically, but a site administrator has to enable web services and grant the relevant
permissions first — a student can't turn that on themselves. Google and Notion have a similar
story: a live connection needs OAuth, which needs a backend to hold the client secret and exchange
tokens (a static site can't do this on its own). The `.ics` upload sidesteps all of that by using
a feature every one of these platforms already offers self-serve — at the cost of being a manual
"export, then upload" step rather than an always-live sync.

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
- The Google/Notion demo sample events live in `PROVIDER_SAMPLE_EVENTS` in `script.js` — each entry
  is `{ title, date, startMinutes, endMinutes, category }`, where `category` is `"class"`,
  `"assignment"`, or `"personal"` (this controls the color of the event on the grid).
- The "Your Week" grid itself is driven by the `weekEvents` array and `renderWeekGrid()` in
  `script.js` — any code path that wants to add something to the grid just needs to push an object
  in that same shape and call `renderWeekGrid()`.
