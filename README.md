# Waterline — deployment guide

A cash-flow forecaster that finds the day a balance goes below zero. Single HTML file, no build step, no server to run.

It works two ways:

- **Without Supabase keys** — runs entirely on the visitor's device, no accounts. Open `index.html` and it works.
- **With Supabase keys** — visitors can sign in by email and their plan follows them across devices.

---

## Setting up accounts

### 1. Create the project

Sign up at supabase.com and create a project. Free tier is fine — it covers roughly 50,000 monthly users.

### 2. Create the table

Open **SQL Editor → New query**, paste the contents of `schema.sql`, and run it.

The row-level security policy is the important part. It makes the database refuse to return one person's row to anyone else, enforced below your code rather than by it.

### 3. Paste your keys

In Supabase, go to **Project Settings → API** and copy the Project URL and the `anon` public key.

Open `index.html` and find the config block near the top of the script:

```js
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
```

Fill both in. The anon key is designed to be public — row-level security is what protects the data, not secrecy of this key.

### 4. Set the redirect URL

In Supabase, go to **Authentication → URL Configuration** and set:

- Site URL: your live domain, e.g. `https://waterline.ca`
- Redirect URLs: add the same domain

Sign-in links will fail silently if this doesn't match where the site actually runs.

### 5. Turn off email confirmation friction (optional)

Under **Authentication → Providers → Email**, magic links are on by default. If you'd rather use passwords, enable them there and swap `signInWithOtp` for `signInWithPassword` in the code.

---

## Publishing

**Cloudflare Pages** — free, fast, no card needed.

1. Push this folder to a GitHub repository
2. In Cloudflare, go to Workers & Pages → Create → Pages → Connect to Git
3. Pick the repo, leave the build command empty, set the output directory to `/`
4. Deploy

**Netlify** — drag the folder onto app.netlify.com/drop. Live in about thirty seconds.

**A domain** costs roughly $15/year from Cloudflare or Namecheap. Add it under your project's custom domain settings.

---

## Before you take real users

**Write a privacy policy.** In Canada, PIPEDA applies to personal data you collect, even as a solo project. It needs to say what you store, where it lives (Supabase's region), how long you keep it, and how someone deletes it. A short honest page is better than a long generic one.

**The delete button already works.** It removes the user's stored plan and signs them out. Removing the login record itself needs a service-role key, which cannot be safely put in front-end code — so either handle those requests manually, or add a Supabase Edge Function calling `auth.admin.deleteUser()`.

**Never accept banking credentials.** Manual entry only. Asking for bank logins or account numbers puts you in a completely different regulatory category and is not worth it.

**Set a database backup.** Supabase does daily backups on paid tiers. On free, export periodically.

---

## What's in the file

| Section | What it does |
|---|---|
| 1. Config | Supabase keys, or blank for device-only |
| 2. Local store | Falls back to memory where localStorage is blocked |
| 3. Forecast engine | Occurrence generation and daily balance walk |
| 4. Chart | Hand-built SVG, stepped line, marked trough |
| 5. Render | Verdict, totals, item rows, ledger |
| 6. Sync | Debounced save to cloud and device |
| 7. Auth | Magic link sign-in, sign out, delete |
| 8. Events | Delegated handlers |
| 9. Boot | Load, paint, restore session |

Everything is plain JavaScript. No framework, no bundler, no dependencies beyond the Supabase client loaded from a CDN at runtime.

---

## Ideas worth adding later

- **Scenario comparison** — duplicate a plan, change one bill's date, see both troughs side by side. This is the most useful missing feature.
- **Interest on debts** — carry a balance and an APR, accrue monthly.
- **Shareable read-only link** — a plan you can send to a partner without giving them edit access.
- **CSV import** — read a bank export and suggest recurring items automatically.

---

## Update — September 2026

Added: icon set, Open Graph share card, privacy page, password + Google sign-in, PWA manifest and service worker, mobile layout.

### Enabling Google sign-in

The button is already in the page. To make it work:

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application
2. Authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Copy the Client ID and Secret into Supabase → Authentication → Providers → Google → Enable

### Enabling passwords

Supabase → Authentication → Providers → Email. Password sign-in is on by default. If you want people signed in immediately rather than confirming by email first, turn off "Confirm email" in that same panel.

### Files

| File | Purpose |
|---|---|
| `index.html` | The app |
| `privacy.html` | Privacy policy — update the contact email |
| `schema.sql` | Database table and row-level security |
| `manifest.webmanifest` | Makes it installable to a home screen |
| `sw.js` | Offline shell cache, network-first |
| `icon.svg`, `icon-180/192/512.png` | Favicon and app icons |
| `og.png` | Link preview image (1200×630) |
| `robots.txt`, `sitemap.xml` | Search engines |

### After deploying

- Set up `privacy@wtrline.com` as a forwarding address (free in Cloudflare under Email → Email Routing)
- Test the share card at opengraph.xyz
- Install to your phone home screen to check the PWA works

---

## Scenarios

Waterline holds several versions of a plan side by side. Tabs sit above the chart.

- **Duplicate as what-if** copies the current scenario and switches to it. Comparison turns on automatically, with the original set as the baseline.
- **Compare against** overlays the chosen baseline as a dashed grey line and adds a strip under the chart showing both troughs and the difference between them.
- **Rename** and **Delete** act on the scenario currently open.

Only the open scenario is editable — the rows, chart and ledger always reflect it.

### Stored shape

```json
{
  "scenarios": [
    { "id": "...", "name": "Current plan", "balance": 1500, "start": "2026-09-08",
      "inflow": [...], "outflow": [...] }
  ],
  "activeId": "...",
  "baseId": "...",
  "compare": false
}
```

Plans saved under the older single-plan shape are lifted into a scenario named "Current plan" on first load, so existing accounts keep their data.

### Two engine fixes

**Month-end drift.** Stepping a date with `setMonth` turns Jan 31 into Feb 28, then Mar 28 — creeping earlier forever. Month-based items now recompute from the anchor day each time and clamp to the month's length: Sep 30, Oct 31, Nov 30, Dec 31.

**Back-filled start dates.** An item starting on a future date was generating occurrences before it, so a bill moved to next month still fired this month. Occurrences are now clamped to the later of the item's start date and the forecast start. Past-dated anchors still rewind, so a paycheque anchored months ago keeps its correct fortnightly rhythm.

---

## Configuration lives in config.js

Supabase keys are **not** in `index.html`. Copy `config.example.js` to `config.js` and fill it in:

```js
export const SUPABASE_URL      = "https://your-project-ref.supabase.co";
export const SUPABASE_ANON_KEY = "your-anon-public-key";
```

Both values are in Supabase under **Project Settings → API**.

This is deliberate: dropping in a new `index.html` no longer wipes your keys. If the sign-in button disappears after an update, `config.js` is missing — the account strip will say so.

With no `config.js` the app still works, device-only, with no accounts.

`config.js` is excluded from the service worker cache so a key change takes effect immediately.

---

## Update — October 2026: three pages

The site is now a hash-routed app in one file: `#/forecast`, `#/budget`, `#/debt`.
Each route sets its own `document.title` and only the active page renders, so adding a
page costs nothing on the others.

### One-offs live in the ledger, not the rules table

Recurring items (rent, pay, groceries) stay in Money in / Money out. Anything that happens
once — a repair, a refund, a filing fee — is added straight into the day-by-day list with
**Add a one-off**. It appears in the ledger as a chip on its date: click to edit, × to delete.

Saved plans migrate automatically. Any item previously stored with frequency `once` is moved
out of the recurring table and becomes a one-off on the same date, keeping its name, amount
and direction.

Data shape:

```json
{
  "scenarios": [{
    "id": "…", "name": "Current plan", "balance": 1500, "start": "2026-10-15",
    "inflow":  [{ "id": "…", "name": "Pay", "amount": 2100, "freq": "biweekly",
                  "start": "2026-10-19", "cat": "" }],
    "outflow": [{ "…": "…", "cat": "need" }],
    "oneoffs": [{ "id": "…", "name": "Car repair", "amount": 450,
                  "date": "2026-11-04", "dir": "out", "cat": "need" }]
  }],
  "debts": [{ "id": "…", "name": "Credit card", "balance": 1800,
              "apr": 21.99, "minimum": 50 }],
  "split": { "need": 50, "want": 30, "save": 20 },
  "payoffMonths": 36,
  "activeId": "…", "baseId": "…", "compare": false
}
```

### Budget

Every income and outgoing carries a category: **need**, **want**, or **savings & debt**.
The page shows each bucket as a share of income against a target you set (50/30/20,
60/20/20 and 65/15/20 presets, or your own). One-offs are spread across the forecast
window so a single large payment does not swamp one month. Anything uncategorised is
flagged rather than silently dropped.

### Debt

Debts are listed by interest rate, highest first — that is the order to attack them.
Each row shows what it costs per month in interest alone.

The planner simulates the real payoff rather than using a closed-form annuity: interest
accrues monthly, minimums are paid on everything, and the remainder goes to the highest
rate. To find the payment for a chosen horizon it bisects on the monthly amount (64
iterations) until the simulation clears inside that many months.

Two behaviours worth knowing:

- **The payment has a floor.** Once the required payment equals the sum of the minimums,
  a longer finish line cannot lower it — it only adds interest. The page says so and offers
  to set the horizon to the minimums-only payoff date.
- **Clear order is not rate order.** A low-rate loan with a large minimum often clears
  first. The "order they fall" table shows what actually happens, which is usually not
  the same as the avalanche ranking above it.

The suggested finish line uses the surplus from the Budget page when there is one —
minimums plus whatever the month actually leaves over — and falls back to a stretch above
the minimums when the budget is empty.

### Fixes in this pass

- `[hidden]` did nothing, because an author `display` rule outranks the browser default.
  The one-off entry row was permanently open. Added `[hidden]{display:none!important}`.
- Chart type rendered at roughly four physical pixels on a phone: the viewBox is fixed at
  960 wide, so labels now scale up as the box shrinks, and the chart redraws on resize.
- Inline `grid-template-columns` on debt rows outranked the mobile media query and
  collapsed the inputs. Moved to a class, with stacked labelled fields under 700px.
- Editing a debt rebuilt the whole page and stole focus mid-keystroke. Rows and derived
  figures are now rendered separately; typing updates every total without touching the inputs.

---

## Update — October 2026: five pages, Apple-flavoured

Routes are now `#/welcome`, `#/budget`, `#/forecast`, `#/whatif`, `#/debt`.

### Budget is the driver

Recurring income and bills are entered on **Budget**, not Forecast. Forecast reads from
whatever Budget holds and plays it forward. Forecast keeps only what is genuinely about
dates: the chart, the calendar, the ledger, and one-offs.

### Savings is computed, not categorised

Categories are **need**, **want**, **debt payment**. There is no savings category, because
savings is not something you pay — it is what survives:

```
savings = income − needs − wants − debt payments − uncategorised
```

The Budget page shows four tiles. Needs, Wants and Savings carry targets; Debt payments does
not, because it is a consequence rather than a goal. Items saved under the old `save`
category migrate to `debt` on load.

Target presets, in order: **70 / 20 / 10** (the default), 50 / 30 / 20, 60 / 20 / 20,
65 / 15 / 20.

### Calendar

Forecast opens on a month grid. Each day shows its net movement and the running balance
carried through quiet days, with dots marking what landed — grey for recurring, teal for a
one-off. Days below zero are tinted; the lowest point is filled solid. **Click any day** to
open the one-off editor with that date filled in. Month navigation is clamped to the
forecast window. A List toggle switches back to the table.

### What-if

Scenarios moved off Forecast onto their own page: duplicate, rename, delete, and choose a
baseline to compare against. The **What changed** table diffs the active plan against the
baseline line by line, matching items by name and showing the monthly difference. The
comparison overlay still appears on the Forecast chart when compare is on.

### Theme

The button in the nav cycles **system → light → dark** and the choice is saved with the plan.
System means no `data-theme` attribute, so `prefers-color-scheme` decides.

### Design

Apple's type and surface discipline over Waterline's palette: a 52px translucent nav with
12.5px links, headings at weight 600 with tracking that tightens as size grows
(-0.026em at hero, -0.022em at section, -0.01em on body), Apple's three greys
(#1d1d1f / #6e6e73 / #86868b) on white and #f5f5f7, and pill buttons at 17px.
The accent stays Waterline teal rather than Apple blue. The font is the system stack, so
Apple devices render in real SF and nothing is downloaded.

### Fixes in this pass

- Chart y-axis labels were clipped on a phone once the type scaled up; the left gutter now
  scales with it.
- Dark-mode hairlines were nearly invisible against black, which made the calendar grid
  disappear. Lifted from `#1f1f21` to `#28282c`.

## Update — October 2026: report, day view, sync fix (2.1)

- **Report page** (`#/report`) — a two-page A4 overview. *Export PDF* uses the browser's print
  dialog (choose *Save as PDF*). Each page measures itself off-screen and trims its longest lists
  until it fits, so it never spills onto a third page.
- **Calendar day view** — click a day to see every payment that lands on it, and to add income or an
  expense on that date in place.
- **Budget donut** — *Where the money goes*, by category or by item. It replaces the second list of
  bills.
- **Sync** — the device-or-account question is asked at most once per sign-in, never on tab
  switches, and never when both copies already match. The kept plan is written to both sides
  straight away.

See `RELEASE_NOTES.md` for the full list.

## Update — October 2026: account menu (2.2)

Account actions, Report, and *Delete all my data* now live in a menu under the logo in the top-right
corner. Delete is no longer in the footer. Category dropdown options keep their own colours.

## Update — October 2026: Overview (2.3)

The Budget page is renamed **Overview** (`#/overview`; `#/budget` redirects). The logo moved to the
top-left beside the name, and the account button shows an avatar.
