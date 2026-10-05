# TimeWise design system

Redesign of October 2026. Figma file: "TimeWise Redesign" (Today desktop and mobile, Week, components, style sheet).

## Principles

1. **Plans fall apart, and that's normal.** Design for recovering, not for keeping a perfect schedule.
2. **One coral thing at a time.** Coral marks only what's happening now or next.
3. **Answer three questions first:** what's next, how much time is left today, and what needs attention.
4. **No guilt.** Missed blocks get an offer to put them back ("That's fine. Want to put it back?"). Never a red X or a score.
5. **Write like a friend who's good at planning.** Short, specific, no hype, no emoji as decoration.
6. **Every control is at least 40px tall and works with a keyboard.** Focus rings are coral.

## Tokens (`styles.css`, section 1)

| Token | Value | Use |
|---|---|---|
| `--paper` | #eef4f3 | Page background (misty sage-blue) |
| `--surface` | #ffffff | Panels and rows |
| `--ink` / `--ink-2` | #17393d / #4f6669 | Text / supporting text |
| `--rule` | #d3e0de | Hairlines (most separation comes from hairlines and space, not boxes) |
| `--pri` | #1f6e72 | Calm teal: buttons, current tab, today |
| `--signal` | #e8684a | Coral: now / next only |
| `--warn` | #8f6200 on #f9efd6 | Packed day |
| `--ok` | #2e7d5b on #e1f1e8 | Done, free time |
| `--bad` | #b03a52 | Overlaps, errors |
| `--cat-*` | class #6272d9, assignment #df8a4e, personal #4b9cc8, work #2a9d8f, timewise #5aa86b | Categories (each person can change them) |

Older names (`--purple`, `--blue`, `--gradient-primary`, …) are aliases to the tokens above, so older rules pick up the palette.

**Type:**
- Headings: Schibsted Grotesk 700/800 with tight tracking.
- Reading text: Atkinson Hyperlegible Next.
- Times: IBM Plex Mono 500 with tabular numerals, so schedules line up.

**Shape:**
- Radius: 6 for buttons and inputs, 8 for notes, 10 for main panels.
- Shadows: only on things that float (dialogs, toasts, the Feedback button).

**Spacing:** 4 · 8 · 12 · 16 · 24 · 32 · 48.

## Screens

- **Home** (`index.html`): "For weeks that don't go as planned." The hero shows a real piece of the Today screen. Below it are a timeline of a day that slides, four features as rows, and early access as a calm section.
- **Try it** (`try.html`): app tabs (Today · Week · Replan · Look back). These sit under the header on desktop and become a bottom tab bar on phones.
  - **Today** (script.js section 18): what's next, a now line, free time, quick check-ins for blocks that already ended, heads-ups (missed blocks, overlaps, packed days), and a strip showing how full each day of the week is.
  - **Week:** the grid. On tablets and phones it becomes a vertical list of days. Overlapping blocks say "Overlaps".
  - **Replan** and **Look back** keep their old logic with new copy.
- **Why TimeWise** (`about.html`): principles, Maya's day, and an honest "works today / not built yet" list. It has no made-up stats.
- **Practice:** text on the left and the phone mockup on the right. Decorative emoji are removed.

## Tests

`node tests/e2e-today.cjs` walks through Today like a student would:

1. Review today.
2. Mark a block done.
3. Miss a block and put it back.
4. Add an event that overlaps something.
5. Say you're running behind.
6. See the empty state.
7. Use it on a phone.

The clock is pinned to Monday 1:20 PM, so the results are predictable.
