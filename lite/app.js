/* Waterline Lite — the friendly, motivational face of Waterline.
   Reads and writes the same plan as the full app (wtrline.com), through the same
   sync rules. Streaks, XP, badges and paid ticks live on this device only, so the
   full app can never overwrite them. */
import { setDoc, project, dayMap, iso, parseD, monthly, debtFacts, flow, MAIN, fingerprint } from "./engine.js";

const $ = id => document.getElementById(id);
const root = document.documentElement;
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const buzz = () => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(8); } catch (e) {} };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const T0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const TK = iso(T0);
const money = (v, sign) => { const a = Math.abs(Math.round(v)); const s = "$" + a.toLocaleString("en-CA"); return v < -0.5 ? "−" + s : (sign && v > 0.5 ? "+" + s : s); };
const dlabel = d => d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const rid = () => Math.random().toString(36).slice(2, 9);

/* ---------- storage (same keys as the full app) ---------- */
const KEY = "waterline:plan", SKEY = "waterline:sync", BKEY = "waterline:backups", LKEY = "waterline:lite";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
};
const readJSON = k => { try { return JSON.parse(store.get(k) || "null"); } catch (e) { return null; } };

/* game state: device only */
const G0 = () => ({ paid: {}, xp: 0, days: [], mdate: "", mdone: [], mkey: "", xpKeys: {}, seen: [], cushion: 300, theme: "", debtStart: 0 });
let G = Object.assign(G0(), readJSON(LKEY) || {});
const saveG = () => store.set(LKEY, JSON.stringify(G));

/* ---------- Supabase (same project and session as the full app) ---------- */
let sb = null, user = null;
try {
  const cfg = await import("../config.js");
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.118.0");
    sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
} catch (e) { console.warn("Waterline Lite: working on this device only.", e); }

/* ---------- the plan ---------- */
let DOC = null, SC = null, MODE = "sample", cloudAt = null, syncing = false;

function tidy(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.scenarios) || !d.scenarios.length) return null;
  d.scenarios.forEach(sc => { ["inflow", "outflow", "oneoffs", "accounts"].forEach(k => { if (!Array.isArray(sc[k])) sc[k] = []; }); });
  if (!d.scenarios.some(x => x.id === d.activeId)) d.activeId = d.scenarios[0].id;
  if (!Array.isArray(d.debts)) d.debts = [];
  if (!Array.isArray(d.loans)) d.loans = [];
  if (typeof d.payoffMonths !== "number") d.payoffMonths = 36;
  if (!d.debtPlan || typeof d.debtPlan !== "object") d.debtPlan = { on: false, start: "", replace: true };
  if (!d.wealth || typeof d.wealth !== "object") d.wealth = {};
  ["assets", "liabs", "goals", "history"].forEach(k => { if (!Array.isArray(d.wealth[k])) d.wealth[k] = []; });
  if (!d.wealth.proj || typeof d.wealth.proj !== "object") d.wealth.proj = { years: 10, monthly: "", ret: 5 };
  return d;
}
const hasEntries = d => !!d && Array.isArray(d.scenarios) && d.scenarios.some(sc => (sc.inflow || []).length + (sc.outflow || []).length + (sc.oneoffs || []).length > 0);
const worthKeeping = d => !!d && Array.isArray(d.scenarios) &&
  (hasEntries(d) || (d.debts || []).length > 0 || (d.loans || []).length > 0 || !!(d.wealth && (d.wealth.assets || []).length + (d.wealth.liabs || []).length + (d.wealth.goals || []).length) || d.scenarios.some(sc => (+sc.balance || 0) !== 0));

function backup(label, from) {
  if (!worthKeeping(from)) return;
  let list = readJSON(BKEY); if (!Array.isArray(list)) list = [];
  const fp = fingerprint(from);
  if (list.length && list[0].fp === fp) return;
  list.unshift({ id: rid(), at: new Date().toISOString(), label, auto: true, fp, plan: JSON.parse(JSON.stringify(from)) });
  list.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  while (list.length > 20) { let i = -1; for (let j = list.length - 1; j >= 0; j--) if (list[j].auto) { i = j; break; } list.splice(i >= 0 ? i : list.length - 1, 1); }
  store.set(BKEY, JSON.stringify(list));
}
const readSync = () => readJSON(SKEY);
const writeSync = (fp, at) => { if (user) store.set(SKEY, JSON.stringify({ uid: user.id, fp, at })); cloudAt = at; };

function sampleDoc() {
  const o = n => iso(addD(T0, n));
  const sc = { id: "s1", name: "Current plan", balance: 1640, start: o(0), accounts: [], mainName: "", oneoffs: [],
    inflow: [{ id: "a", name: "Paycheque", amount: 2100, freq: "biweekly", start: o(6), cat: "", end: "" }],
    outflow: [
      { id: "b", name: "Rent", amount: 1850, freq: "monthly", start: o(9), cat: "need", end: "" },
      { id: "c", name: "Phone", amount: 65, freq: "monthly", start: o(0), cat: "need", end: "" },
      { id: "d", name: "Internet", amount: 70, freq: "monthly", start: o(3), cat: "need", end: "" },
      { id: "e", name: "Hydro", amount: 96, freq: "monthly", start: o(12), cat: "need", end: "" },
      { id: "f", name: "Groceries", amount: 130, freq: "weekly", start: o(1), cat: "need", end: "" },
      { id: "g", name: "Car payment", amount: 159, freq: "biweekly", start: o(2), cat: "debt", end: "" },
      { id: "h", name: "Credit card", amount: 120, freq: "monthly", start: o(16), cat: "debt", end: "" },
      { id: "i", name: "Streaming", amount: 21, freq: "monthly", start: o(5), cat: "want", end: "" },
      { id: "j", name: "Gym", amount: 45, freq: "monthly", start: o(1), cat: "want", end: "" },
      { id: "k", name: "Takeout", amount: 55, freq: "weekly", start: o(4), cat: "want", end: "" },
      { id: "l", name: "Car insurance", amount: 148, freq: "monthly", start: o(20), cat: "need", end: "" }] };
  return tidy({ scenarios: [sc], activeId: "s1", baseId: "s1", compare: false, theme: "system", seen: true, seedSet: true,
    debts: [{ id: "x1", name: "Credit card", balance: 2400, apr: 21.99, minimum: 60 }, { id: "x2", name: "Car loan", balance: 5500, apr: 6.9, minimum: 320 }],
    loans: [], split: { need: 70, want: 20, save: 10 }, payoffMonths: 36, debtPlan: { on: false, start: "", replace: true },
    wealth: { assets: [], liabs: [], history: [], proj: { years: 10, monthly: "", ret: 5 }, goals: [{ id: "g1", name: "Emergency fund", target: 3000, saved: 1240, by: "" }] } });
}
function emptyDoc() {
  const sc = { id: rid(), name: "Current plan", balance: 0, start: TK, inflow: [], outflow: [], oneoffs: [], accounts: [], mainName: "" };
  return tidy({ scenarios: [sc], activeId: sc.id, baseId: sc.id, compare: false, theme: "system", seen: true, seedSet: false,
    debts: [], loans: [], split: { need: 70, want: 20, save: 10 }, payoffMonths: 36, debtPlan: { on: false, start: "", replace: true }, wealth: {} });
}
function use(d, mode) { DOC = d; MODE = mode; SC = setDoc(DOC, 186); }

/* The full app's sync rules, unchanged: behind -> load, ahead -> send, both -> newest wins, loser to Backups. */
async function syncAccount() {
  if (!sb || !user || syncing) return;
  syncing = true;
  try {
    const { data, error } = await sb.from("plans").select("data,updated_at").eq("user_id", user.id).maybeSingle();
    if (error) { toast("Couldn't reach your account. Showing this device's copy."); return; }
    const local = tidy(readJSON(KEY));
    if (!data || !data.data) {
      if (local && worthKeeping(local)) { use(local, "cloud"); await pushCloud(local); }
      else if (local) use(local, "cloud");
      else { use(emptyDoc(), "cloud"); }
      return;
    }
    const cloud = tidy(data.data);
    if (!cloud) { use(local || emptyDoc(), "local"); toast("Your saved plan needs the full app once. Open wtrline.com to update it."); return; }
    const lfp = local ? fingerprint(local) : "", cfp = fingerprint(cloud), sy = readSync(), mine = sy && sy.uid === user.id;
    if (cfp === lfp || !local) { use(cloud, "cloud"); store.set(KEY, JSON.stringify(cloud)); writeSync(cfp, data.updated_at); return; }
    const localEdited = !worthKeeping(local) ? false : !(mine && sy.fp === lfp);
    const cloudEdited = !(mine && sy.fp === cfp);
    if (!localEdited) { use(cloud, "cloud"); store.set(KEY, JSON.stringify(cloud)); writeSync(cfp, data.updated_at); return; }
    if (!cloudEdited) { cloudAt = data.updated_at; use(local, "cloud"); await pushCloud(local, true); return; }
    const localAt = Date.parse(local.savedAt || 0) || 0, cAt = Date.parse(data.updated_at || 0) || 0;
    if (cAt >= localAt) {
      backup("This device's copy, replaced by a newer one from your account", local);
      use(cloud, "cloud"); store.set(KEY, JSON.stringify(cloud)); writeSync(cfp, data.updated_at);
      toast("Loaded your newer plan. This device's copy is in Backups.");
    } else {
      backup("Account copy, replaced by newer edits on this device", cloud);
      cloudAt = data.updated_at; use(local, "cloud"); await pushCloud(local, true);
    }
  } catch (e) { console.error("Waterline Lite:", e); }
  finally { syncing = false; }
}
async function pushCloud(d, guarded) {
  if (!sb || !user) return false;
  const at = new Date().toISOString();
  const q = guarded && cloudAt
    ? sb.from("plans").update({ data: d, updated_at: at }).eq("user_id", user.id).eq("updated_at", cloudAt).select("user_id")
    : sb.from("plans").upsert({ user_id: user.id, data: d, updated_at: at }).select("user_id");
  const { data, error } = await q;
  if (error) { toast("Saved on this device only"); return false; }
  if (guarded && cloudAt && !(data && data.length)) {          // another device saved first: reconcile
    syncing = false; await syncAccount(); renderAll(); toast("Your plan changed on another device. It's up to date now."); return false;
  }
  writeSync(fingerprint(d), at); return true;
}
let saveT = null;
function savePlan() {
  if (MODE === "sample") return;
  DOC.savedAt = new Date().toISOString();
  store.set(KEY, JSON.stringify(DOC));
  clearTimeout(saveT);
  saveT = setTimeout(() => { if (MODE === "cloud") pushCloud(DOC, true); }, 500);
}
async function loadPlan() {
  if (sb) { try { const { data: { session } } = await sb.auth.getSession(); user = session ? session.user : null; } catch (e) { user = null; } }
  if (user) { await syncAccount(); if (DOC) return; }
  const local = tidy(readJSON(KEY));
  if (local && worthKeeping(local)) use(local, "local");
  else use(sampleDoc(), "sample");
}

/* ---------- forecast view of the plan ---------- */
let P = null, DM = null, BAL = 0, LOW = null, UNDER = null;
function compute() {
  SC = setDoc(DOC, 186);
  P = project(); DM = dayMap(P);
  const start = parseD(SC.start);
  const td = DM.get(TK);                     // the balance this morning, before today's bills and pay land
  BAL = start > T0 || !td ? (+SC.balance || 0) : td.bal - td.delta;
  LOW = { bal: BAL, d: start > T0 ? start : T0 }; UNDER = null;
  for (let i = 0; i <= 62; i++) { const d = addD(T0, i), e = DM.get(iso(d)); if (!e) continue;
    if (e.bal < LOW.bal) LOW = { bal: e.bal, d }; if (e.bal < 0 && !UNDER) UNDER = { bal: e.bal, d }; }
}
const balOn = k => { const e = DM.get(k); return e ? e.bal : undefined; };
function rows(from, to) {
  const out = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const k = iso(d), e = DM.get(k); if (!e) continue;
    e.items.forEach(it => out.push({ d: new Date(d), k, name: it.name, amt: it.amt, cat: it.cat || "", freq: it.freq, oid: it.oid,
      key: k + "|" + it.name + "|" + Math.round(it.amt * 100) }));
  }
  return out;
}
function source(r) {     // the plan line this row came from, if Lite can edit it
  if (r.oid) { const o = SC.oneoffs.find(x => x.id === r.oid); return o ? { list: "oneoffs", it: o } : null; }
  const amt = Math.abs(r.amt);
  for (const list of ["inflow", "outflow"]) {
    const it = SC[list].find(x => (x.name || (list === "inflow" ? "Income" : "Bill")) === r.name && Math.abs(+x.amount || 0) === amt);
    if (it) return { list, it };
  }
  return null;
}

/* ---------- looks ---------- */
const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M11 18h2"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  drop: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>',
  car: '<path d="M5 16l1.5-6A2 2 0 0 1 8.4 8.5h7.2a2 2 0 0 1 1.9 1.5L19 16M3 16h18v3H3zM7 19v2M17 19v2"/>',
  cart: '<path d="M3 4h2l2.5 11h11L21 8H6.2"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>',
  gym: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="12" cy="12" r="3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 2-2 6 0 8v10"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  swap: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>'
};
const GUESS = [[/rent|mortgage|condo|strata|property tax/i, "home"], [/phone|mobile|cell|rogers|bell|telus|fido|koodo|freedom|virgin/i, "phone"],
  [/internet|wifi|wi-fi/i, "wifi"], [/hydro|electric|power|gas bill|enbridge|heat/i, "bolt"], [/water/i, "drop"],
  [/insur/i, "shield"], [/car|auto|gas|fuel|parking|transit|presto/i, "car"], [/grocer|food basics|no frills|costco|walmart|loblaw|metro|freshco/i, "cart"],
  [/netflix|spotify|disney|stream|youtube|prime|crave|apple|music/i, "play"], [/gym|fitness|goodlife|yoga/i, "gym"],
  [/takeout|uber eats|doordash|skip|restaurant|coffee|tim/i, "food"], [/card|loan|debt|line of credit|loc|visa|mastercard|amex/i, "card"],
  [/pay|salary|wage|income|deposit|cheque|bonus/i, "cash"]];
const iconFor = (name, amt) => { for (const [re, k] of GUESS) if (re.test(name || "")) return k; return amt > 0 ? "cash" : "star"; };
const KIND = { need: { n: "Needs", c: "#1479ff" }, want: { n: "Wants", c: "#ff9f1a" }, debt: { n: "Debt", c: "#8a5cff" }, "": { n: "Other", c: "#5d7fa3" }, in: { n: "Income", c: "#18b26b" } };
const kindOf = r => r.amt > 0 ? KIND.in : (KIND[r.cat] || KIND[""]);
const FREQ = { weekly: "Weekly", biweekly: "Bi-Weekly", monthly: "Monthly", quarterly: "Every 3 months", yearly: "Yearly" };
const icon = (k, col) => `<div class="ico" style="background:${col}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ICONS.star}</svg></div>`;
const chkSvg = '<span><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5"/></svg></span>';
const tickSvg = '<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
const wave = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M2 12c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3M2 18c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/></svg>';
const flame = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></svg>';

function countTo(el, v) {
  if (RM) { el.textContent = money(v); el.dataset.v = v; return; }
  const from = +(el.dataset.v || 0), t0 = performance.now(), dur = 750; el.dataset.v = v;
  const f = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - (1 - p) ** 3; el.textContent = money(from + (v - from) * e); if (p < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function wavePath(y, amp, len) { let d = `M0 ${y}`; for (let x = 0; x <= 800; x += len) d += ` Q${x + len / 4} ${y - amp} ${x + len / 2} ${y} T${x + len} ${y}`; return d + " V300 H0 Z"; }
function drawSea(level) {
  const y = 300 - level * 300;
  $("waves").innerHTML = `<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3cc8e8"/><stop offset="1" stop-color="#1479ff"/></linearGradient><linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f8dff"/><stop offset="1" stop-color="#0b56c9"/></linearGradient></defs>
  <g class="w2"><path d="${wavePath(y - 6, 9, 200)}" fill="url(#sg)" opacity=".55"/></g><g class="w1"><path d="${wavePath(y + 8, 7, 160)}" fill="url(#sg2)"/></g>`;
  $("drip").style.bottom = `calc(${level * 100}% - 30px)`;
}
function face(mood) {
  const eyes = mood === "bad" ? '<path d="M21 42l5 2M39 42l-5 2" stroke="#0b2e57" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="47" r="2.6" fill="#0b2e57"/><circle cx="36" cy="47" r="2.6" fill="#0b2e57"/>' : '<circle cx="24" cy="45" r="3" fill="#0b2e57"/><circle cx="36" cy="45" r="3" fill="#0b2e57"/><circle cx="25" cy="44" r="1" fill="#fff"/><circle cx="37" cy="44" r="1" fill="#fff"/>';
  const mouth = mood === "good" ? '<path d="M24 52q6 6 12 0" stroke="#0b2e57" stroke-width="2.6" fill="none" stroke-linecap="round"/>' : mood === "tight" ? '<path d="M25 54h10" stroke="#0b2e57" stroke-width="2.6" stroke-linecap="round"/>' : '<ellipse cx="30" cy="55" rx="3.5" ry="4" fill="#0b2e57"/>';
  return eyes + mouth + '<circle cx="19" cy="51" r="3" fill="#ff8fa3" opacity=".55"/><circle cx="41" cy="51" r="3" fill="#ff8fa3" opacity=".55"/>';
}
function stars() { let s = 0x2f6b, h = ""; const r = () => (s = s * 16807 % 2147483647) / 2147483647; for (let i = 0; i < 26; i++) h += `<i style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 55).toFixed(1)}%;animation-delay:${(r() * 3).toFixed(2)}s;opacity:${(.4 + r() * .6).toFixed(2)}"></i>`; $("stars").innerHTML = h; }
const isDark = () => { const t = root.getAttribute("data-theme"); return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
function setTheme(t) { if (t) root.setAttribute("data-theme", t); else root.removeAttribute("data-theme");
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = isDark() ? "#061829" : "#bfe6ff"; }

/* ---------- game ---------- */
const LV = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000], LN = ["Puddle", "Creek", "Stream", "River", "Lake", "Bay", "Sea", "Ocean", "Tide", "Deep"];
function lvl(x) { let i = 0; while (i < LV.length - 1 && x >= LV[i + 1]) i++; const nx = LV[i + 1] || LV[i] + 1500; return { i, name: LN[i], n: i + 1, cur: x - LV[i], need: nx - LV[i], left: nx - x }; }
function checkIn() { if (!G.days.includes(TK)) { G.days.push(TK); G.days = G.days.slice(-400); saveG(); } }
function streak() { const set = new Set(G.days); let d = set.has(TK) ? new Date(T0) : addD(T0, -1), n = 0; while (set.has(iso(d))) { n++; d = addD(d, -1); } return n; }
function floater(txt, x, y) { if (RM) return; const f = document.createElement("div"); f.className = "float"; f.textContent = txt; f.style.left = (x - 10) + "px"; f.style.top = (y - 20) + "px"; document.body.appendChild(f); setTimeout(() => f.remove(), 1000); }
function addXP(n, x, y) {
  const before = lvl(G.xp); G.xp += n; checkIn(); saveG(); floater("+" + n + " XP", x ?? innerWidth / 2, y ?? innerHeight / 2);
  const after = lvl(G.xp); paintChips();
  if (streak() >= 7) award("week"); if (streak() >= 30) award("month30");
  if (after.i > before.i) setTimeout(() => celebrate("You reached " + after.name + "!", "Level " + after.n + ". Every bill you handle makes the water deeper.", 0), 700);
}
const BADGES = [
  { id: "first", n: "First check", c: "#18b26b", i: '<path d="M5 12l4 4 10-10"/>' },
  { id: "week", n: "7-day wave", c: "#ff7a1a", i: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/>' },
  { id: "perfect", n: "Perfect day", c: "#ffb400", i: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>' },
  { id: "half", n: "Halfway", c: "#1479ff", i: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>' },
  { id: "month", n: "All paid", c: "#8a5cff", i: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 13l3 3 5-6"/>' },
  { id: "month30", n: "30-day wave", c: "#ff5a5f", i: '<path d="M2 12c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/>' },
  { id: "debt", n: "Debt down", c: "#0b56c9", i: '<path d="M12 4v14M6 12l6 6 6-6"/>' },
  { id: "goal", n: "Goal hit", c: "#18b26b", i: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/>' }];
function award(id) { if (G.seen.includes(id)) return; G.seen.push(id); saveG(); const b = BADGES.find(x => x.id === id); if (b) setTimeout(() => toast("Badge unlocked: " + b.n), 2600); }

function monthRows() { const m0 = new Date(T0.getFullYear(), T0.getMonth(), 1), m1 = new Date(T0.getFullYear(), T0.getMonth() + 1, 0);
  const r = rows(m0, m1).filter(x => x.amt < 0); r.forEach(x => { if (x.d < T0 && G.paid[x.key] === undefined) G.paid[x.key] = 1; }); return r; }
function MIS() {
  if (G.mdate !== TK) { G.mdate = TK; G.mdone = []; G.mkey = ""; saveG(); }
  const ev = rows(T0, addD(T0, 6)).filter(e => e.amt < 0);
  const next = (G.mdone.includes("pay") && ev.find(e => e.key === G.mkey)) || ev.find(e => !G.paid[e.key]) || ev[0];
  const g = goal();
  return [
    { id: "pay", key: next ? next.key : "", t: next ? "Pay " + next.name : "Look over your week", s: next ? status(next.d)[0] + " · " + money(-next.amt) : "Nothing due in the next 7 days", xp: 20, act: next ? "Find it" : "Open" },
    { id: "cal", t: "Peek at this week", s: "Open the calendar and spot your low day", xp: 20, act: "Open" },
    g ? { id: "save", t: "Feed " + (g.name || "your goal"), s: "Put $25 toward it", xp: 20, act: "Add $25" }
      : { id: "save", t: "Set a savings goal", s: "Pick something to save for", xp: 20, act: "Set one" }];
}
function doneMission(id) {
  MIS(); if (G.mdone.includes(id)) return; G.mdone.push(id); saveG();
  const m = MIS().find(x => x.id === id);
  setTimeout(() => { addXP(m.xp, innerWidth / 2, 200); paintMotiv();
    if (G.mdone.length === 3) { celebrate("Perfect day!", "All three goals done. Your streak keeps rolling.", 50); award("perfect"); } }, id === "cal" ? 600 : 250);
}
const goal = () => (DOC.wealth.goals || [])[0] || null;

/* ---------- rows ---------- */
function status(d) { const n = Math.round((d - T0) / 864e5); return n <= 0 ? ["Due today", "now"] : n === 1 ? ["Tomorrow", "soon"] : n < 7 ? ["In " + n + " days", ""] : [dlabel(d), ""]; }
function rowHtml(e, i) {
  const p = !!G.paid[e.key], [st, cl] = status(e.d), k = kindOf(e), inc = e.amt > 0;
  return `<div class="row${p ? " paid" : ""}" data-k="${esc(e.key)}" style="animation-delay:${Math.min(i, 8) * 35}ms">${icon(iconFor(e.name, e.amt), k.c)}
  <div><div class="nm">${esc(e.name)}</div><div class="st ${inc ? "" : cl}">${inc && st === "Due today" ? "Arrives today" : st}</div></div>
  <div class="amt num${inc ? " in" : ""}">${inc ? money(e.amt, true) : money(-e.amt)}</div>
  <button class="chk" aria-label="Mark ${esc(e.name)} ${inc ? "received" : "paid"}">${chkSvg}</button></div>`;
}
const findRow = key => { const [k] = key.split("|"); return rows(parseD(k), parseD(k)).find(r => r.key === key); };

/* ---------- Today ---------- */
const LINES = {
  good: ["You're above water for the next two months. That's what calm feels like.", "Look at you, <b>{low}</b> of breathing room at the lowest point.",
    "Small wins add up. You've handled <b>{paid}</b> bills this month.", "<b>{streak}</b> in a row. Don't break the wave!", "Every bill you check off is one less thing on your mind."],
  tight: ["Tight around <b>{lowd}</b>, but you've got this. Skip one extra that week.", "Close call on <b>{lowd}</b>. A small move now keeps you above <b>{cush}</b>.", "You're still above zero. Let's get you back above your cushion."],
  bad: ["You dip under on <b>{und}</b>. We caught it early, and that's the win.", "Heads up for <b>{und}</b>. Moving one bill past payday fixes it."],
  empty: ["Hi! I'm Drip. Add your balance and a few bills and I'll watch the water for you.", "Start with your balance today, then add your paycheque. That's all I need."]
};
let lineIx = 0;
const moodNow = () => !hasEntries(DOC) ? "good" : LOW.bal < 0 ? "bad" : LOW.bal < G.cushion ? "tight" : "good";
function dripLine() {
  const L = !hasEntries(DOC) ? LINES.empty : LINES[moodNow()];
  const paid = monthRows().filter(e => G.paid[e.key]).length, s = streak();
  return L[(lineIx + T0.getDate()) % L.length].replace("{low}", money(LOW.bal)).replace("{lowd}", dlabel(LOW.d)).replace("{cush}", money(G.cushion))
    .replace("{und}", UNDER ? dlabel(UNDER.d) : "").replace("{paid}", paid).replace("{streak}", s === 1 ? "1 day" : s + " days");
}
function paintChips() { const L = lvl(G.xp), s = streak(); $("streakChip").innerHTML = flame + (s ? s + "-day streak" : "Start a streak"); $("lvlChip").innerHTML = wave + "Lv " + L.n + " · " + L.name; }
function renderToday(first) {
  compute();
  $("sea").classList.toggle("night", isDark());
  drawSea(Math.max(.18, Math.min(.4, .2 + .2 * (LOW.bal / (Math.max(50, G.cushion) * 4)))));
  const mood = moodNow(); $("face").innerHTML = face(mood);
  const b = $("bubble"); b.className = "bubble" + (mood === "bad" ? " bad" : ""); b.innerHTML = dripLine();
  countTo($("bal"), BAL); countTo($("low"), LOW.bal);
  $("tLow").classList.toggle("bad", LOW.bal < 0); $("lowLbl").textContent = LOW.bal < 0 ? "Goes under" : "Lowest point"; $("lowWhen").textContent = dlabel(LOW.d);
  const mo = monthRows(), pc = mo.filter(e => G.paid[e.key]).length;
  $("paidCt").textContent = pc + "/" + mo.length;
  requestAnimationFrame(() => $("paidBar").style.width = (mo.length ? pc / mo.length * 100 : 0) + "%");
  $("modeBox").innerHTML = MODE === "sample"
    ? `<div class="card banner"><div class="chead"><div><b>These are sample numbers</b><br><small>Sign in to see your Waterline plan, or start your own on this phone.</small></div></div><div class="btnrow"><button class="btn" id="mSign">Sign in</button><button class="btn ghost" id="mFresh">Start my own</button></div></div>`
    : !hasEntries(DOC) ? `<div class="card banner"><div class="chead"><div><b>Let's fill the water</b><br><small>Set your balance today, then tap + to add your paycheque and bills.</small></div></div><div class="btnrow"><button class="btn" id="mBal">Set balance</button><button class="btn ghost" id="mAdd">Add a bill</button></div></div>` : "";
  $("alertBox").innerHTML = UNDER ? `<div class="alert"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" stroke-width="2.4" stroke-linecap="round"><path d="M12 3l10 18H2zM12 10v5M12 18v.5"/></svg><div><b>Goes under ${money(UNDER.bal)}</b><br>on ${dlabel(UNDER.d)}. Try moving a bill past payday.</div></div>` : "";
  paintMotiv();
  const ev = rows(T0, addD(T0, 30));
  const a = ev.filter(e => e.d < addD(T0, 7)), c = ev.filter(e => e.d >= addD(T0, 7));
  $("soon").innerHTML = a.length ? a.map(rowHtml).join("") : '<div class="empty">Nothing due this week.</div>';
  $("later").innerHTML = c.length ? c.map(rowHtml).join("") : '<div class="empty">Nothing else in the next month.</div>';
  if (first && !RM) $("soon").querySelectorAll(".row").forEach(r => r.style.animationDelay = (parseFloat(r.style.animationDelay) + 900) + "ms");
}
const QUOTES = ["A forecast is just a plan you can see.", "Future you is already grateful.", "Calm money is built one bill at a time.", "You don't need a perfect month. Just the next good choice."];
function ringSvg(f, col) { const C = 2 * Math.PI * 18; return `<svg class="ringsm" viewBox="0 0 46 46"><circle cx="23" cy="23" r="18" fill="none" stroke="var(--soft)" stroke-width="6"/><circle cx="23" cy="23" r="18" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C * f} ${C}" transform="rotate(-90 23 23)" style="transition:stroke-dasharray .8s cubic-bezier(.3,1.3,.5,1)"/><text x="23" y="27.5" text-anchor="middle" font-size="12" font-weight="900" fill="var(--ink)">${Math.round(f * 3)}/3</text></svg>`; }
function goalHtml() {
  const g = goal();
  if (!g) return `<div class="chead"><div><b>Savings goal</b><br><small>Pick something to save for and watch it fill.</small></div><span class="xp">+20 XP</span></div><button class="btn green" id="gNew">Set a goal</button>`;
  const tgt = +g.target || 0, sv = +g.saved || 0, f = tgt ? Math.min(1, sv / tgt) : 0, left = Math.max(0, tgt - sv);
  return `<div class="chead"><div><b>${esc(g.name || "Savings goal")}</b><br><small>${f >= 1 ? "Done! You did it." : money(left) + " to go · " + Math.round(f * 100) + "% there"}</small></div><span class="xp">+15 XP</span></div>
  <div class="goalbar"><i data-w="${(f * 100).toFixed(1)}"></i></div>
  <div class="goalnums"><span><b class="num">${money(sv)}</b> saved</span><span>of ${money(tgt)}</span></div>
  <div class="btnrow"><button class="btn green" data-add="25">+ $25</button><button class="btn ghost" data-add="100">+ $100</button></div>`;
}
function animBars() { requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll(".goalbar i[data-w],.xpbar i[data-w]").forEach(b => b.style.width = b.dataset.w + "%"))); }
function paintMotiv() {
  paintChips();
  const ms = MIS(), done = ms.filter(m => G.mdone.includes(m.id)).length;
  $("missions").innerHTML = `<div class="card"><div class="chead"><div><b>Today's goals</b><br><small>${done === 3 ? "All done. See you tomorrow!" : "Finish all 3 for a bonus"}</small></div>${ringSvg(done / 3, "var(--sand)")}</div>
  ${ms.map(m => { const d = G.mdone.includes(m.id); return `<div class="mis${d ? " done" : ""}"><span class="tick">${tickSvg}</span><div><div class="mt">${esc(m.t)}</div><small>${esc(m.s)}</small></div>${d ? '<span class="xp">+' + m.xp + " XP</span>" : `<button class="go" data-mis="${m.id}">${m.act}</button>`}</div>`; }).join("")}</div>`;
  $("goalCard").innerHTML = '<div class="card">' + goalHtml() + "</div>";
  $("quote").textContent = QUOTES[T0.getDate() % QUOTES.length];
  animBars();
}

/* ---------- confetti, toast, celebrate ---------- */
function burst(x, y) { if (RM) return; const cols = ["#1479ff", "#3cc8e8", "#ffc94a", "#18b26b", "#ff5a5f"];
  for (let i = 0; i < 14; i++) { const s = document.createElement("i"); s.className = "cf"; const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 50;
    s.style.cssText = `left:${x}px;top:${y}px;background:${cols[i % 5]};--x:${Math.cos(a) * r}px;--y:${Math.sin(a) * r - 20}px;--r:${Math.random() * 360}deg`; document.body.appendChild(s); setTimeout(() => s.remove(), 750); } }
let tTimer, undoFn;
function toast(msg, undo) { $("toastMsg").textContent = msg; undoFn = undo; $("toastUndo").hidden = !undo; $("toast").classList.add("on"); clearTimeout(tTimer); tTimer = setTimeout(() => $("toast").classList.remove("on"), 3200); }
$("toastUndo").onclick = () => { if (undoFn) undoFn(); $("toast").classList.remove("on"); };
function celebrate(t, sub, xp) {
  $("celeT").textContent = t; $("celeS").textContent = sub; $("celeX").textContent = xp ? "+" + xp + " XP" : "Level up"; $("celeFace").innerHTML = face("good");
  $("cele").classList.add("on"); buzz(); if (xp) { G.xp += xp; saveG(); }
  if (!RM) { const cols = ["#1479ff", "#3cc8e8", "#ffc94a", "#18b26b", "#ff5a5f", "#8a5cff"];
    for (let i = 0; i < 46; i++) { const r = document.createElement("i"); r.className = "rain"; r.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % 6]};animation-duration:${1.6 + Math.random() * 1.6}s;animation-delay:${Math.random() * .6}s`; $("cele").appendChild(r); setTimeout(() => r.remove(), 3600); } }
  setTimeout(() => $("celeGo").focus({ preventScroll: true }), 300);
}
$("celeGo").onclick = () => { $("cele").classList.remove("on"); paintMotiv(); if ($("v-goals").classList.contains("on")) renderGoals(); };

/* ---------- paying ---------- */
function togglePaid(key, el) {
  const mk = MIS()[0].key, was = !!G.paid[key];
  if (was) delete G.paid[key]; else G.paid[key] = 1; saveG(); buzz();
  document.querySelectorAll(`.row[data-k="${CSS.escape(key)}"]`).forEach(r => r.classList.toggle("paid", !was));
  const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  if (!was && r) burst(r.left + r.width / 2, r.top + r.height / 2);
  const row = findRow(key);
  if (!was) { award("first");
    if (!G.xpKeys[key]) { G.xpKeys[key] = 1; const ks = Object.keys(G.xpKeys); if (ks.length > 600) ks.slice(0, 200).forEach(k => delete G.xpKeys[k]); addXP(10, r ? r.left : undefined, r ? r.top : undefined); }
    if (mk === key) { G.mkey = key; doneMission("pay"); }
    toast(`${row ? row.name : "Bill"} ${row && row.amt > 0 ? "received" : "paid"}`, () => togglePaid(key)); }
  setTimeout(() => { renderToday(); if ($("v-cal").classList.contains("on")) renderCal();
    const mo = monthRows();
    if (!was && mo.length && mo.every(e => G.paid[e.key])) { const mkk = "all-" + TK.slice(0, 7); if (!G.xpKeys[mkk]) { G.xpKeys[mkk] = 1; celebrate("Every bill paid!", "This whole month is handled. Drip is doing laps.", 50); award("month"); } }
  }, 380);
}
document.addEventListener("click", e => {
  const c = e.target.closest(".chk"); if (c) { e.stopPropagation(); togglePaid(c.closest(".row").dataset.k, c); return; }
  const r = e.target.closest(".row"); if (r) { openDetail(r.dataset.k); return; }
  const a = e.target.closest("[data-add]"); if (a) { feed(+a.dataset.add, a); return; }
  const m = e.target.closest("[data-mis]"); if (m) { const id = m.dataset.mis;
    if (id === "cal") go("cal"); else if (id === "save") { goal() ? feed(25, m) : openGoal(); } else if (id === "pay") { const k = MIS()[0].key; if (k) openDetail(k); else go("cal"); } return; }
  const t = e.target.closest("button"); if (!t) return;
  if (t.id === "mSign") openAuth(); else if (t.id === "mFresh") startFresh(); else if (t.id === "mBal") openBalance(); else if (t.id === "mAdd") openAdd(); else if (t.id === "gNew") openGoal();
});

/* ---------- savings goal ---------- */
function feed(n, el) {
  const g = goal(); if (!g) { openGoal(); return; }
  if (MODE === "sample") { needPlan(); return; }
  const tgt = +g.target || 0, before = tgt ? (+g.saved || 0) / tgt : 0;
  g.saved = Math.round(((+g.saved || 0) + n) * 100) / 100; savePlan(); buzz();
  const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top); addXP(15, r.left + r.width / 2, r.top);
  if (n === 25) doneMission("save");
  const after = tgt ? g.saved / tgt : 0;
  if (before < .5 && after >= .5) { setTimeout(() => celebrate("Halfway there!", (g.name || "Your goal") + " is 50% full. Keep the tap running.", 30), 500); award("half"); }
  if (before < 1 && after >= 1) { setTimeout(() => celebrate("Goal reached!", (g.name || "Your goal") + " is full. Time to set a bigger one.", 100), 500); award("goal"); }
  toast(money(n) + " added to " + (g.name || "your goal"), () => { g.saved = Math.round(((+g.saved || 0) - n) * 100) / 100; savePlan(); paintMotiv(); if ($("v-goals").classList.contains("on")) renderGoals(); });
  paintMotiv(); if ($("v-goals").classList.contains("on")) renderGoals();
}

/* ---------- Drip ---------- */
$("drip").onclick = () => { lineIx++; buzz(); const b = $("bubble"); b.innerHTML = dripLine(); b.style.animation = "none"; void b.offsetWidth; b.style.animation = "pop .45s cubic-bezier(.3,1.5,.5,1) both";
  $("drip").classList.add("cheer"); setTimeout(() => $("drip").classList.remove("cheer"), 800); };

/* ---------- tabs ---------- */
const order = ["today", "cal", "ins", "goals"];
function placeBlob() { const tv = document.querySelector("#tabs button.on").dataset.v, i = order.indexOf(tv), w = ($("tabs").clientWidth - 12) / 4; $("blob").style.width = w + "px"; $("blob").style.transform = `translateX(${i * w}px)`; }
function go(v) {
  buzz(); [...order, "you"].forEach(n => $("v-" + n).classList.toggle("on", n === v)); const tv = v === "you" ? "goals" : v;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.v === tv)); placeBlob();
  if (v === "cal") { renderCal(); doneMission("cal"); } if (v === "ins") renderIns(); if (v === "goals") renderGoals(); if (v === "you") renderYou(); if (v === "today") renderToday();
  try { history.replaceState(null, "", v === "today" ? location.pathname : "#" + v); } catch (e) {}
}
$("tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) go(b.dataset.v); });
const roTabs = new ResizeObserver(placeBlob); roTabs.observe($("tabs"));
$("tLow").onclick = () => { CAL.sel = iso(LOW.d); CAL.m = new Date(LOW.d.getFullYear(), LOW.d.getMonth(), 1); go("cal"); };
$("tPaid").onclick = () => go("goals");
$("streakChip").onclick = () => go("goals"); $("lvlChip").onclick = () => go("goals");
$("gearBtn").onclick = () => go("you"); $("youBack").onclick = () => go("goals");

/* ---------- calendar ---------- */
const CAL = { m: new Date(T0.getFullYear(), T0.getMonth(), 1), sel: TK };
function renderCal(dir) {
  compute(); const m = CAL.m, y = m.getFullYear(), mi = m.getMonth(); $("mName").textContent = MON[mi] + " " + y;
  const first = new Date(y, mi, 1), start = addD(first, -first.getDay());
  let h = ["S", "M", "T", "W", "T", "F", "S"].map(d => `<div class="dow">${d}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = addD(start, i), k = iso(d), e = DM.get(k), bal = d >= T0 ? balOn(k) : undefined, inM = d.getMonth() === mi;
    if (i >= 35 && !inM && d.getDay() === 0) break;
    const cls = ["day", inM ? "" : "out", bal !== undefined && bal < 0 ? "under" : bal !== undefined && bal < G.cushion ? "tight" : "", k === TK ? "today" : "", k === CAL.sel ? "sel" : ""].join(" ");
    const dots = (e ? e.items : []).slice(0, 3).map(it => `<i style="background:${k === CAL.sel ? "#fff" : kindOf({ amt: it.amt, cat: it.cat }).c}"></i>`).join("");
    h += `<button class="${cls}" data-d="${k}" ${d < T0 ? 'disabled style="opacity:.4"' : ""}>${d.getDate()}<span class="dots">${dots}</span></button>`;
  }
  $("grid").innerHTML = h;
  const gw = $("gridwrap"); gw.classList.remove("slideL", "slideR"); if (dir) { void gw.offsetWidth; gw.classList.add(dir > 0 ? "slideL" : "slideR"); }
  const sd = parseD(CAL.sel); $("dName").textContent = dlabel(sd);
  const db = balOn(CAL.sel); $("dBal").textContent = db === undefined ? "—" : money(db); $("dBal").style.color = db < 0 ? "var(--coral)" : "";
  const ev = rows(sd, sd);
  $("dList").innerHTML = ev.length ? ev.map(rowHtml).join("") : '<div class="empty">Nothing moves on this day.</div>';
}
$("grid").addEventListener("click", e => { const b = e.target.closest(".day"); if (!b || b.disabled) return; buzz(); CAL.sel = b.dataset.d; renderCal(); });
$("mPrev").onclick = () => { const n = new Date(CAL.m.getFullYear(), CAL.m.getMonth() - 1, 1); if (n < new Date(T0.getFullYear(), T0.getMonth(), 1)) return; CAL.m = n; renderCal(-1); };
$("mNext").onclick = () => { const n = new Date(CAL.m.getFullYear(), CAL.m.getMonth() + 1, 1); if (n > addD(T0, 175)) return; CAL.m = n; renderCal(1); };
let sx = null; $("gridwrap").addEventListener("pointerdown", e => sx = e.clientX);
$("gridwrap").addEventListener("pointerup", e => { if (sx !== null && Math.abs(e.clientX - sx) > 50) (e.clientX < sx ? $("mNext") : $("mPrev")).click(); sx = null; });

/* ---------- insights ---------- */
let INS = null;
function renderIns() {
  compute();
  const outs = SC.outflow.filter(it => flow(it, "out", MAIN) < 0), ins = SC.inflow.filter(it => flow(it, "in", MAIN) > 0);
  const pm = it => monthly(it, SC.start);
  let parts;
  if (!INS) { const g = {}; outs.forEach(i => { const k = i.cat || ""; g[k] = (g[k] || 0) + pm(i); });
    parts = Object.keys(g).filter(k => g[k] > 0).map(k => ({ k, n: (KIND[k] || KIND[""]).n, c: (KIND[k] || KIND[""]).c, v: g[k], cnt: outs.filter(i => (i.cat || "") === k && pm(i) > 0).length })); }
  else { const pal = ["#1479ff", "#3cc8e8", "#8a5cff", "#ff9f1a", "#18b26b", "#ff5a5f", "#0b56c9"];
    parts = outs.filter(i => (i.cat || "") === INS && pm(i) > 0).map((i, n) => ({ n: i.name || "Bill", c: pal[n % pal.length], v: pm(i), ic: iconFor(i.name, -1), f: FREQ[i.freq] || "" })); }
  parts.sort((a, b) => b.v - a.v); const total = parts.reduce((s, p) => s + p.v, 0);
  $("insTitle").textContent = INS !== null ? (KIND[INS] || KIND[""]).n : "Where it goes"; $("insBack").hidden = INS === null; $("catHead").textContent = INS !== null ? "Each item" : "By kind";
  $("dMidL").textContent = INS !== null ? (KIND[INS] || KIND[""]).n + " a month" : "Every month"; countTo($("dMid"), total);
  const C = 2 * Math.PI * 80; let off = 0;
  $("donut").innerHTML = `<circle cx="100" cy="100" r="80" stroke="var(--soft)"/>` + (total ? parts.map(p => { const len = Math.max(0, p.v / total * C - 6); const s = `<circle cx="100" cy="100" r="80" stroke="${p.c}" stroke-dasharray="0 ${C}" stroke-dashoffset="${-off}" data-len="${len}"/>`; off += p.v / total * C; return s; }).join("") : "");
  requestAnimationFrame(() => requestAnimationFrame(() => $("donut").querySelectorAll("circle[data-len]").forEach(c => c.setAttribute("stroke-dasharray", c.dataset.len + " " + C))));
  const top = parts[0];
  $("say").innerHTML = `<svg viewBox="0 0 60 72"><use href="#dripShape"/>${face("good")}</svg><span>${top ? `<b>${esc(top.n)}</b> is your biggest slice, ${Math.round(top.v / total * 100)}% of ${INS !== null ? "this group" : "what goes out"}.` : "Add some bills and I'll show you where the money goes."}</span>`;
  $("cats").innerHTML = parts.length ? parts.map(p => `<button class="cat" ${INS !== null ? "" : `data-cat="${p.k}"`}>${icon(INS !== null ? p.ic : (p.k === "need" ? "home" : p.k === "want" ? "star" : p.k === "debt" ? "card" : "swap"), p.c)}<div><div>${esc(p.n)}</div><small>${INS !== null ? p.f : p.cnt + " item" + (p.cnt === 1 ? "" : "s")}</small><div class="bar"><i style="background:${p.c}" data-w="${(p.v / total * 100).toFixed(1)}"></i></div></div><div style="text-align:right"><div class="num">${money(p.v)}</div><small>${Math.round(p.v / total * 100)}%</small></div></button>`).join("") : '<div class="empty">No bills yet.</div>';
  requestAnimationFrame(() => document.querySelectorAll("#cats .bar i").forEach(b => b.style.width = b.dataset.w + "%"));
  const tin = ins.reduce((s, i) => s + pm(i), 0), tout = SC.outflow.filter(it => flow(it, "out", MAIN) < 0 && !(it.to)).reduce((s, i) => s + pm(i), 0);
  countTo($("fIn"), tin); countTo($("fOut"), tout); countTo($("fLeft"), tin - tout); $("fLeft").style.color = tin - tout < 0 ? "var(--coral)" : "";
}
$("cats").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (b) { buzz(); INS = b.dataset.cat; renderIns(); } });
$("insBack").onclick = () => { INS = null; renderIns(); };

/* ---------- goals tab ---------- */
function renderGoals() {
  const L = lvl(G.xp), s = streak();
  $("lvlCard").innerHTML = `<svg class="big" viewBox="0 0 60 72"><use href="#dripShape"/>${face("good")}</svg><div><small>Level ${L.n}</small><b>${L.name}</b><div class="xpbar"><i data-w="${(L.cur / L.need * 100).toFixed(1)}"></i></div><small><span class="num">${G.xp}</span> XP · ${L.left} to ${LN[L.i + 1] || "the next level"}</small></div>`;
  $("wkTitle").textContent = s === 1 ? "1-day streak" : s + "-day streak";
  const dn = ["S", "M", "T", "W", "T", "F", "S"], set = new Set(G.days); let w = "";
  for (let i = 6; i >= 0; i--) { const d = addD(T0, -i), on = set.has(iso(d)); w += `<div>${dn[d.getDay()]}<span class="${on ? "on" : ""}">${on ? flame : ""}</span></div>`; }
  $("week").innerHTML = w;
  $("goalCard2").innerHTML = goalHtml();
  const f = debtFacts(), now = f.total;
  if (now > 0) { if (!G.debtStart || now > G.debtStart) { G.debtStart = now; saveG(); }
    const dp = G.debtStart ? (G.debtStart - now) / G.debtStart : 0; if (G.debtStart - now >= 1000) award("debt");
    $("debtCard").hidden = false;
    $("debtCard").innerHTML = `<div class="chead"><div><b>Debt-free journey</b><br><small>${dp > 0 ? money(G.debtStart - now) + " paid off since you started" : "Lower your balances in the full app and watch this bar move"}</small></div><span class="xp">${Math.round(dp * 100)}%</span></div><div class="goalbar"><i data-w="${(dp * 100).toFixed(1)}" style="background:linear-gradient(90deg,#8a5cff,#b49bff)"></i></div><div class="goalnums"><span><b class="num">${money(now)}</b> left</span><span>${f.list.length} debt${f.list.length === 1 ? "" : "s"}</span></div>`;
  } else $("debtCard").hidden = true;
  $("bdCount").textContent = G.seen.length + " of " + BADGES.length;
  $("badges").innerHTML = BADGES.map(b => { const got = G.seen.includes(b.id); return `<div class="badge${got ? "" : " lock"}"><div class="med" style="background:${b.c}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${got ? b.i : '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>'}</svg></div><b>${b.n}</b>${got ? "Earned" : "Locked"}</div>`; }).join("");
  animBars();
}

/* ---------- settings ---------- */
let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; renderYou(); });
function renderYou() {
  $("bVal").textContent = money(BAL); $("cVal").textContent = money(G.cushion);
  document.querySelectorAll("#themeSeg button").forEach(b => b.classList.toggle("on", b.dataset.t === (G.theme || "")));
  $("acctBox").innerHTML = user
    ? `<div class="set"><span>Signed in<br><small style="color:var(--mute)">${esc(user.email || "")}</small></span><button class="link" id="outBtn">Sign out</button></div>`
    : `<div class="set"><span>${MODE === "local" ? "Saved on this phone only" : "Not signed in"}</span><button class="link" id="inBtn">Sign in</button></div>`;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  $("installRow").hidden = standalone || (!installEvt && !ios);
  $("installNote").textContent = standalone ? "" : ios ? "On iPhone: tap the Share button in Safari, then Add to Home Screen." : installEvt ? "" : "In Chrome, open the menu and choose Install app or Add to Home screen.";
}
$("acctBox").addEventListener("click", async e => { const b = e.target.closest("button"); if (!b) return;
  if (b.id === "inBtn") openAuth();
  if (b.id === "outBtn" && sb) { await sb.auth.signOut(); user = null; store.set(SKEY, "null"); await loadPlan(); renderAll(); toast("Signed out"); } });
$("installBtn").onclick = async () => { if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; renderYou(); } else renderYou(); };
$("themeSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; buzz(); G.theme = b.dataset.t; saveG(); setTheme(G.theme); renderYou(); renderToday(); });
const nudge = d => { G.cushion = Math.max(0, G.cushion + d); saveG(); renderYou(); };
$("cMinus").onclick = () => nudge(-50); $("cPlus").onclick = () => nudge(50);
$("balRow").onclick = () => openBalance();
$("resetG").onclick = () => { const old = JSON.stringify(G); const keep = { cushion: G.cushion, theme: G.theme, paid: G.paid }; G = Object.assign(G0(), keep); saveG(); renderYou(); paintChips();
  toast("Streak, XP and badges reset", () => { G = JSON.parse(old); saveG(); renderYou(); paintChips(); }); };

/* ---------- sheets ---------- */
let lastFocus = null;
function openSheet(html) { lastFocus = document.activeElement; $("sheetBody").innerHTML = html; $("veil").classList.add("on"); $("sheet").classList.add("on"); $("sheet").style.transform = ""; buzz();
  setTimeout(() => { const f = $("sheet").querySelector("input,button:not(.chk)"); f && f.focus({ preventScroll: true }); }, 420); }
function closeSheet() { $("veil").classList.remove("on"); $("sheet").classList.remove("on"); $("sheet").style.transform = ""; lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true }); }
$("veil").onclick = closeSheet; document.addEventListener("keydown", e => { if (e.key === "Escape") { closeSheet(); $("cele").classList.remove("on"); } });
let dy0 = null;
$("grab").addEventListener("pointerdown", e => { dy0 = e.clientY; $("sheet").classList.add("drag"); $("grab").setPointerCapture(e.pointerId); });
$("grab").addEventListener("pointermove", e => { if (dy0 === null) return; $("sheet").style.transform = `translateY(${Math.max(0, e.clientY - dy0)}px)`; });
$("grab").addEventListener("pointerup", e => { if (dy0 === null) return; const d = e.clientY - dy0; dy0 = null; $("sheet").classList.remove("drag"); if (d > 110) closeSheet(); else $("sheet").style.transform = ""; });

function needPlan() {
  openSheet(`<div class="dhead"><svg viewBox="0 0 60 72" style="width:64px;height:78px"><use href="#dripShape"/>${face("good")}</svg><h3>These are sample numbers</h3><small>Sign in to use your Waterline plan, or start a fresh one on this phone.</small></div>
  <button class="btn" id="npSign">Sign in</button><button class="btn ghost" id="npFresh">Start my own</button>`);
  $("npSign").onclick = () => openAuth(); $("npFresh").onclick = () => { closeSheet(); startFresh(); };
}
function startFresh() {
  const local = tidy(readJSON(KEY));
  use(local && worthKeeping(local) ? local : emptyDoc(), user ? "cloud" : "local"); savePlan(); renderAll(); openBalance();
}

function padHtml() { return `<div class="pad" id="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0, "⌫"].map(k => `<button data-k="${k}" aria-label="${k === "⌫" ? "Delete digit" : k}">${k}</button>`).join("")}</div>`; }
function bindPad(state, show) {
  $("pad").onclick = e => { const b = e.target.closest("button"); if (!b) return; buzz(); const k = b.dataset.k;
    if (k === "⌫") state.amt = state.amt.slice(0, -1);
    else if (k === ".") { if (!state.amt.includes(".")) state.amt = (state.amt || "0") + "."; }
    else { if (state.amt.includes(".") && state.amt.split(".")[1].length >= 2) return; if (state.amt.replace(".", "").length >= 8) return; state.amt = state.amt === "0" ? k : state.amt + k; }
    show(); };
}
const shake = el => { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); };

function openDetail(key) {
  const r = findRow(key); if (!r) return; const src = source(r), k = kindOf(r), p = !!G.paid[key], inc = r.amt > 0;
  const n = Math.round((r.d - T0) / 864e5), when = n <= 0 ? "Due today" : n === 1 ? "Due tomorrow" : "Due in " + n + " days";
  const after = balOn(r.k), it = src && src.it;
  const per = it && src.list !== "oneoffs" ? monthly(it, SC.start) : 0;
  const rep = it ? (src.list === "oneoffs" ? "Once" : FREQ[it.freq] || "") : r.freq === "plan" ? "Debt plan" : r.freq === "loan" || r.freq === "card" ? "Loan payment" : "";
  openSheet(`<div class="dhead">${icon(iconFor(r.name, r.amt), k.c)}<h3>${esc(r.name)}</h3><div class="num" style="color:${inc ? "var(--kelp)" : ""}">${money(r.amt, true)}</div><small>${inc ? when.replace("Due", "Arrives") : when}</small></div>
  <div class="facts"><div><span>Date</span><b>${dlabel(r.d)}</b></div>${rep ? `<div><span>Repeats</span><b>${rep}</b></div>` : ""}<div><span>Kind</span><b>${k.n}</b></div>${per ? `<div><span>Per month</span><b class="num">${money(per)}</b></div>` : ""}<div><span>Balance after that day</span><b class="num" style="color:${after < 0 ? "var(--coral)" : ""}">${after === undefined ? "—" : money(after)}</b></div></div>
  <button class="btn ${p ? "ghost" : "green"}" id="dPaid">${p ? "Mark as not " + (inc ? "received" : "paid") : "Mark as " + (inc ? "received" : "paid")}</button>
  ${src ? `<button class="btn red" id="dDel">Delete ${esc(r.name)}${src.list === "oneoffs" ? "" : " (every time)"}</button>` : `<p class="note" style="text-align:center">This payment comes from your debt or loan settings. Change it in the <a class="link" href="/">full app</a>.</p>`}`);
  $("dPaid").onclick = e => { const b = e.target.getBoundingClientRect(); closeSheet(); togglePaid(key, { getBoundingClientRect: () => b }); };
  if (src) $("dDel").onclick = () => {
    if (MODE === "sample") { needPlan(); return; }
    const list = SC[src.list], idx = list.indexOf(src.it); if (idx < 0) return; list.splice(idx, 1); savePlan(); closeSheet(); renderAll();
    toast(r.name + " deleted", () => { list.splice(idx, 0, src.it); savePlan(); renderAll(); }); };
}

const ADD = {};
function openAdd() {
  if (MODE === "sample") { needPlan(); return; }
  Object.assign(ADD, { dir: "out", amt: "", freq: "monthly", when: 0, cat: "need" });
  const F = { ...FREQ, once: "Just once" };
  openSheet(`<div class="inout" id="aIO"><div class="pill"></div><button data-d="out" class="on">Money out</button><button data-d="in">Money in</button></div>
  <div class="amtshow num" id="aAmt">$0</div>${padHtml()}
  <input class="field" id="aName" placeholder="What is it? e.g. Hydro" maxlength="60" autocomplete="off" enterkeyhint="done">
  <div class="lbl">How often</div><div class="chips" id="aFreq">${Object.keys(F).map(f => `<button data-f="${f}" class="${f === "monthly" ? "on" : ""}">${F[f]}</button>`).join("")}</div>
  <div class="lbl">Next one</div><div class="chips" id="aWhen">${[[0, "Today"], [1, "Tomorrow"], [7, "In a week"], [14, "In 2 weeks"]].map(([v, l]) => `<button data-w="${v}" class="${v === 0 ? "on" : ""}">${l}</button>`).join("")}<input type="date" class="field" id="aDate" style="width:auto;min-height:40px;margin:0" aria-label="Pick a date" min="${TK}"></div>
  <div id="aCatWrap"><div class="lbl">Kind</div><div class="chips" id="aCat">${[["need", "Need"], ["want", "Want"], ["debt", "Debt payment"]].map(([k, l]) => `<button data-c="${k}" class="${k === "need" ? "on" : ""}">${l}</button>`).join("")}</div></div>
  <button class="btn" id="aSave">Add it</button>`);
  const show = () => { $("aAmt").textContent = "$" + (ADD.amt || "0"); }; bindPad(ADD, show);
  $("aIO").onclick = e => { const b = e.target.closest("button"); if (!b) return; buzz(); ADD.dir = b.dataset.d; $("aIO").classList.toggle("in", ADD.dir === "in"); $("aIO").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); $("aCatWrap").hidden = ADD.dir === "in"; };
  const pick = (id, key, attr, num) => $(id).onclick = e => { const b = e.target.closest("button"); if (!b) return; buzz(); ADD[key] = num ? +b.dataset[attr] : b.dataset[attr]; $(id).querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); if (id === "aWhen") { $("aDate").value = ""; ADD.date = ""; } };
  pick("aFreq", "freq", "f"); pick("aWhen", "when", "w", true); pick("aCat", "cat", "c");
  $("aDate").onchange = e => { ADD.date = e.target.value; $("aWhen").querySelectorAll("button").forEach(x => x.classList.remove("on")); };
  $("aSave").onclick = () => {
    const v = parseFloat(ADD.amt), nm = $("aName").value.trim();
    if (!(v > 0)) { shake($("aAmt")); return; }
    const start = ADD.date || iso(addD(T0, ADD.when)), cat = ADD.dir === "in" ? "" : ADD.cat, name = nm || (ADD.dir === "in" ? "Income" : "New bill");
    let list, it;
    if (ADD.freq === "once") { list = SC.oneoffs; it = { id: rid(), name, amount: v, date: start, dir: ADD.dir, cat }; }
    else { list = ADD.dir === "in" ? SC.inflow : SC.outflow; it = { id: rid(), name, amount: v, freq: ADD.freq, start, cat, end: "" }; }
    list.push(it); savePlan(); closeSheet(); go("today"); addXP(5);
    toast(name + " added", () => { const i = list.indexOf(it); if (i >= 0) list.splice(i, 1); savePlan(); renderAll(); });
  };
}
function openBalance() {
  if (MODE === "sample") { needPlan(); return; }
  const st = { amt: "" }, neg = { on: false };
  openSheet(`<div class="dhead"><h3>Balance today</h3><small>What's in your main account right now?</small></div>
  <div class="amtshow num" id="bAmt">$0</div>${padHtml()}
  <div class="chips"><button id="bNeg">It's overdrawn (negative)</button></div>
  <button class="btn" id="bSave">Save balance</button>`);
  const show = () => { $("bAmt").textContent = (neg.on ? "−$" : "$") + (st.amt || "0"); }; bindPad(st, show);
  $("bNeg").onclick = e => { neg.on = !neg.on; e.target.classList.toggle("on", neg.on); show(); };
  $("bSave").onclick = () => { if (st.amt === "") { shake($("bAmt")); return; } const v = (neg.on ? -1 : 1) * (parseFloat(st.amt) || 0);
    const old = { b: SC.balance, s: SC.start }; SC.balance = v; SC.start = TK; DOC.seedSet = true; savePlan(); closeSheet(); renderAll(); addXP(5);
    toast("Balance updated", () => { SC.balance = old.b; SC.start = old.s; savePlan(); renderAll(); }); };
}
function openGoal() {
  if (MODE === "sample") { needPlan(); return; }
  const st = { amt: "" };
  openSheet(`<div class="dhead"><h3>New savings goal</h3><small>What are you saving for?</small></div>
  <input class="field" id="gName" placeholder="e.g. Emergency fund" maxlength="60" autocomplete="off">
  <div class="lbl">Target</div><div class="amtshow num" id="gAmt">$0</div>${padHtml()}
  <button class="btn green" id="gSave">Start saving</button>`);
  const show = () => { $("gAmt").textContent = "$" + (st.amt || "0"); }; bindPad(st, show);
  $("gSave").onclick = () => { const v = parseFloat(st.amt); if (!(v > 0)) { shake($("gAmt")); return; }
    DOC.wealth.goals.unshift({ id: rid(), name: $("gName").value.trim() || "Savings goal", target: v, saved: 0, by: "" }); savePlan(); closeSheet();
    doneMission("save"); renderAll(); toast("Goal set. Every $25 counts."); };
}
function openAuth() {
  if (!sb) { openSheet(`<div class="dhead"><h3>Sign in</h3><small>Sign-in isn't available right now. Your plan is saved on this phone.</small></div>`); return; }
  openSheet(`<div class="dhead"><svg viewBox="0 0 60 72" style="width:58px;height:70px"><use href="#dripShape"/>${face("good")}</svg><h3>Sign in to Waterline</h3><small>Same account as wtrline.com. Your plan comes with you.</small></div>
  <button class="btn ghost" id="auG"><svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:-4px;margin-right:8px"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.2a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>Continue with Google</button>
  <div class="lbl" style="margin-top:16px">Or with email</div>
  <form id="auF"><input class="field" id="auE" type="email" placeholder="Email" autocomplete="email" required>
  <input class="field" id="auP" type="password" placeholder="Password" autocomplete="current-password">
  <button class="btn" type="submit">Sign in</button></form>
  <button class="btn red" id="auL">Email me a sign-in link instead</button>
  <p class="note" id="auMsg" style="text-align:center"></p>`);
  const msg = t => $("auMsg").textContent = t;
  $("auG").onclick = async () => { const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/lite/" } }); if (error) msg(error.message); };
  $("auF").onsubmit = async e => { e.preventDefault(); const em = $("auE").value.trim(), pw = $("auP").value;
    if (!pw) { msg("Enter your password, or use the email link below."); return; } msg("Signing in…");
    const { error } = await sb.auth.signInWithPassword({ email: em, password: pw }); if (error) msg(error.message); };
  $("auL").onclick = async () => { const em = $("auE").value.trim(); if (!em) { msg("Type your email first."); $("auE").focus(); return; }
    const { error } = await sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin + "/lite/" } }); msg(error ? error.message : "Check your email for a sign-in link."); };
}
$("fab").onclick = openAdd;

/* ---------- boot ---------- */
function renderAll() { const v = document.querySelector("#tabs button.on").dataset.v;
  if ($("v-you").classList.contains("on")) renderYou(); else if (v === "cal") renderCal(); else if (v === "ins") renderIns(); else if (v === "goals") renderGoals(); renderToday(); }
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { setTheme(G.theme); renderToday(); });
setTheme(G.theme); stars();
await loadPlan();
renderToday(true);
const h = location.hash.slice(1); if (["cal", "ins", "goals", "you"].includes(h)) go(h);
setTimeout(() => $("splash").classList.add("done"), RM ? 0 : 1250);
if (sb) sb.auth.onAuthStateChange(async (evt, sess) => {
  if (evt === "SIGNED_IN" && sess && (!user || user.id !== sess.user.id)) { user = sess.user; closeSheet(); await syncAccount(); renderAll(); toast("Signed in. Your plan is here."); }
});
document.addEventListener("visibilitychange", async () => { if (document.visibilityState === "visible" && user && MODE === "cloud") { await syncAccount(); renderAll(); } });
if ("serviceWorker" in navigator) { try { navigator.serviceWorker.register("/lite/sw.js", { scope: "/lite/" }); } catch (e) {} }
