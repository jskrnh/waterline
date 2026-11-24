/* Waterline forecast engine, shared with Waterline Lite.
   Copied verbatim from index.html (sections 5, 5b, 5c: step .. dayMap, plus runPayoff,
   requiredMonthly and debtFacts) so Lite's numbers always match the full app.
   When the engine changes in index.html, re-run the copy (see lite/README.md). */
export let doc=null, state=null, horizon=180;
export function setDoc(d,h){ doc=d; state=(d.scenarios||[]).find(x=>x.id===d.activeId)||d.scenarios[0]; if(h) horizon=h; return state; }
export const iso=d=>{const z=new Date(d.getTime()-d.getTimezoneOffset()*6e4);return z.toISOString().slice(0,10)};
export const parseD=s=>{const[a,b,c]=String(s).split("-").map(Number);return new Date(a,(b||1)-1,c||1)};
const id=()=>Math.random().toString(36).slice(2,9);
function step(d,freq,dir){
  const n=new Date(d);
  if(freq==="weekly")n.setDate(n.getDate()+7*dir);
  else if(freq==="biweekly")n.setDate(n.getDate()+14*dir);
  else if(freq==="monthly")n.setMonth(n.getMonth()+dir);
  else if(freq==="quarterly")n.setMonth(n.getMonth()+3*dir);
  else if(freq==="yearly")n.setFullYear(n.getFullYear()+dir);
  else n.setDate(n.getDate()+3650*dir);
  return n;
}
function occurrences(item,from,to){
  const out=[]; if(!item.start||!item.amount) return out;
  if(item.end){ const e=parseD(item.end); if(e<to) to=e; }   // nothing fires after the end date
  const anchor=parseD(item.start);
  const begin=anchor>from?anchor:from;
  if(item.freq==="weekly"||item.freq==="biweekly"){
    let d=new Date(anchor),i=0;
    while(d>begin&&i++<3000) d=step(d,item.freq,-1);
    i=0;
    while(d<=to&&i++<3000){ if(d>=begin) out.push(new Date(d)); d=step(d,item.freq,1); }
    return out;
  }
  const gap=item.freq==="monthly"?1:item.freq==="quarterly"?3:12;
  const day=anchor.getDate();
  const at=k=>{const y=anchor.getFullYear(),m=anchor.getMonth()+k*gap,dim=new Date(y,m+1,0).getDate();
    return new Date(y,m,Math.min(day,dim))};
  let k=Math.floor(((begin.getFullYear()*12+begin.getMonth())-(anchor.getFullYear()*12+anchor.getMonth()))/gap)-1;
  if(k<0)k=0;
  let i=0;
  while(i++<3000){ const d=at(k); if(d>to) break; if(d>=begin) out.push(d); k++; }
  return out;
}
/* Accounts. Every plan has one main account (its starting balance is sc.balance). Extra accounts
   are optional; an item belongs to the main account unless it says otherwise, and a bill with a
   "to" account is a transfer: it leaves one account and lands in the other, and isn't spending. */
const MAIN="main";
const acctOf=x=>x.acct||MAIN;
const accts=sc=>(sc||state).accounts||[];
const acctName=(a,sc)=>a===MAIN?((sc||state).mainName||"Main account"):((accts(sc).find(x=>x.id===a)||{}).name||"Account");
const isMove=it=>!!it.to&&it.to!==acctOf(it);
const flow=(it,kind,a)=>kind==="in"?(acctOf(it)===a?1:0):(acctOf(it)===a?-1:0)+(isMove(it)&&it.to===a?1:0);
function acctStart(sc,a){ if(a===MAIN) return +sc.balance||0;
  const x=accts(sc).find(y=>y.id===a); return !x?0:x.type==="card"?-(+x.balance||0):(+x.balance||0); }
/* An item whose end date is before the plan starts no longer costs anything each month. */
const ended=(it,start)=>!!it.end&&parseD(it.end)<parseD(start||(state&&state.start)||iso(new Date()));
const monthly=(it,start)=>ended(it,start)?0:({weekly:(+it.amount||0)*52/12,biweekly:(+it.amount||0)*26/12,
  monthly:+it.amount||0,quarterly:(+it.amount||0)/3,yearly:(+it.amount||0)/12}[it.freq]||0);

/* ============================================================
   5b. DEBT PLAN IN THE FORECAST
   The Debt page's payoff plan, turned into real dated payments: each month the
   plan's payment is split the way the avalanche spends it, until every debt clears.
   ============================================================ */
function payoffSchedule(debts,pay,cap){
  const list=debts.map(d=>({id:d.id,name:d.name,bal:+d.balance||0,r:(+d.apr||0)/100/12,min:+d.minimum||0}))
                  .filter(d=>d.bal>0.005).sort((a,b)=>b.r-a.r);
  if(!list.length) return null;
  if(pay<list.reduce((a,d)=>a+d.min,0)-0.005) return null;
  const months=[];
  for(let m=0;m<(cap||600);m++){
    list.forEach(d=>{ if(d.bal>0) d.bal*=(1+d.r); });
    let pool=pay; const paid=new Map();
    const give=(d,q)=>{ d.bal-=q; pool-=q; paid.set(d,(paid.get(d)||0)+q); };
    list.forEach(d=>{ if(d.bal>0) give(d,Math.min(d.min,d.bal,pool)); });
    for(const d of list){ if(pool<=0.005) break; if(d.bal>0) give(d,Math.min(pool,d.bal)); }
    months.push([...paid].filter(([,a])=>a>0.005).map(([d,a])=>({id:d.id,name:d.name||"Debt",amt:Math.round(a*100)/100})));
    if(list.every(d=>d.bal<=0.005)) return months;
  }
  return null;
}
function nextFirst(){ const t=new Date(); return iso(new Date(t.getFullYear(),t.getMonth()+1,1)); }
let planCache={key:"",val:null};
/* the plan as dated payments; force=true builds it even when it's switched off (for previews) */
const planSettings=()=>{ if(doc&&!doc.debtPlan) doc.debtPlan={on:false,start:"",replace:true}; return doc&&doc.debtPlan; };
function debtPlan(force){
  const dp=planSettings(); if(!dp||(!dp.on&&!force)) return null;
  const f=debtFacts(); if(!f.total) return null;
  const start=dp.start||nextFirst();
  const key=JSON.stringify([f.list.map(d=>[d.id,d.name,+d.balance,+d.apr,+d.minimum]),doc.payoffMonths,start,dp.replace]);
  if(planCache.key!==key){
    const pay=Math.ceil(requiredMonthly(f.list,doc.payoffMonths)*100-1e-6)/100;   // whole cents, rounded up so it still finishes on time
    const sch=payoffSchedule(f.list,pay,doc.payoffMonths+3);
    let val=null;
    if(sch&&sch.length){
      const a=parseD(start), day=a.getDate();
      const dates=sch.map((_,i)=>{ const y=a.getFullYear(), m=a.getMonth()+i, dim=new Date(y,m+1,0).getDate(); return new Date(y,m,Math.min(day,dim)); });
      val={pay,schedule:sch,dates,start:a,end:dates[dates.length-1],replace:dp.replace!==false};
    }
    planCache={key,val};
  }
  return planCache.val;
}
const pausedByPlan=(it,plan)=>!!plan&&plan.replace&&it.cat==="debt";

/* ============================================================
   5c. LOANS AND CARDS — amortization schedules
   A loan (amount, rate, term) or a card (balance, rate, monthly payment) becomes a dated
   schedule. Its payments land in the forecast, and what's still owed today counts as a debt
   on the Debt page. While the debt plan is in the forecast, the plan pays these instead.
   ============================================================ */
const LFREQ={monthly:12,biweekly:26,weekly:52};
const LFREQS=[["monthly","Monthly"],["biweekly","Bi-Weekly"],["weekly","Weekly"]];
const r2=v=>Math.round(v*100)/100;
const today0=()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; };
function loanDate(first,freq,k){                   // the k-th payment (0-based), month-end safe
  const a=parseD(first);
  if(freq!=="monthly"){ const d=new Date(a); d.setDate(d.getDate()+k*(freq==="weekly"?7:14)); return d; }
  const y=a.getFullYear(), m=a.getMonth()+k, dim=new Date(y,m+1,0).getDate();
  return new Date(y,m,Math.min(a.getDate(),dim));
}
const loanMonths=L=>Math.max(0,(+L.term||0)*(L.unit==="m"?1:12));
const loanLabel=L=>(L.name||"").trim()||(L.kind==="card"?"Credit card":"Loan");
const amCache=new Map();
function amortize(L){
  const key=JSON.stringify([L.kind,+L.amount||0,+L.apr||0,+L.term||0,L.unit,+L.payment||0,L.first,L.freq]);
  const hit=amCache.get(L.id); if(hit&&hit.key===key) return hit.val;
  const val=amortizeRaw(L); amCache.set(L.id,{key,val}); return val;
}
function amortizeRaw(L){
  const card=L.kind==="card", freq=card?"monthly":(LFREQ[L.freq]?L.freq:"monthly"), ppy=LFREQ[freq];
  const amt=+L.amount||0, r=Math.max(0,+L.apr||0)/100/ppy;
  const out={rows:[],pay:0,interest:0,paid:0,freq,ppy,err:"",end:null};
  if(amt<=0){ out.err="amount"; return out; }
  if(!L.first){ out.err="first"; return out; }
  let pay,n;
  if(card){
    pay=r2(+L.payment||0);
    if(pay<=0){ out.err="payment"; return out; }
    out.minInt=r2(amt*r);
    if(pay<=out.minInt+0.004){ out.err="low"; out.pay=pay; return out; }
    n=1200;                                         // 100 years: anything longer never really clears
  } else {
    n=Math.round(loanMonths(L)*ppy/12);
    if(n<1){ out.err="term"; return out; }
    pay=r>0?amt*r/(1-Math.pow(1+r,-n)):amt/n;
    pay=r2(pay);                                    // whole cents, as a lender quotes it; the last payment settles the rest
  }
  out.pay=pay;
  let bal=amt;
  for(let k=0;k<n&&bal>0.005;k++){
    const int=r2(bal*r);
    let p=pay;
    if(p>=bal+int-0.005||(!card&&k===n-1)) p=r2(bal+int);   // the last payment is whatever is left
    const prin=r2(p-int); bal=Math.max(0,r2(bal-prin));
    out.rows.push({n:k+1,date:loanDate(L.first,freq,k),pay:p,int,prin,bal});
    out.interest+=int; out.paid+=p;
  }
  if(bal>0.005) out.err="long";
  out.interest=r2(out.interest); out.paid=r2(out.paid);
  if(out.rows.length) out.end=out.rows[out.rows.length-1].date;
  return out;
}
/* what's still owed on a date: the balance after the last payment made by then */
function loanLeft(L,at){
  const a=amortize(L); let left=+L.amount||0;
  for(const rw of a.rows){ if(rw.date<=at) left=rw.bal; else break; }
  return left;
}
/* each loan and card as a debt, so totals, the payoff planner, Wealth and the Report include them */
function loanDebts(){
  const t=today0();
  return (doc.loans||[]).map(L=>{ const a=amortize(L);
    return{id:L.id,name:loanLabel(L),balance:r2(loanLeft(L,t)),apr:+L.apr||0,
      minimum:r2((a.pay||+L.payment||0)*(a.ppy||12)/12),loan:true}; });
}
/* the payments a scenario's forecast should carry; none while the debt plan is paying them */
const loanAcct=(L,sc)=>L.acct&&accts(sc).some(x=>x.id===L.acct&&x.type!=="card")?L.acct:MAIN;
function loanMonthly(sc){
  if(debtPlan()) return 0;
  const from=parseD(sc.start);
  return (doc.loans||[]).reduce((s,L)=>{ if(!L.fc) return s; const a=amortize(L);
    return a.end&&a.end>=from?s+a.pay*a.ppy/12:s; },0);
}

function project(sc,opt){
  sc=sc||state; opt=opt||{}; const A=opt.account||MAIN;     // every page shows the main account unless asked
  const plan=opt.plan==="none"||A!==MAIN?null:debtPlan(opt.plan==="force");
  const planRuns=opt.plan==="none"?false:!!debtPlan(opt.plan==="force");   // it pays the loans and cards too
  const from=parseD(sc.start), to=new Date(from); to.setDate(to.getDate()+horizon);
  const map=new Map();
  const push=(d,name,amt,oid,cat,freq)=>{
    const k=iso(d);
    if(!map.has(k)) map.set(k,{date:new Date(d),items:[],delta:0});
    const e=map.get(k); e.items.push({name,amt,oid,cat:cat||"",freq}); e.delta+=amt;
  };
  sc.inflow.forEach(it=>{ const k=flow(it,"in",A); if(k)
    occurrences(it,from,to).forEach(d=>push(d,it.name||"Income",k*(+it.amount||0),null,it.cat,it.freq)); });
  sc.outflow.forEach(it=>{ if(pausedByPlan(it,plan)) return;   // the plan already pays these debts
    const k=flow(it,"out",A); if(k)
    occurrences(it,from,to).forEach(d=>push(d,it.name||"Bill",k*(+it.amount||0),null,it.cat,it.freq)); });
  if(plan) plan.schedule.forEach((pays,i)=>{
    const d=plan.dates[i]; if(d<from||d>to) return;
    pays.forEach(x=>push(d,x.name,-x.amt,null,"debt","plan"));
  });
  if(!planRuns) (doc.loans||[]).forEach(L=>{ if(!L.fc||loanAcct(L,sc)!==A) return;
    amortize(L).rows.forEach(rw=>{ if(rw.date>=from&&rw.date<=to) push(rw.date,loanLabel(L),-rw.pay,null,"debt",L.kind==="card"?"card":"loan"); });
  });
  (sc.oneoffs||[]).forEach(o=>{
    if(!o.date||!o.amount||acctOf(o)!==A) return;
    const d=parseD(o.date); if(d<from||d>to) return;
    push(d,o.name||"One-off",(o.dir==="in"?1:-1)*Math.abs(+o.amount||0),o.id,o.cat);
  });
  const days=[...map.values()].sort((a,b)=>a.date-b.date);
  let bal=acctStart(sc,A);
  const series=[{date:new Date(from),bal,items:[],delta:0}];
  let low={bal,date:new Date(from)}, under=0, firstUnder=bal<0?new Date(from):null;
  days.forEach(d=>{ if(d.date<from) return; bal+=d.delta;
    series.push({date:d.date,bal,items:d.items,delta:d.delta});
    if(bal<0&&!firstUnder) firstUnder=d.date;
    if(bal<low.bal) low={bal,date:d.date}; });
  for(let i=0;i<series.length;i++){
    if(series[i].bal<0){ const nxt=i+1<series.length?series[i+1].date:to;
      under+=Math.max(0,Math.round((nxt-series[i].date)/864e5)); }
  }
  return{series,low,under,from,to,firstUnder};
}
/* every calendar day, with the balance carried through quiet days */
function dayMap(p){
  const moves=new Map();
  p.series.forEach(s=>{ if(s.items.length) moves.set(iso(s.date),s); });
  const out=new Map();
  let bal=p.series[0].bal;
  const d=new Date(p.from);
  while(d<=p.to){
    const k=iso(d), m=moves.get(k);
    if(m) bal=m.bal;
    out.set(k,{bal,delta:m?m.delta:0,items:m?m.items:[]});
    d.setDate(d.getDate()+1);
  }
  return out;
}

function runPayoff(debts,pay,cap){
  cap=cap||600;
  const list=debts.map(d=>({id:d.id,name:d.name,bal:+d.balance||0,r:(+d.apr||0)/100/12,min:+d.minimum||0,cleared:false}))
                  .filter(d=>d.bal>0.005);
  if(!list.length) return{months:0,paid:0,interest:0,order:[]};
  list.sort((a,b)=>b.r-a.r);
  const start=list.reduce((s,d)=>s+d.bal,0);
  const totalMin=list.reduce((s,d)=>s+d.min,0);
  if(pay<totalMin-0.005) return null;
  let m=0,paid=0; const order=[];
  while(m<cap){
    list.forEach(d=>{ if(d.bal>0) d.bal*=(1+d.r); });
    let pool=pay;
    list.forEach(d=>{ if(d.bal<=0) return;
      const q=Math.min(d.min,d.bal,pool); d.bal-=q; pool-=q; paid+=q; });
    for(let i=0;i<list.length&&pool>0.005;i++){
      if(list[i].bal<=0) continue;
      const q=Math.min(pool,list[i].bal); list[i].bal-=q; pool-=q; paid+=q;
    }
    m++;
    list.forEach(d=>{ if(d.bal<=0.005&&!d.cleared){ d.cleared=true; order.push({id:d.id,name:d.name,month:m}); } });
    if(list.every(d=>d.bal<=0.005)) return{months:m,paid,interest:paid-start,order};
  }
  return null;
}
function requiredMonthly(debts,target){
  const total=debts.reduce((s,d)=>s+(+d.balance||0),0);
  if(total<=0) return 0;
  let lo=0,hi=total*1.6+500;
  for(let i=0;i<64;i++){
    const mid=(lo+hi)/2, r=runPayoff(debts,mid,target+1);
    if(r&&r.months<=target) hi=mid; else lo=mid;
  }
  return hi;
}
function debtFacts(){
  const d=[...doc.debts,...loanDebts()].filter(x=>(+x.balance||0)>0);
  const total=d.reduce((s,x)=>s+(+x.balance||0),0);
  const monthInt=d.reduce((s,x)=>s+(+x.balance||0)*(+x.apr||0)/100/12,0);
  const mins=d.reduce((s,x)=>s+(+x.minimum||0),0);
  const blended=total>0?d.reduce((s,x)=>s+(+x.balance||0)*(+x.apr||0),0)/total:0;
  return{list:d,total,monthInt,mins,blended};
}
/* copied from index.html: the plan fingerprint the sync uses */
function fingerprint(d){
  if(!d||!Array.isArray(d.scenarios)) return "";
  const ac=x=>x.acct||x.to?[x.acct||"",x.to||""]:[];
  const slim=sc=>({n:sc.name,b:+sc.balance||0,s:sc.start,
    i:(sc.inflow||[]).map(x=>[x.name||"",+x.amount||0,x.freq,x.start,x.cat||"",x.end||"",...ac(x)]),
    o:(sc.outflow||[]).map(x=>[x.name||"",+x.amount||0,x.freq,x.start,x.cat||"",x.end||"",...ac(x)]),
    a:(sc.accounts||[]).length?sc.accounts.map(a=>[a.name||"",a.type,+a.balance||0,+a.limit||0]):undefined,
    m:sc.mainName||undefined,
    f:(sc.oneoffs||[]).map(x=>[x.name||"",+x.amount||0,x.date,x.dir,x.cat||""])});
  return JSON.stringify({sc:d.scenarios.map(slim),
    dt:(d.debts||[]).map(x=>[x.name||"",+x.balance||0,+x.apr||0,+x.minimum||0]),
    ln:(d.loans||[]).length?d.loans.map(L=>[L.kind,L.name||"",+L.amount||0,+L.apr||0,+L.term||0,L.unit||"",
      +L.payment||0,L.first||"",L.freq||"",L.acct||"",!!L.fc]):undefined,
    dp:d.debtPlan?[!!d.debtPlan.on,d.debtPlan.start||"",d.debtPlan.replace!==false]:null,
    sp:d.split,pm:d.payoffMonths,
    w:d.wealth?[d.wealth.assets,d.wealth.liabs,d.wealth.goals,d.wealth.proj,d.wealth.history]:null});
}
export{fingerprint,step,occurrences,MAIN,acctOf,flow,monthly,ended,project,dayMap,debtFacts,debtPlan,amortize,loanDebts};
