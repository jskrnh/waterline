# Waterline Lite

The friendly, motivational version of Waterline, served at **https://wtrline.com/lite/**.

- **Same plan, same account.** Lite reads and writes the plan the full app uses (`waterline:plan`
  on the device, the `plans` table in Supabase) and follows the full app's sync rules: behind → load,
  ahead → send, both edited → the newest wins and the other copy goes to Backups.
- **Game state stays on the device.** Streaks, XP, levels, badges, daily goals, paid ticks and the
  cushion live in `localStorage["waterline:lite"]`. They are not part of the plan, so the full app
  can never overwrite them.
- **What Lite writes to the plan:** new bills and income (`inflow`, `outflow`, `oneoffs`), deletes,
  the balance today (`balance` + `start`), and savings goals (`wealth.goals`, first goal only).
- **Installable.** `manifest.webmanifest` + `sw.js` (scope `/lite/`) make it an app on the home screen.

## The forecast engine

`engine.js` is copied word for word from `index.html` so Lite's numbers always match the full app:
sections 5, 5b and 5c (`function step` through `function dayMap`), plus `runPayoff`,
`requiredMonthly`, `debtFacts` and `fingerprint`.

When the engine changes in `index.html`, copy those functions into `engine.js` again. Next step:
have `index.html` import `lite/engine.js` too, so there is only one copy.
