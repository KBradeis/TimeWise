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
  event by hand, connect a real **Google Calendar** or **Notion** workspace (read-only), or upload a real
  **.ics calendar file** (from Apple Calendar, Samsung Calendar, Outlook, Moodle, etc.), parsed entirely
  in the browser. It's meant to make the product's core promise tangible: however your schedule is
  scattered today, TimeWise pulls it into one calm view. The Google and Notion connections need a
  one-time setup; see
  [Calendar linking](#calendar-linking-how-it-works) below for the full picture.
- **Plan vs. Reality** — the minimum viable feature that shows what makes TimeWise different. It reads
  the same "Your Week" events as the calendar section: pick a day, mark each block as *Done*, *Ran over*
  (by how much), *Swapped*, or *Skipped* (and optionally what got in the way), and TimeWise returns a
  score, one honest insight (e.g. "one overrun set off a chain reaction"), and one concrete next step
  scheduled into a real free slot the next day — which you can add to the week grid with one click
  (it shows up in green as a "TimeWise suggestion"). A **Try Maya's example** button fills in realistic
  answers so it can be demoed in one click. Reflections come from simple, transparent rules in
  `buildReflection()` in `script.js` — no AI service, no server, nothing saved.
- **Replan my day** — Storyboard Screen 3, working. Pick a day and the current time, say how far behind
  you're running and whether something new came up, and choose a "stop working by" time. TimeWise keeps
  fixed commitments (classes, shifts, meetings — tap any block to switch it between 📌 fixed and ↔ can
  move), fits everything movable into the gaps with a 10-minute breather after each, warns if you'll be
  late to something fixed, and moves what won't fit to the next day's first free slot. **Apply to my
  week** updates the grid. **Try Maya's messy Monday** runs a one-click example.
- **Early access** — the closing section is now a sign-up form: an optional email plus three one-tap
  questions (how you plan today, biggest time struggle, would you use it weekly). Responses are saved in
  a Cloudflare D1 database by `worker.js`. The site also counts anonymously which demo features each
  visitor tried. A private **`results.html`** page (protected by an admin key) shows the numbers as
  charts, lists every response, and exports a CSV for your pitch slides. See
  [Early access & results](#early-access--results).
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
├── results.html             # Private results page for early-access answers + feature counts (needs ADMIN_KEY)
├── 404.html                 # Custom "page not found" page (Cloudflare + GitHub Pages)
├── styles.css                # All styling: layout, color system, responsive rules
├── script.js                 # Demo interactivity: quiz logic, stats, calendar features, localStorage
├── favicon.ico                # Multi-resolution favicon fallback for older browsers
├── assets/
│   ├── favicon.svg            # Primary SVG clock-mark favicon (modern browsers)
│   ├── apple-touch-icon.png   # 180×180 home-screen icon (iOS/iPadOS)
│   └── og-image.jpg           # 1200×630 branded image for social link previews
├── worker.js                  # Cloudflare Worker: serves the site + the real Notion connection (/api/notion/*)
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

## Calendar linking: how it works

Every input in the "Connect Your Calendars" section feeds the same live "Your Week" grid (and Plan
vs. Reality below it). All of it is read-only and only looks at the current Monday–Sunday week.

- **Adding an event by hand** writes straight into the in-memory `weekEvents` array in `script.js`.
  Nothing is sent anywhere, and nothing persists once you leave the page.
- **Google Calendar is a real connection** that runs entirely in the visitor's browser (Google
  Identity Services + the Calendar API). The site only needs a public OAuth *Client ID*, not a
  secret, so no server is involved. See [Connecting Google Calendar](#connecting-google-calendar).
- **Notion is a real connection** that goes through the small Cloudflare Worker in `worker.js`.
  Notion's API can't be called from a browser, and its sign-in needs a client secret, so those two
  steps run on the server. Each visitor connects *their own* workspace and chooses which pages to
  share on Notion's screen. Their Notion token is kept only in a secure, HttpOnly cookie in their own
  browser for 7 days; the Worker stores nothing. See [Connecting Notion](#connecting-notion).
- **The `.ics` upload** reads a calendar export with the browser's File API and parses it
  client-side (`parseIcs()` in `script.js`). It covers calendars without a web API (Apple Calendar,
  Samsung Calendar, Outlook, Moodle).
- **Fallback:** if a connection isn't set up on a copy of the site (no Google Client ID yet, no
  Notion secrets, or the site is on GitHub Pages / opened as a local file, where the Worker doesn't
  run), that button quietly falls back to the old preview and adds clearly labeled "Demo" sample
  events, so the page never looks broken.

When real events arrive from any connection, Maya's sample week is cleared automatically so the
grid shows only your schedule.

### Connecting Google Calendar

About 15 minutes, once. You need a Google account and the site's live address (for example
`https://timewise.<your-subdomain>.workers.dev`).

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a project
   (e.g. "TimeWise").
2. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
3. **Google Auth Platform** (called **OAuth consent screen** in older menus) → **Get started**:
   app name "TimeWise", your email as support/contact email, audience **External**.
4. **Data Access** → **Add or remove scopes** → add
   `https://www.googleapis.com/auth/calendar.readonly` → **Save**.
5. **Audience** → **Test users** → add the Google accounts that should be able to connect (yours
   and your classmates', up to 100). While the app is in "Testing", only these accounts can sign in.
6. **Clients** → **Create client** → type **Web application**. Under **Authorized JavaScript
   origins**, add your site's exact address (no trailing slash). You don't need a redirect URI.
7. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`) and paste it into
   `GOOGLE_CLIENT_ID` near the top of section 12 in `script.js`. Then commit and deploy.

When you click **Connect Google Calendar**, a Google pop-up asks you to pick an account. It shows
"Google hasn't verified this app": click **Continue**, since it's your own test app. Tick the
calendar permission box. TimeWise then loads this week's events from every calendar that's ticked
in your Google Calendar sidebar (up to 10), with repeating events expanded. Access lasts about an
hour; after that, just click Connect again.

> **School accounts:** if your university's Google Workspace blocks unverified third-party apps,
> sign in with a personal Gmail account instead (and add that one as a test user).

### Connecting Notion

About 20 minutes, once. This needs the Cloudflare deployment (see [Deploying to
Cloudflare](#deploying-to-cloudflare)), since that's where `worker.js` runs.

1. Go to Notion's integrations page ([notion.so/profile/integrations](https://www.notion.so/profile/integrations))
   → **New integration**. Choose type **Public** (so visitors can connect their own workspaces).
2. Fill in the required details. For the website, privacy policy, and terms URLs, your site's
   address is fine for a class demo.
3. Under **Redirect URIs**, add exactly: `https://<your-site-address>/api/notion/callback`
4. Under **Capabilities**, keep only **Read content**. You don't need update/insert or user email.
5. Save, then copy the **OAuth client ID** and **OAuth client secret**.
6. In this folder, store them as Cloudflare secrets. They're never committed to git:
   ```bash
   npx wrangler secret put NOTION_CLIENT_ID
   npx wrangler secret put NOTION_CLIENT_SECRET
   ```
7. Deploy: `npm run deploy`.

When you click **Connect Notion**, a pop-up opens Notion's screen, where you pick the pages or
databases TimeWise may read. **Choose a database that has a Date property**, such as an assignment
tracker or task list. The pop-up closes itself, and items dated this week show up on the grid.
Items with only a date (no time) show as "All day" and aren't part of Plan vs. Reality, which only
looks at blocks with a time.

Details: TimeWise reads up to 10 shared databases, uses the first Date property in each, and asks
Notion's API (version `2022-06-28`) only for items dated within this week. Disconnecting clears the
cookie. To fully revoke access, remove the integration under **Settings → Connections** in Notion.

**Testing Notion locally** (optional): create a `.dev.vars` file in this folder (`.gitignore` keeps it out of
git and `.assetsignore` keeps it off the published site) containing
`NOTION_CLIENT_ID=...` and `NOTION_CLIENT_SECRET=...`, add `http://localhost:8787/api/notion/callback`
as a second redirect URI in Notion, and run `npm run dev`.

### Could this connect directly to Moodle with no manual export/upload step?

Not without the school's IT department. Moodle's Web Services API can expose calendar data, but a
site administrator has to turn on web services and grant permissions first, which a student can't do.
The `.ics` upload sidesteps that by using Moodle's built-in, self-serve calendar export.

## Early access & results

The early-access form and the anonymous feature counts are saved in a free **Cloudflare D1** database
through `worker.js`. They only work on the Cloudflare deployment. On GitHub Pages or a local file, the
form says sign-ups only work on the live site, and feature counting quietly does nothing.

### One-time setup (about 5 minutes)

Run these in this folder:

1. **Create the database:**
   ```bash
   npx wrangler d1 create timewise
   ```
   If Wrangler offers to add it to your config, say **yes** and use `DB` as the binding name.
   Otherwise, paste the block it prints into `wrangler.json` (inside the top-level `{ }`), making
   sure the binding is `DB`:
   ```json
   "d1_databases": [
     { "binding": "DB", "database_name": "timewise", "database_id": "<the id it printed>" }
   ]
   ```
   You don't need to create any tables. `worker.js` creates them automatically on first use.
2. **Choose a password for the results page:**
   ```bash
   npx wrangler secret put ADMIN_KEY
   ```
   Type a long, random password when asked. It's stored in Cloudflare, never in git.
3. **Deploy:** `npm run deploy`

### Reading the results

Open `https://<your-site>/results.html` and enter your `ADMIN_KEY`. You'll see:

- **Headline numbers:** unique visitors, how many tried a demo feature, form responses (and how many
  left an email), and the share who'd use TimeWise weekly ("Definitely" + "Probably").
- **What visitors tried:** the share of visitors who used each feature (connected a calendar, used
  Replan, saw a reflection, finished the quiz, and so on).
- **Answer breakdowns** for each survey question.
- **Every response**, newest first, with a **Download CSV** button.

The page is reachable by anyone, but it shows nothing without the key, and it's marked `noindex`.

### What gets stored, and privacy

- **Sign-ups:** an optional email plus the three answers, keyed to a random visitor ID. The same browser
  answering again updates its row instead of adding a new one.
- **Feature counts:** only "visitor X used feature Y at least once," using a random ID kept in that
  browser's `localStorage`. No names, IP addresses, cookies, or calendar contents are stored.
- A hidden "honeypot" field quietly drops most spam bots.
- The form's small print tells visitors about both. If you add new survey options, update **both** the
  radio buttons in `index.html` and the `SURVEY` list at the top of the early-access section in
  `worker.js`. Answers that don't match are stored as blank.

To wipe the data (for example, after testing), run:
`npx wrangler d1 execute timewise --remote --command "DELETE FROM signups; DELETE FROM events;"`

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
- The Google/Notion *fallback* sample events (used only when a real connection isn't set up) live in
  `PROVIDER_SAMPLE_EVENTS` in `script.js` — each entry is `{ dayIndex, title, startMinutes, endMinutes, category }`, where `category` is `"class"`,
  `"assignment"`, or `"personal"` (this controls the color of the event on the grid).
- Replan's rules live in `buildReplan()` in `script.js` (section 15). `REPLAN_BREATHER` sets the slack
  after each moved block, and `FIXED_KEYWORDS` decides which blocks start out as fixed.
- The "Your Week" grid itself is driven by the `weekEvents` array in `script.js`. Add events with
  `addWeekEvent({ title, dayIndex, startMinutes, endMinutes, category, source })` (`dayIndex` 0 = Monday)
  and call `renderAll()`, which repaints both the grid and Plan vs. Reality. Maya's sample week (loaded
  on page open) lives in `SAMPLE_WEEK`.
- Plan vs. Reality's insight rules live in `buildReflection()` in `script.js`, checked in this order:
  a cascade (an overrun followed by a later slip), then the most common reason a block slipped (energy,
  something ran long, urgent, distracted, bigger than planned, avoidance), then overruns only, then
  "everything went to plan." Each rule writes one insight and one next step.
- `.ics` uploads now expand simple weekly/daily repeating events (the kind class schedules use), so
  recurring lectures show up in the current week even if the series started months ago.
