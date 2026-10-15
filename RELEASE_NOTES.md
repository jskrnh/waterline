# Waterline

### [wtrline.com](https://wtrline.com)

Find the day you go under. A cash-flow forecaster, budget planner and debt payoff tool that
runs entirely in your browser and never asks for a bank login.

---

# Release notes

## 2.9 — 15 October 2026

**No more "Two plans, one account". Your devices now stay in step on their own.**

### Fixed

- **The "Two plans, one account" question kept coming back.** Whenever you reopened a tab, it
  treated any difference between the device and your account as a conflict, even when the device's
  copy was simply older. Each device now remembers what it last exchanged with your account, so it
  can tell an *out-of-date* copy from a *changed* one:

  | What happened | What Waterline does |
  |---|---|
  | You edited on another device | This one quietly loads the newer plan |
  | You edited here | Your edits are saved to your account |
  | You edited both places since they last met | The newer edit wins; the other copy goes to **Backups** |

  The question is gone entirely. Nothing is lost without a copy.
- **An old tab could overwrite newer work.** Reopening a stale tab and just looking around could
  push its old plan back over your account, because every redraw counted as a save. Now only real
  edits are sent, so a stale tab can't overwrite your account.
- **Coming back to a tab** now picks up changes made on your other devices, without a reload.

---

## 2.8 — 15 October 2026

**The balance chart now draws properly on a phone.**

### Fixed

- **The chart was squashed on phones.** It was drawn on a fixed 960 × 300 canvas and then stretched
  to fit. On a phone that squeezed it about three times harder sideways than up and down, so the
  numbers and month names came out tall and narrow, and the months crowded together. The chart is
  now drawn at the size it's actually shown on every screen:
  - **Text keeps its real shape** at every width.
  - **Month labels thin out** when space is tight (every second month on a phone, all twelve on a
    laptop), and January shows its year (*Jan ’27*).
  - **The height suits the screen:** taller on a phone, wider and shorter on a laptop.
  - **The money labels on the left size themselves** to the largest figure, so nothing gets cut off.
- **The chart redraws itself when its width changes** — rotating the phone, resizing the window or
  opening a sidebar — with no reload.
- **The lowest-point label no longer sits on top of the balance line.** It looks for the clearest
  space around the dot. If it has to move away, a thin line connects it to the point.

### Changed

- **The *Add a one-off* button is gone from the Forecast.** Tap any day on the calendar to add an
  expense or income on that date instead.

---

## 2.7 — 15 October 2026

**Your plan can no longer be overwritten by accident, and it's now backed up.**

### Fixed

- **The About page could replace your plan with the sample numbers.** *Get started* at the bottom
  of the page and *Try it with sample numbers* at the top both loaded the sample plan over yours,
  with no warning, and saved it to your account if you were signed in. Both now do something safe
  when you already have a plan:
  - **The page offers *Go to my overview* and *Preview sample numbers*.** The old buttons only
    appear for a brand-new visitor with nothing to lose.
  - **Previewing opens the sample in a separate mode that saves nothing.** A banner says you're
    previewing and offers **Back to my plan**. Your own plan isn't touched, even if you edit the
    sample. Reloading the page also brings your plan back.
  - **Starting a blank plan asks first** and backs up the old one.

### New

**Backups.** Open them from the account menu under **Backups**.

- **Automatic copies:** Waterline saves a copy before anything replaces your plan (starting a blank
  plan, restoring, or choosing between the device and account copies at sign-in) and once a day
  while you use it. It skips a copy that's identical to the last one.
- **Back up now:** saves a copy whenever you like.
- **Download backup file:** saves your whole plan as `waterline-backup-YYYY-MM-DD.json`. Keep it in
  email, a cloud drive, or anywhere else.
- **Restore from file:** loads a downloaded backup. Files that aren't Waterline backups are
  rejected, and nothing is changed.
- **Restore** any saved copy from the list, or download or delete it. Your current plan is backed
  up before every restore, so a restore can always be undone.
- **Storage:** backups stay on the device, up to 20. Older automatic copies make room for new ones
  first.
- **Delete all my data** now says how many backups it will remove, and suggests downloading one
  first.

### Changed

- **"What this is" is now *About*,** in the account menu and the footer.

---

## 2.6 — 15 October 2026

**Your starting balance gets out of the way.**

### Changed

- **The Starting point card folds into a pill once it's set.** After the first time, *Balance
  today* no longer takes up the top of Overview. A small pill under the page title takes its place:

  > 🏛 Starting balance **$200.00** · from Oct 15 · **Edit**

  Click the pill and the card opens with the balance selected, ready to type over. Press Enter or
  **Done** to fold it away, or just move to another page. A negative balance shows in red.
- **The same pill sits on the Forecast page.** That's where the starting balance matters most.
  Clicking it takes you to Overview with the editor open.
- **First visit is unchanged.** A blank plan opens with the card showing, so new users are asked
  for their balance first. Plans saved before this update open folded.

---

## Android app 1.0 — 15 October 2026

**Waterline is now an Android app.**

The app opens [wtrline.com](https://wtrline.com) full-screen, with no browser bar, under its own
icon on your home screen. It runs the live site, so every website update reaches the app
straight away. There's nothing to reinstall.

- **Signing in works as on the web.** That includes Google, because the app runs on Chrome rather
  than a WebView, and Google blocks sign-in inside WebViews.
- **wtrline.com links open in the app,** including sign-in emails and links people share with you.
- **Icon and splash** come from the Waterline mark: an adaptive icon that fits round, squircle and
  square launchers, with a navy splash screen.
- **Small:** 468 KB, Android 5.0 and up, targeting Android 15.
- **Download** it from the repository's
  [Releases](https://github.com/jskrnh/waterline/releases) page. Every signed build is published
  there as `waterline-1.N.apk`.

### How it's built

- `android/` contains the app, built by GitHub Actions. You don't need Android Studio.
- `/.well-known/assetlinks.json` on the site proves the app and the site belong together.
  Google's verifier confirms the link for package `com.wtrline.app`.

---

## 2.5 — 15 October 2026

**Overview opens with your money, not your targets, and the tables finally fit a phone.**

### Changed

**New order on Overview.** The page now runs:

1. Starting point
2. Money in
3. Money out
4. Where the money goes
5. The Needs / Wants / Debt payments / Savings tiles
6. Your target split
7. The month in one line

What you enter comes first. How it measures up against your targets comes after.

**Money in and Money out are colour-coded.** Money in has a light green tint and Money out a light
red one, each with a matching top edge, header, totals bar and *Add* link. You can tell which table
you're in without reading the title. The tints adapt to dark mode.

**Compact tables on phones.** Each payment is now a single line showing the category dot, name,
frequency, next payment date (and end date, if set), and the amount with its period (`/mo`, `/wk`,
`/2 wk`). Tap a line to open its editor and tap again to close it; only one is open at a time. A
new payment opens straight away so you can fill it in. Remove (×) only appears on an open row, so
you can't delete a payment by brushing past it. Drag handles still work on the collapsed lines,
and the totals bar fits on one row.

Desktop is unchanged apart from the colours.

---

## 2.4 — 15 October 2026

**Payments can end, every one shows what it really costs, and you can put them in any order.**

### New

**End dates.** Every recurring payment and income now has an **Ends** column. It defaults to *No
end date*; click it to pick the last payment. The forecast stops the payment after that date, which
suits a loan with a final instalment, a lease, a contract job or a subscription you're cancelling.
Clear it with the ×.

**What each payment adds up to.** A line under every name shows its monthly and yearly cost. Once
a payment has an end date, the line shows how many payments are left and the total still to pay:

> Car loan — ≈ $345/mo · 14 payments left · **$2,226.00** in total

A payment whose end date has passed says *Ended — not counted* and drops out of your totals.

**Totals at the bottom of each table.** Money in and Money out each end with a summary: how many
payments there are, the total **per month**, **per year**, and what actually leaves in the **next
30 days**. Any one-offs on the Forecast are mentioned there too, so nothing is hidden.

**Drag to reorder.** Grab the ⋮⋮ handle at the start of any row and drag it up or down. This works
with a mouse, a finger or a pen. With the keyboard, focus a handle and press ↑ or ↓. The order is
saved.

**Sort the tables.** Click any column heading (Bill, Amount, How often, Category, First payment,
Ends) to sort by it, and click again to reverse. Amount sorts by monthly cost, so a $120 weekly
bill ranks above a $300 monthly one. The sorted order is saved, so you can sort first and then drag
a few rows to fine-tune. On a phone, the headings appear as a scrollable *Sort* strip.

### Changed

- **The total in each table's header now matches its footer.** *Money out* used to quietly include
  one-offs spread over the forecast window, so it read $3,526 above a list that added up to
  $3,449.50. Both now show the recurring figure. The Overview tiles and the donut still include
  one-offs, as before.

### Under the hood

- Recurring items gain an `end` field. It's an empty string for none, and saved plans get it
  automatically.
- Service worker cache bumped to `waterline-v6`.

---

## 2.3 — 15 October 2026

**Budget is now Overview, and the logo moved to the top left.**

### Changed

- **The Budget page is now called Overview.** The tab, page heading, browser title and every
  "fill in the Budget page" hint now say Overview. The address is `#/overview`. Old `#/budget`
  links and bookmarks still open the right page.
- **The Waterline logo sits in the top-left corner**, beside the name, and takes you to Overview
  when clicked. On a phone the logo shows on its own, which frees enough room for all four tabs at
  standard phone width.
- **The account button shows an avatar instead of the logo.** When you're signed in it's your
  initial in a teal circle, followed by your first name. When you're signed out it's a person icon
  labelled *Account*. The menu itself is unchanged.

---

## 2.2 — 15 October 2026

**Everything about your account now lives in one menu, under the Waterline logo.**

### New

**An account menu, top right.** The Waterline logo sits in the top-right corner with your first
name beside it. Click it to see:

- **Signed in:** your name and email, then **Report**, **What this is**, **Privacy** and
  **Sign out**.
- **Signed out:** *Not signed in*, a **Sign in** button, and the same links.
- **Danger zone:** **Delete all my data**, plus **Delete account** when you're signed in.

The menu closes when you press Escape, click outside it, or choose an item. On a phone it shows
just the logo and opens as a sheet under the bar.

### Changed

- **Delete all my data is no longer on every page.** It used to sit in the footer, one click from an
  accident. It's now two clicks deep in the Danger zone, under a label that says what it removes,
  and it still asks you to confirm.
- **Report moved off the main bar** and into the account menu. The bar is back to the four pages
  you use day to day. `#/report` still works as a direct link.
- **Delete account** moved out of the sign-in sheet and into the same Danger zone.

### Fixed

- **Category dropdowns showed every option in the same colour.** When you opened one, Need, Want
  and Debt payment all took the colour of whatever was already selected (this happens on Windows
  and in Chrome), so the colour only changed after you picked. Each option now keeps its own
  colour in the open list.

---

## 2.1 — 15 October 2026

**A report you can hand to someone, a calendar you can work in, and the sign-in prompt that
wouldn't go away is gone.**

---

### New

**A Report page that exports a two-page PDF.** `#/report` builds an overview from everything you
have entered and shows it as two A4 sheets. **Export PDF** opens the print dialog; choose *Save as
PDF*. The file is named `Waterline report YYYY-MM-DD`.

- **Page 1, Where you stand:** the verdict (the day you go under, or your tightest day), four
  headline figures, a category donut against your targets, your split as bars, and your largest
  outgoings.
- **Page 2, Debt and outlook:** total owed, monthly interest, blended rate and minimums; every debt
  ranked by rate; the payment that clears it in your chosen horizon, with the order debts fall; the
  next dated movements; and a short *What stands out* list written from your own numbers.

The report measures itself before it renders. When a plan is long (we tested nine debts and two
dozen bills), it trims the least important rows first and notes what it left out. Totals always
include everything. It never spills onto a third page.

**Calendar days open up.** Click a day and it expands below the grid. You see every payment that
lands that day with its amount, category and frequency, the net movement, and the balance after.
**Add an expense** or **Add income** opens the editor right there with the date and direction
already set. One-offs can be edited or removed in place. Recurring bills link back to Budget.

**A pie chart replaces the duplicate list.** The Budget page listed every bill twice. The second
list is now a donut called **Where the money goes**:

- **By category** shows needs, wants, debt payments and what's left over.
- **By item** shows each bill, shaded by its category.

The centre shows what's left of your income, or the shortfall in red. Hovering a legend row
highlights its slice.

---

### Fixed

- **"You have a plan saved on this device and one in your account" kept coming back.** Supabase
  re-announces the sign-in every time the tab regains focus, and Waterline treated each
  announcement as a fresh sign-in. It now settles the two copies once per session. If they're
  identical it doesn't ask at all. If they differ, a proper dialog shows what each one holds and
  when it was saved. Whichever you keep is written to both places at once, so the question can't
  come back.
- **The Sign out button was invisible in dark mode.** A dark-mode colour rule meant for the filled
  Sign in button was also painting the outlined Sign out button near-black on a black bar.
- **"You go under on…" showed the wrong date.** It named the *lowest* day, not the *first* day
  below zero, and those can be months apart. It now names the first day you go under and says
  separately when and how low the balance bottoms out.
- **Calendar cells had heavy default button borders** on some browsers instead of hairlines.

---

### Under the hood

- Saved plans now carry a `savedAt` stamp. It is used only to describe each copy in the sync dialog.
- The forecast engine records `firstUnder` alongside `low`.
- Service worker cache bumped to `waterline-v3`.
- 136KB. Still one file, no build step, no new dependencies. The PDF uses the browser's own print
  engine, so text stays selectable and nothing extra is downloaded.

---

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
