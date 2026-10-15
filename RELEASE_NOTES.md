# Waterline

### [wtrline.com](https://wtrline.com)

Find the day you go under. A cash-flow forecaster, budget planner and debt payoff tool that
runs entirely in your browser and never asks for a bank login.

---

# Release notes

## 2.0 — 15 October 2026

**Waterline is now a budget app that forecasts, rather than a forecaster that reports a budget.**

Everything you earn and owe is entered in one place. The forecast, the what-if scenarios and
the debt planner all read from it. The app grew from three pages to five, picked up a calendar,
and was rebuilt visually from the ground up.

Saved plans upgrade automatically. Nothing needs re-entering.

---

### New

**A welcome page.** First-time visitors land on `#/welcome` with the thesis, an animated demo of
a balance dipping under zero, and two ways in: *Try it with sample numbers* or *Start from
scratch*. Returning visitors skip it. It stays reachable from the footer.

**A calendar on the Forecast page.** A month grid where every day shows its net movement and the
running balance, carried forward through days when nothing happens. Dots mark what landed — grey
for recurring, teal for a one-off. Days below zero are tinted; the lowest point is filled solid.

**Click any day to add a one-off on that date.** The editor opens with the date already filled in.
This is the closest thing to typing straight into a row, which is what a spreadsheet does well and
most budget apps do badly. A List toggle switches back to the table view.

**A What-if page.** Scenarios moved off the Forecast onto `#/whatif`: duplicate a plan, rename it,
delete it, and pick which one is the baseline. A new **What changed** table diffs the active plan
against the baseline line by line and shows the monthly difference:

| Item | Baseline | This plan | Monthly difference |
|---|---|---|---|
| Rent | $1,700.00 monthly | $1,200.00 monthly | −$500.00 |

**A theme switch.** The nav button cycles **system → light → dark**, and the choice saves with your
plan. System follows your device, as before.

---

### Changed

**Budget drives the forecast.** Recurring income and bills are entered on the Budget page. The
Forecast reads from it and plays it forward, keeping only what is genuinely about dates: the chart,
the calendar, the ledger and one-offs. Editing a bill on Budget updates everything downstream.

**Savings is calculated, not categorised.** There is no savings category any more, because savings
is not a thing you pay — it is what survives:

```
savings = income − needs − wants − debt payments − uncategorised
```

Categories are now **need**, **want** and **debt payment**. The Budget page shows four tiles.
Needs, Wants and Savings carry targets. Debt payments does not, because it is a consequence rather
than a goal, and the summary names what it costs you: *clear the debt and that $175 a month becomes
savings.*

**70 / 20 / 10 is the first preset and the new default**, ahead of 50 / 30 / 20, 60 / 20 / 20 and
65 / 15 / 20. It is the honest starting point when rent takes a large share of your pay; a target
you miss every month teaches you nothing.

**Redesigned around Apple's type and surface discipline.** A 52px translucent nav with 12.5px
links, headings at weight 600 with tracking that tightens as size grows (−0.026em at hero size,
−0.022em at section headings, −0.01em on body), Apple's three greys on white and #f5f5f7, and pill
buttons at 17px.

The accent stays Waterline teal rather than Apple blue — the identity in the icon, the share card
and the launch film is worth more than matching someone else's palette. Typography is the system
font stack, so Apple devices render in real SF and no font files are downloaded.

---

### Fixed

- **Chart labels were unreadable on a phone.** The viewBox is fixed at 960 wide, so axis type
  rendered at roughly four physical pixels on a 390px screen. Type now scales as the box shrinks,
  and the left gutter scales with it so the dollar figures are no longer clipped.
- **Dark-mode hairlines were invisible against black**, which made the calendar grid disappear
  entirely. Lifted from `#1f1f21` to `#28282c`.
- **Debt rows collapsed on mobile.** Inline `grid-template-columns` outranked the media query.
  Moved to a class, with stacked labelled fields below 700px.
- **Editing a debt stole focus mid-keystroke** and left the planner figures stale. Rows and derived
  figures now render separately: typing updates every total without touching the inputs.

---

### Upgrading

Open the site once and your saved plan migrates. Specifically:

| Before | After |
|---|---|
| Category `save` | Category `debt` |
| Recurring items with frequency `once` | Moved into the ledger as one-offs, same date and amount |
| No `theme` | `system` |
| No `split` | `{ need: 70, want: 20, save: 10 }` |

Existing targets are preserved — if you had set 50 / 30 / 20, it stays. Scenarios, debts, one-offs
and the starting balance are untouched.

Nothing is lost and nothing needs re-entering. The migration runs on load, every time, and is safe
to run against a plan that has already been upgraded.

---

### Under the hood

- Routes: `#/welcome`, `#/budget`, `#/forecast`, `#/whatif`, `#/debt`, each setting its own
  `document.title`.
- One file, no build step, no dependencies beyond the Supabase client loaded at runtime when
  accounts are configured.
- Supabase keys still live in `config.js`, so dropping in a new `index.html` never wipes them.
- 102KB.

---

## 1.1 — 15 October 2026

Split into three pages (`#/forecast`, `#/budget`, `#/debt`). One-off payments moved out of the
recurring table and into the day-by-day ledger. Added needs/wants categorisation and a debt payoff
planner that simulates the real avalanche month by month and bisects to find the payment for a
chosen horizon.

Two engine fixes: month-end drift (a bill due on the 31st crept earlier through short months) and
back-filled start dates (an item starting next month still fired this month, which silently broke
every "what if I move this bill" comparison).

## 1.0 — 10 October 2026

Accounts with magic-link, password and Google sign-in; cloud sync with device fallback; scenario
comparison; installable as a PWA; icon set, share card and privacy page.
