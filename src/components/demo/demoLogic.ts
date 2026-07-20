/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * RentYourTime interactive demo logic — a faithful port of the imperative
 * script from the legacy app.html. It drives the DOM directly (the React
 * component renders the static markup once and never re-renders), so queries
 * are scoped to the mounted root and every listener/interval is torn down on
 * unmount via the returned cleanup function.
 */
export function initDemo(root: HTMLElement): () => void {
  const controller = new AbortController();
  const signal = controller.signal;
  const intervals: ReturnType<typeof setInterval>[] = [];
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  const every = (fn: () => void, ms: number) => {
    const id = setInterval(fn, ms);
    intervals.push(id);
    return id;
  };
  const after = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeouts.push(id);
    return id;
  };

  const $ = (s: string): any => root.querySelector(s);
  const $$ = (s: string): any[] => Array.prototype.slice.call(root.querySelectorAll(s));
  const byId = (id: string): any => root.querySelector("#" + id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================= state ================= */
  const DEF = {
    allowanceMin: 180,
    rate: 0.15,
    usedSec: 3 * 3600 + 18 * 60 + 44,
    monthRent: 28.35,
    avoided: 84,
    streak: 12,
    daysDone: 19,
    dayStates: ["g", "g", "r", "g", "R", "r", "g", "g", "G", "g", "r", "g", "g", "rr", "g", "g", "g", "r", "g"],
    ledger: [] as { date: string; time: string; rent: number }[],
    week: [145, 197, 241, 115, 158, 216],
    chalDone: 5,
    pro: false,
    realPay: false,
  };
  const S: any = (() => {
    try {
      const s = JSON.parse(localStorage.getItem("ryt-demo") || "null");
      if (s && typeof s.usedSec === "number") return s;
    } catch {}
    return JSON.parse(JSON.stringify(DEF));
  })();
  S.focus = false;
  let speed = 1;
  const persist = () => {
    try {
      localStorage.setItem("ryt-demo", JSON.stringify(S));
    } catch {}
  };

  const usedMin = () => Math.floor(S.usedSec / 60);
  const overMin = () => Math.max(0, usedMin() - S.allowanceMin);
  const rentToday = () => overMin() * S.rate;
  const fmtHM = (sec: number) => {
    const m = Math.floor(sec / 60);
    return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  };
  const fmtHm2 = (min: number) => Math.floor(min / 60) + "h " + String(min % 60).padStart(2, "0") + "m";
  const fmt$ = (n: number) => "$" + n.toFixed(2);
  const simDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + (S.daysDone - 19));
    return d;
  };

  /* ================= navigation ================= */
  function go(id: string) {
    $$(".screen").forEach((s: any) => s.classList.remove("active", "enter"));
    const el = byId(id);
    el.classList.add("active", "enter");
    if (id === "s-app") {
      grow($("#weekBars"));
      render();
    }
  }
  $$("[data-go]").forEach((b: any) => {
    b.addEventListener(
      "click",
      () => {
        if (b.dataset.go === "s-app") localStorage.setItem("ryt-onboarded", "1");
        go(b.dataset.go);
      },
      { signal }
    );
  });

  // Runs immediately (the component is already mounted).
  go("s-splash");
  after(() => {
    go(localStorage.getItem("ryt-onboarded") === "1" ? "s-app" : "s-welcome");
  }, reduceMotion ? 600 : 1900);

  $("#btnConnectST").addEventListener("click", () => $("#dimST").classList.add("show"), { signal });
  $("#stAllow").addEventListener(
    "click",
    () => {
      $("#dimST").classList.remove("show");
      go("s-perm2");
    },
    { signal }
  );
  $("#stDeny").addEventListener(
    "click",
    () => {
      $("#dimST").classList.remove("show");
      toast("The meter can't run without Screen Time");
    },
    { signal }
  );

  $$(".tab").forEach((t: any) => {
    t.addEventListener(
      "click",
      () => {
        $$(".tab").forEach((x: any) => x.classList.remove("on"));
        t.classList.add("on");
        $$(".view").forEach((v: any) => v.classList.remove("active", "enter"));
        const v = byId(t.dataset.view);
        v.classList.add("active", "enter");
        v.scrollTop = 0;
        if (t.dataset.view === "v-today") grow($("#weekBars"));
        if (t.dataset.view === "v-insights") grow($("#insBars"));
      },
      { signal }
    );
  });
  function grow(el: any) {
    if (!el) return;
    el.classList.remove("grown");
    void el.offsetWidth;
    requestAnimationFrame(() => el.classList.add("grown"));
  }

  /* ================= live meter + demo clock ================= */
  let lastRentText = "";
  let billOpen = false;
  every(() => {
    if (!S.focus && !billOpen) {
      const before = S.usedSec;
      S.usedSec += speed;
      checkThresholds(before, S.usedSec);
    }
    render();
  }, 1000);

  function checkThresholds(before: number, afterVal: number) {
    const allow = S.allowanceMin * 60;
    const rBefore = allow - before,
      rAfter = allow - afterVal;
    if (rBefore > 2700 && rAfter <= 2700)
      banner("45 minutes free left", "Still on the house. Spend them somewhere good.");
    if (rBefore > 0 && rAfter <= 0)
      banner("The meter just started", "You're past " + S.allowanceMin / 60 + " hours. Every minute is now $" + S.rate.toFixed(2) + ".");
  }

  function render() {
    const over = overMin(),
      rent = rentToday();
    const used = S.usedSec,
      allow = S.allowanceMin * 60;
    const ring = $("#ring");
    // Apple-style activity ring: green = free time used, red = overage.
    const RING_R = 92;
    const RING_C = 2 * Math.PI * RING_R;
    let greenFrac: number, redFrac: number;
    if (used <= allow) {
      greenFrac = allow ? used / allow : 0;
      redFrac = 0;
    } else {
      greenFrac = allow / used;
      redFrac = 1 - greenFrac;
    }
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
    const greenLen = clamp01(greenFrac) * RING_C;
    const redLen = clamp01(redFrac) * RING_C;
    // Small gap so the two rounded caps read as a clean divide, not a smear.
    const gap = redLen > 0 ? Math.min(6, redLen, greenLen) : 0;
    const greenEl = $("#ringGreen"),
      redEl = $("#ringRed");
    greenEl.style.strokeDasharray = greenLen + " " + RING_C;
    redEl.style.strokeDasharray = Math.max(0, redLen - gap) + " " + RING_C;
    redEl.style.strokeDashoffset = String(-(greenLen + gap));
    ring.classList.toggle("over", redFrac > 0);
    ring.classList.toggle("paused", !!S.focus);
    $("#ringTime").textContent = fmtHM(used);
    const sub = $("#ringSub");
    if (S.focus) {
      sub.textContent = "meter paused";
      sub.className = "sub free";
    } else if (over > 0) {
      sub.textContent = over + "m over";
      sub.className = "sub";
    } else {
      sub.textContent = fmtHM(allow - used) + " free left";
      sub.className = "sub free";
    }
    const rt = fmt$(rent);
    const odom = $("#rentToday .odom");
    if (rt !== lastRentText) {
      odom.textContent = rt;
      odom.classList.remove("flip");
      void odom.offsetWidth;
      odom.classList.add("flip");
      lastRentText = rt;
    }
    $("#rentToday").className = "big tnum" + (rent === 0 ? " free" : "");
    $("#rentMonth").textContent = fmt$(S.monthRent + rent);
    $("#moRent").textContent = fmt$(S.monthRent + rent);
    const d = simDate();
    const stmt = "STATEMENT · " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase().replace(",", "");
    $$(".js-stmtDate").forEach((e: any) => (e.textContent = stmt));
    $$(".js-stmtNo").forEach((e: any) => (e.textContent = "#" + String(122 + S.daysDone).padStart(4, "0")));
    $$(".js-lnAllow").forEach((e: any) => (e.textContent = (used >= allow ? fmtHm2(S.allowanceMin) : fmtHm2(usedMin())) + " · $0.00"));
    $$(".js-lnExtra").forEach((e: any) => (e.textContent = over + "m × $" + S.rate.toFixed(2)));
    $$(".js-lnTotal").forEach((e: any) => (e.textContent = rt));
    $("#whereTitle").textContent = over > 0 ? "Where the " + over + " minutes went" : "Nothing over yet";
    const tik = Math.round((over * 2) / 3),
      ins = Math.round((over * 5) / 18),
      x = Math.max(0, over - tik - ins);
    const mx = Math.max(tik, 1);
    $("#wTik").style.width = (tik / mx) * 70 + "%";
    $("#wTikM").textContent = tik + "m";
    $("#wIns").style.width = (ins / mx) * 70 + "%";
    $("#wInsM").textContent = ins + "m";
    $("#wX").style.width = (x / mx) * 70 + "%";
    $("#wXM").textContent = x + "m";
    $("#todayDate").textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    $$(".js-streak").forEach((e: any) => (e.textContent = S.streak));
    $("#tileAvoided").textContent = "$" + Math.round(S.avoided);
    $("#moAvoided").textContent = fmt$(S.avoided);
    $("#moFreeDays").textContent = S.dayStates.filter((x: string) => x[0] === "g" || x[0] === "G").length + " free days";
    $("#dayCount").textContent = Math.min(31, S.daysDone + 1) + " of 31 days";
    const dayN = Math.min(31, S.daysDone + 1);
    const proj = ((S.monthRent + rent) / dayN) * 31;
    $("#projVal").textContent = "~$" + Math.round(proj);
    renderWeek();
    const toNext = Math.max(0, 14 - S.streak);
    $("#streakNext").textContent = toNext > 0 ? toNext + " day" + (toNext === 1 ? "" : "s") + ' to "Two Weeks Clean"' : '"Two Weeks Clean" unlocked';
    const pips = $("#pips");
    if (pips.childElementCount !== 7) pips.innerHTML = "<i></i><i></i><i></i><i></i><i></i><i></i><i></i>";
    Array.prototype.forEach.call(pips.children, (p: any, i: number) => {
      p.className = i < (S.streak % 7 === 0 && S.streak > 0 ? 7 : S.streak % 7) ? "on" : "";
    });
    $("#chalSub").textContent = "Every day under 3h · " + S.chalDone + "/7 done";
    $("#chalVal").textContent = S.chalDone + "/7";
    $("#chalRing").style.background = "conic-gradient(var(--signal) 0 " + (S.chalDone / 7) * 100 + "%,rgba(255,255,255,.1) 0)";
    renderCal();
    renderLedger();
  }

  const weekEl = $("#weekBars");
  let weekBuilt = false;
  function weekBar(min: number, isToday: boolean) {
    const h = Math.max(6, Math.min(100, (min / 240) * 100));
    let bg: string;
    if (min <= S.allowanceMin) bg = "var(--signal)";
    else {
      let cap = ((S.allowanceMin / Math.max(min, 240)) * 100) / (h / 100);
      cap = Math.min(96, ((S.allowanceMin / 240) * 100) / h * 100);
      bg = "linear-gradient(to top,rgba(255,255,255," + (isToday ? ".24" : ".16") + ") " + cap + "%,var(--rent) " + cap + "%)";
    }
    return { h, bg };
  }
  function renderWeek() {
    const mins = S.week.concat([usedMin()]);
    if (!weekBuilt) {
      weekEl.innerHTML = "";
      mins.forEach((_: number, i: number) => {
        const b = document.createElement("i");
        b.style.transitionDelay = i * 55 + "ms";
        weekEl.appendChild(b);
      });
      weekBuilt = true;
    }
    Array.prototype.forEach.call(weekEl.children, (b: any, i: number) => {
      const d = weekBar(mins[i], i === 6);
      b.style.height = d.h + "%";
      b.style.background = d.bg;
      if (i === 6) {
        b.style.outline = "1.5px solid rgba(255,255,255,.35)";
        b.style.outlineOffset = "2px";
      }
    });
    const avg = Math.round(mins.reduce((a: number, b: number) => a + b, 0) / 7);
    $("#weekAvg").textContent = "avg " + fmtHm2(avg);
  }

  const calColors: Record<string, string> = {
    g: "rgba(0,230,118,.55)",
    G: "rgba(0,230,118,.3)",
    r: "rgba(255,59,48,.35)",
    R: "rgba(255,59,48,.7)",
    rr: "rgba(255,59,48,.5)",
  };
  function renderCal() {
    const cal = $("#cal");
    cal.innerHTML = "";
    for (let d = 1; d <= 31; d++) {
      const i = document.createElement("i");
      if (d <= S.dayStates.length) i.style.background = calColors[S.dayStates[d - 1]] || calColors.g;
      else if (d === S.daysDone + 1) {
        i.style.background = "rgba(255,255,255,.25)";
        i.style.outline = "1.5px solid rgba(255,255,255,.4)";
        i.style.outlineOffset = "1px";
      } else i.style.background = "rgba(255,255,255,.05)";
      cal.appendChild(i);
    }
  }
  function renderLedger() {
    const el = $("#ledger");
    if (!S.ledger.length) {
      el.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,.4)">Close a day (DEMO → End day) and it will be filed here.</div>';
      return;
    }
    el.innerHTML = "";
    S.ledger
      .slice()
      .reverse()
      .forEach((e: any) => {
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = "<span></span><b class='tnum'></b>";
        (row.firstChild as any).textContent = e.date + " · " + e.time;
        const b = row.querySelector("b")!;
        b.textContent = fmt$(e.rent);
        if (e.rent === 0) b.classList.add("g");
        el.appendChild(row);
      });
  }

  /* ================= focus ================= */
  $("#btnFocus").addEventListener("click", toggleFocus, { signal });
  $("#ring").addEventListener("click", toggleFocus, { signal });
  let focusStart = 0;
  function toggleFocus() {
    S.focus = !S.focus;
    $("#btnFocus").textContent = S.focus ? "End Focus" : "Start Focus";
    $("#btnFocus").classList.toggle("ghost", S.focus);
    $("#btnFocus").classList.toggle("green", !S.focus);
    if (S.focus) {
      focusStart = Date.now();
      toast("Meter paused — focus session running");
    } else {
      const m = Math.max(1, Math.round(((Date.now() - focusStart) / 60000) * speed));
      toast("Focus done — you kept " + m + " minute" + (m === 1 ? "" : "s") + " off the meter");
    }
    render();
  }
  $("#btnGoal").addEventListener(
    "click",
    () => {
      if (S.pro) toast("Goals — coming to Pro soon");
      else openPro();
    },
    { signal }
  );

  /* ================= demo controls ================= */
  function setSpeed(x: number) {
    speed = x;
    $("#sp1").classList.toggle("on", x === 1);
    $("#sp60").classList.toggle("on", x === 60);
    toast(x === 1 ? "Real time" : "Fast-forward: 1 minute per second");
  }
  $("#sp1").addEventListener("click", () => setSpeed(1), { signal });
  $("#sp60").addEventListener("click", () => setSpeed(60), { signal });
  $("#dAdd").addEventListener(
    "click",
    () => {
      const before = S.usedSec;
      S.usedSec += 1800;
      checkThresholds(before, S.usedSec);
      persist();
      render();
      toast("+30 minutes of screen time");
    },
    { signal }
  );
  $("#dEnd").addEventListener("click", openBill, { signal });
  $("#dReset").addEventListener(
    "click",
    () => {
      confirmModal("Reset the demo?", "Everything goes back to the starting state, including onboarding.", "Reset", () => {
        try {
          localStorage.removeItem("ryt-demo");
          localStorage.removeItem("ryt-onboarded");
        } catch {}
        location.reload();
      });
    },
    { signal }
  );
  $("#btnEndDay").addEventListener("click", openBill, { signal });

  /* ================= bill ceremony ================= */
  function openBill() {
    S.focus = false;
    billOpen = true;
    render();
    const rent = rentToday();
    const st = $("#billStamp");
    st.textContent = rent > 0 ? "RENT DUE" : "ON THE HOUSE";
    st.className = "stamp " + (rent > 0 ? "paid" : "free");
    $("#billFine").textContent = rent > 0 ? "Virtual bill. Nothing is charged. It's about knowing the price." : "A free day. The landlord tips his hat.";
    $("#dimBill").classList.add("show");
    $("#billWrap").classList.add("show");
    after(() => st.classList.add("show"), reduceMotion ? 0 : 550);
  }
  $("#btnNoted").addEventListener(
    "click",
    () => {
      const rent = rentToday(),
        um = usedMin();
      const d = simDate();
      S.monthRent += rent;
      S.ledger.push({
        date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        time: fmtHm2(um),
        rent,
      });
      if (S.dayStates.length < 31) S.dayStates.push(rent > 0 ? "rr" : "g");
      const wasUnder = rent === 0;
      if (wasUnder) {
        S.streak++;
        S.avoided += Math.max(0, S.allowanceMin - um) * S.rate;
        S.chalDone = Math.min(7, S.chalDone + 1);
      } else {
        S.streak = 0;
        S.chalDone = 0;
      }
      S.daysDone = Math.min(31, S.daysDone + 1);
      S.week.shift();
      S.week.push(um);
      S.usedSec = 0;
      lastRentText = "";
      persist();
      billOpen = false;
      $("#billStamp").classList.remove("show");
      $("#dimBill").classList.remove("show");
      $("#billWrap").classList.remove("show");
      render();
      grow($("#weekBars"));
      if (wasUnder && S.streak === 14) unlockTwoWeeks();
      after(() => {
        banner(
          wasUnder ? "You avoided paying " + fmt$(Math.max(0, S.allowanceMin - um) * S.rate) + " today" : "Rent settled: " + fmt$(rent),
          "New day — 3 free hours on the house."
        );
      }, reduceMotion ? 50 : 500);
    },
    { signal }
  );
  function unlockTwoWeeks() {
    const b = $("#badgeTwoWeeks");
    b.classList.remove("locked");
    b.classList.add("unlocking");
    b.querySelector(".s").textContent = "14-day streak";
    toast("Achievement unlocked: Two Weeks Clean");
  }

  /* ================= insights ================= */
  const insDatasets: Record<string, any> = {
    W: { avg: "2h 51m", delta: "▼ 24m vs last week", best: "Thu · 1h 26m", worst: "Wed · 4h 02m", bars: [145, 197, 241, 115, 158, 216, 230] },
    M: { avg: "3h 04m", delta: "▼ 38% vs June", best: "Jul 9 · 0h 58m", worst: "Jul 5 · 4h 40m", bars: [188, 154, 244, 126, 212, 144, 226] },
    "6M": { avg: "3h 42m", delta: "▼ 51m vs winter", best: "July · 3h 04m", worst: "Feb · 4h 31m", bars: [232, 244, 212, 194, 168, 150, 140] },
    Y: { avg: "3h 58m", delta: "first year on the meter", best: "July · 3h 04m", worst: "Dec · 4h 55m", bars: [218, 242, 204, 184, 222, 160, 140] },
  };
  function setPeriod(p: string) {
    const d = insDatasets[p];
    $("#avgVal").textContent = d.avg;
    $("#avgDelta").textContent = d.delta;
    $("#bestDay").textContent = d.best;
    $("#worstDay").textContent = d.worst;
    const el = $("#insBars");
    el.innerHTML = "";
    d.bars.forEach((min: number, i: number) => {
      const b = document.createElement("i");
      const w = weekBar(min, false);
      b.style.height = w.h + "%";
      b.style.background = w.bg;
      b.style.transitionDelay = i * 55 + "ms";
      el.appendChild(b);
    });
    const line = document.createElement("span");
    line.className = "free-line";
    line.style.top = 100 - (S.allowanceMin / 240) * 100 + "%";
    el.appendChild(line);
    grow(el);
  }
  $$("#periodChips .chip").forEach((c: any) => {
    c.addEventListener(
      "click",
      () => {
        $$("#periodChips .chip").forEach((x: any) => x.classList.remove("on"));
        c.classList.add("on");
        setPeriod(c.dataset.p);
      },
      { signal }
    );
  });
  setPeriod("W");

  const hourHeat = [
    "rgba(0,230,118,.2)",
    "rgba(0,230,118,.15)",
    "rgba(255,255,255,.05)",
    "rgba(255,255,255,.05)",
    "rgba(0,230,118,.25)",
    "rgba(0,230,118,.35)",
    "rgba(0,230,118,.3)",
    "rgba(0,230,118,.45)",
    "rgba(255,59,48,.4)",
    "rgba(255,59,48,.7)",
    "rgba(255,59,48,.9)",
    "rgba(255,59,48,.55)",
  ];
  hourHeat.forEach((c) => {
    const i = document.createElement("i");
    i.style.background = c;
    $("#hours").appendChild(i);
  });

  const apps = [
    { n: "TikTok", cat: "video", time: "1h 24m", rent: "$1.90", w: 84, over: 76 },
    { n: "Instagram", cat: "social", time: "52m", rent: "$0.80", w: 52 },
    { n: "YouTube", cat: "video", time: "38m", w: 38 },
    { n: "Reddit", cat: "social", time: "16m", w: 16 },
    { n: "Clash Royale", cat: "games", time: "11m", w: 11 },
    { n: "Messages", cat: "free", time: "8m", free: true, w: 8 },
  ] as any[];
  function renderApps(cat: string) {
    const el = $("#usageList");
    el.innerHTML = "";
    apps
      .filter((a) => cat === "all" || a.cat === cat)
      .forEach((a) => {
        const row = document.createElement("div");
        row.className = "u-row";
        let fill: string;
        if (a.free) fill = "var(--signal)";
        else if (a.over) fill = "linear-gradient(to right,rgba(255,255,255,.35) " + a.over + "%,var(--rent) " + a.over + "%)";
        else fill = "rgba(255,255,255,.35)";
        row.innerHTML = '<div class="u-head"><b></b><span class="tnum"></span></div><div class="track"><i></i></div>';
        row.querySelector("b")!.textContent = a.n;
        const sp = row.querySelector("span")!;
        sp.textContent = a.time + (a.free ? " · free" : "");
        if (a.rent) {
          sp.innerHTML = "";
          sp.append(a.time + " · ");
          const em = document.createElement("em");
          em.textContent = a.rent;
          sp.appendChild(em);
        }
        const bar = row.querySelector(".track i") as any;
        bar.style.width = a.w + "%";
        bar.style.background = fill;
        el.appendChild(row);
      });
  }
  $$("#catChips .chip").forEach((c: any) => {
    c.addEventListener(
      "click",
      () => {
        $$("#catChips .chip").forEach((x: any) => x.classList.remove("on"));
        c.classList.add("on");
        renderApps(c.dataset.c);
      },
      { signal }
    );
  });
  renderApps("all");
  $("#editExempt").addEventListener("click", () => toast("Exempt apps — Maps, Messages, Phone +3"), { signal });

  /* ================= rent segments ================= */
  $$("#rentSeg button").forEach((b: any) => {
    b.addEventListener(
      "click",
      () => {
        $$("#rentSeg button").forEach((x: any) => x.classList.remove("on"));
        b.classList.add("on");
        $("#rent-today").style.display = b.dataset.pane === "today" ? "flex" : "none";
        $("#rent-month").style.display = b.dataset.pane === "month" ? "flex" : "none";
      },
      { signal }
    );
  });

  /* ================= settings ================= */
  const allowOpts = [120, 180, 240],
    rateOpts = [0.1, 0.15, 0.25];
  $("#rowAllowance").addEventListener(
    "click",
    () => {
      const i = (allowOpts.indexOf(S.allowanceMin) + 1) % allowOpts.length;
      S.allowanceMin = allowOpts[i];
      $("#valAllowance").textContent = S.allowanceMin / 60 + "h ›";
      toast("Free allowance: " + S.allowanceMin / 60 + " hours a day");
      persist();
      render();
    },
    { signal }
  );
  $("#rowRate").addEventListener(
    "click",
    () => {
      const i = (rateOpts.indexOf(S.rate) + 1) % rateOpts.length;
      S.rate = rateOpts[i];
      $("#valRate").textContent = "$" + S.rate.toFixed(2) + "/min ›";
      toast("Rent rate: $" + S.rate.toFixed(2) + " per extra minute");
      persist();
      render();
    },
    { signal }
  );
  $("#valAllowance").textContent = S.allowanceMin / 60 + "h ›";
  $("#valRate").textContent = "$" + S.rate.toFixed(2) + "/min ›";

  function openPro() {
    $("#dimPro").classList.add("show");
    $("#sheetPro").classList.add("show");
  }
  function closePro() {
    $("#dimPro").classList.remove("show");
    $("#sheetPro").classList.remove("show");
  }
  $("#rowSub").addEventListener("click", openPro, { signal });
  $("#dimPro").addEventListener("click", closePro, { signal });
  $("#btnClaim").addEventListener(
    "click",
    () => {
      S.pro = true;
      persist();
      $("#valSub").textContent = "Pro ›";
      $("#valSub").classList.add("g");
      closePro();
      toast("Welcome to Pro — founder price locked for life");
    },
    { signal }
  );
  if (S.pro) {
    $("#valSub").textContent = "Pro ›";
    $("#valSub").classList.add("g");
  }

  /* confirm modal helper */
  let cfCb: (() => void) | null = null;
  function confirmModal(title: string, body: string, yes: string, cb: () => void) {
    $("#cfTitle").textContent = title;
    $("#cfBody").textContent = body;
    $("#cfYes").textContent = yes;
    cfCb = cb;
    $("#dimConfirm").classList.add("show");
  }
  $("#cfNo").addEventListener(
    "click",
    () => {
      $("#dimConfirm").classList.remove("show");
      cfCb = null;
    },
    { signal }
  );
  $("#cfYes").addEventListener(
    "click",
    () => {
      $("#dimConfirm").classList.remove("show");
      const cb = cfCb;
      cfCb = null;
      if (cb) cb();
    },
    { signal }
  );

  /* real payments — double confirm */
  const tgl = $("#tglReal");
  tgl.classList.toggle("on", S.realPay);
  tgl.addEventListener(
    "click",
    () => {
      if (S.realPay) {
        S.realPay = false;
        tgl.classList.remove("on");
        persist();
        toast("Real payments off");
        return;
      }
      confirmModal(
        "Enable real payments?",
        "Your rent will actually be charged via Apple Pay. Proceeds go to a charity you pick — never to us.",
        "Continue",
        () => {
          confirmModal("Are you sure?", "This needs Face ID and starts a 24h cooling-off period before the first charge.", "Enable", () => {
            S.realPay = true;
            tgl.classList.add("on");
            persist();
            toast("Real payments arm in 24h");
          });
        }
      );
    },
    { signal }
  );

  /* delete account */
  $("#btnDelete").addEventListener(
    "click",
    () => {
      confirmModal("Delete account?", "Your ledger, streak and achievements will be erased on this device.", "Delete", () => {
        try {
          localStorage.removeItem("ryt-demo");
          localStorage.removeItem("ryt-onboarded");
        } catch {}
        location.reload();
      });
    },
    { signal }
  );

  /* ================= banner / toast / clock ================= */
  let bannerTimer: ReturnType<typeof setTimeout> | null = null;
  function banner(t: string, s: string) {
    $("#bannerT").textContent = t;
    $("#bannerS").textContent = s;
    const b = $("#banner");
    b.classList.add("show");
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove("show"), 3800);
  }
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  function toast(msg: string) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }
  function clock() {
    const n = new Date();
    $("#clock").textContent = String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0");
  }
  clock();
  every(clock, 10000);

  render();
  every(persist, 5000);

  /* ================= cleanup ================= */
  return () => {
    controller.abort();
    intervals.forEach(clearInterval);
    timeouts.forEach(clearTimeout);
    if (bannerTimer) clearTimeout(bannerTimer);
    if (toastTimer) clearTimeout(toastTimer);
  };
}
