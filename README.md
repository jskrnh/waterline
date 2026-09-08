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
