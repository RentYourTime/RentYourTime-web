"use client";

import { useEffect, useRef } from "react";
import "./demo.css";
import { initDemo } from "./demoLogic";

export function DemoApp() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    return initDemo(rootRef.current);
  }, []);

  return (
    <div className="ryt-demo" ref={rootRef}>
      <a className="skip-link" href="#phone">
        Skip to demo
      </a>
      <main className="stage" aria-label="Interactive app demo">
        <div className="phone" id="phone">
          {/* status bar */}
          <div className="statusbar" aria-hidden="true">
            <span id="clock" className="tnum">
              21:47
            </span>
            <span className="right">
              <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
                <rect x="0" y="7" width="3" height="4" rx="1" fill="#fff" />
                <rect x="4.5" y="5" width="3" height="6" rx="1" fill="#fff" />
                <rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="#fff" />
                <rect x="13.5" y="0" width="3" height="11" rx="1" fill="#fff" opacity=".35" />
              </svg>
              <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
                <rect x=".5" y=".5" width="20" height="11" rx="3.5" stroke="#fff" opacity=".4" />
                <rect x="2" y="2" width="13" height="8" rx="2" fill="#fff" />
                <path d="M22 4v4c1-.3 1.6-1.1 1.6-2S23 4.3 22 4z" fill="#fff" opacity=".4" />
              </svg>
            </span>
          </div>

          {/* in-app notification banner */}
          <div className="banner" id="banner" role="status" aria-live="polite">
            <div className="ic">
              <i />
            </div>
            <div>
              <div className="bt" id="bannerT" />
              <div className="bs" id="bannerS" />
            </div>
          </div>

          {/* SPLASH */}
          <section className="screen" id="s-splash">
            <div className="splash-ring">
              <div className="hole">
                <div className="dot" />
              </div>
            </div>
            <div className="wordmark">
              rentyourtime<b>.</b>
            </div>
          </section>

          {/* WELCOME */}
          <section className="screen" id="s-welcome">
            <div className="ghost">
              <div>
                3h
                <br />
                <span>free</span>
              </div>
            </div>
            <h1>
              Every minute
              <br />
              costs<span className="dotg">.</span>
            </h1>
            <div className="ob lead" style={{ padding: 0 }}>
              You get 3 free hours of screen time a day. After that, your phone starts charging rent.
            </div>
            <button className="btn" style={{ marginTop: 12 }} data-go="s-concept">
              Get Started
            </button>
            <div className="signin">
              Already renting? <b data-go="s-app">Sign in</b>
            </div>
          </section>

          {/* CONCEPT */}
          <section className="screen ob" id="s-concept">
            <div className="eyebrow">THE DEAL</div>
            <h1>
              3 hours free.
              <br />
              Then it&rsquo;s rent.
            </h1>
            <div
              className="card"
              style={{ display: "flex", flexDirection: "column", gap: 18, padding: 24, marginTop: 8 }}
            >
              <div className="deal-row">
                <span className="k">Free every day</span>
                <span className="v tnum" style={{ color: "var(--signal)" }}>
                  3:00
                </span>
              </div>
              <div className="deal-bar">
                <i style={{ width: "76%", background: "var(--signal)" }} />
                <i style={{ width: "8%", background: "var(--rent)" }} />
              </div>
              <div className="deal-row">
                <span className="k">Every extra minute</span>
                <span className="v tnum" style={{ color: "var(--rent)" }}>
                  $0.15
                </span>
              </div>
            </div>
            <div
              className="card"
              style={{ padding: "20px 24px", fontSize: 15, lineHeight: 1.55, color: "rgba(255,255,255,.6)" }}
            >
              The bill is virtual. No card, no charge — just the honest price of your attention. You can make it
              real later, if you dare.
            </div>
            <div className="spacer" />
            <button className="btn" data-go="s-perm1">
              I accept the deal
            </button>
          </section>

          {/* PERMISSION 1 */}
          <section className="screen ob" id="s-perm1">
            <div className="eyebrow">STEP 1 OF 2</div>
            <h1>
              We need to see
              <br />
              the meter.
            </h1>
            <div className="lead">
              Screen Time access lets us count your minutes. It stays on your device — we never see which apps you
              use.
            </div>
            <div className="spacer" />
            <button className="btn green" id="btnConnectST">
              Connect Screen Time
            </button>
          </section>

          {/* PERMISSION 2 */}
          <section className="screen ob" id="s-perm2">
            <div className="eyebrow">STEP 2 OF 2</div>
            <h1>
              We&rsquo;ll knock
              <br />
              before the bill.
            </h1>
            <div className="lead">
              One gentle heads-up when free time runs low. Never spam — you can count our notifications on one hand.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="notif-demo">
                <div className="ic">
                  <i />
                </div>
                <div>
                  <div className="t">45 minutes left today</div>
                  <div className="s">Still free. Spend them well.</div>
                </div>
              </div>
              <div className="notif-demo">
                <div className="ic">
                  <i />
                </div>
                <div>
                  <div className="t">You avoided paying $18 today</div>
                  <div className="s">Best day this month.</div>
                </div>
              </div>
            </div>
            <div className="spacer" />
            <button className="btn" data-go="s-app">
              Allow notifications
            </button>
            <button className="btn quiet" data-go="s-app">
              Maybe later
            </button>
          </section>

          {/* APP SHELL */}
          <section className="screen" id="s-app">
            <div className="views">
              {/* TODAY */}
              <div className="view active" id="v-today">
                <div className="today-head">
                  <span className="today-date" id="todayDate">
                    Monday, July 20
                  </span>
                  <span className="streak-chip">
                    <b className="tnum js-streak">12</b>
                    <span>day streak</span>
                  </span>
                </div>
                <div className="ringwrap">
                  <div className="ring over" id="ring" title="Tap to pause the meter">
                    <svg className="ring-svg" viewBox="0 0 200 200" aria-hidden="true">
                      <circle className="ring-track" cx="100" cy="100" r="92" />
                      <circle
                        className="ring-arc ring-red"
                        id="ringRed"
                        cx="100"
                        cy="100"
                        r="92"
                        style={{ strokeDasharray: "48 578", strokeDashoffset: -530 }}
                      />
                      <circle
                        className="ring-arc ring-green"
                        id="ringGreen"
                        cx="100"
                        cy="100"
                        r="92"
                        style={{ strokeDasharray: "524 578" }}
                      />
                    </svg>
                    <div className="hole">
                      <div className="big tnum" id="ringTime">
                        3:18
                      </div>
                      <div className="sub" id="ringSub">
                        18m over
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card rentcard">
                  <div>
                    <div className="k">Today&rsquo;s rent</div>
                    <div className="big tnum" id="rentToday">
                      <span className="odom">$2.70</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="k">This month</div>
                    <div className="mo tnum" id="rentMonth">
                      $31.05
                    </div>
                  </div>
                </div>
                <div className="actions">
                  <button className="btn green" id="btnFocus">
                    Start Focus
                  </button>
                  <button className="btn ghost" id="btnGoal">
                    Set a goal
                  </button>
                </div>
                <div className="tiles">
                  <div className="tile">
                    <div className="k">Money avoided</div>
                    <div className="v g tnum" id="tileAvoided">
                      $84
                    </div>
                  </div>
                  <div className="tile">
                    <div className="k">Time reclaimed</div>
                    <div className="v tnum">9h 20m</div>
                  </div>
                  <div className="tile">
                    <div className="k">Focus score</div>
                    <div className="v tnum">86</div>
                  </div>
                </div>
                <div className="card weekcard">
                  <div className="whead">
                    <b>This week</b>
                    <span id="weekAvg">avg 2h 51m</span>
                  </div>
                  <div className="bars" id="weekBars" />
                  <div className="daylabels">
                    <span>M</span>
                    <span>T</span>
                    <span>W</span>
                    <span>T</span>
                    <span>F</span>
                    <span>S</span>
                    <span className="today">S</span>
                  </div>
                </div>
                <div className="footline">
                  Your cheapest week since June<span className="dotg">.</span>
                </div>
              </div>

              {/* RENT */}
              <div className="view" id="v-rent">
                <div className="vtitle">Rent</div>
                <div className="seg" id="rentSeg">
                  <button className="on" data-pane="today">
                    Today
                  </button>
                  <button data-pane="month">This month</button>
                </div>
                <div id="rent-today" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="receipt">
                    <div className="rhead">
                      <span className="js-stmtDate">STATEMENT · JUL 20</span>
                      <span className="js-stmtNo">#0142</span>
                    </div>
                    <div className="line">
                      <span>Free allowance</span>
                      <span className="tnum js-lnAllow">3h 00m · $0.00</span>
                    </div>
                    <div className="line">
                      <span>Extra time</span>
                      <span className="tnum js-lnExtra">18m × $0.15</span>
                    </div>
                    <div className="total">
                      <b>Total rent</b>
                      <span className="sum tnum js-lnTotal">$2.70</span>
                    </div>
                    <div className="fine">Virtual bill. Nothing is charged. It&rsquo;s about knowing the price.</div>
                  </div>
                  <div className="card applist">
                    <h4 id="whereTitle">Where the 18 minutes went</h4>
                    <div className="approw">
                      <span className="nm">TikTok</span>
                      <span className="rt">
                        <span className="track">
                          <i id="wTik" />
                        </span>
                        <span className="mm tnum" id="wTikM">
                          12m
                        </span>
                      </span>
                    </div>
                    <div className="approw">
                      <span className="nm">Instagram</span>
                      <span className="rt">
                        <span className="track">
                          <i id="wIns" />
                        </span>
                        <span className="mm tnum" id="wInsM">
                          5m
                        </span>
                      </span>
                    </div>
                    <div className="approw">
                      <span className="nm">X</span>
                      <span className="rt">
                        <span className="track">
                          <i id="wX" />
                        </span>
                        <span className="mm tnum" id="wXM">
                          1m
                        </span>
                      </span>
                    </div>
                  </div>
                  <button className="btn" id="btnEndDay">
                    Close the day — generate bill
                  </button>
                </div>
                <div id="rent-month" style={{ display: "none", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em" }}>July</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,.45)" }} id="dayCount">
                      20 of 31 days
                    </span>
                  </div>
                  <div className="mo-cards">
                    <div className="mo-card">
                      <div className="k">Rent so far</div>
                      <div className="v tnum" style={{ color: "var(--rent)" }} id="moRent">
                        $31.05
                      </div>
                      <div className="d g">▼ 38% vs June</div>
                    </div>
                    <div className="mo-card">
                      <div className="k">Avoided</div>
                      <div className="v tnum" style={{ color: "var(--signal)" }} id="moAvoided">
                        $84.00
                      </div>
                      <div className="d" id="moFreeDays">
                        14 free days
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{ padding: "18px 20px" }}>
                    <h4 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>Rent calendar</h4>
                    <div className="cal" id="cal" />
                    <div className="legend">
                      <span>
                        <i style={{ background: "rgba(0,230,118,.55)" }} />
                        Free day
                      </span>
                      <span>
                        <i style={{ background: "rgba(255,59,48,.5)" }} />
                        Paid rent
                      </span>
                    </div>
                  </div>
                  <div className="card hist">
                    <h4>Daily ledger</h4>
                    <div id="ledger" style={{ display: "flex", flexDirection: "column", gap: 13 }} />
                  </div>
                  <div className="card hist">
                    <h4>History</h4>
                    <div className="row">
                      <span>June</span>
                      <b className="tnum">$50.10</b>
                    </div>
                    <div className="row">
                      <span>May</span>
                      <b className="tnum">$67.95</b>
                    </div>
                    <div className="row">
                      <span>April</span>
                      <b className="tnum">$71.40</b>
                    </div>
                  </div>
                </div>
              </div>

              {/* INSIGHTS */}
              <div className="view" id="v-insights">
                <div className="vtitle">Insights</div>
                <div className="chips" id="periodChips">
                  <button className="chip on" data-p="W">
                    W
                  </button>
                  <button className="chip" data-p="M">
                    M
                  </button>
                  <button className="chip" data-p="6M">
                    6M
                  </button>
                  <button className="chip" data-p="Y">
                    Y
                  </button>
                </div>
                <div className="card icard">
                  <div className="k">Daily average</div>
                  <div className="hl">
                    <b className="tnum" id="avgVal">
                      2h 51m
                    </b>
                    <span id="avgDelta">▼ 24m vs last week</span>
                  </div>
                  <div className="ibars" id="insBars" />
                  <div className="ibars-note">— 3h free line</div>
                </div>
                <div className="bw">
                  <div className="tile">
                    <div className="k">Best day</div>
                    <div className="v g" id="bestDay">
                      Thu · 1h 26m
                    </div>
                  </div>
                  <div className="tile">
                    <div className="k">Worst day</div>
                    <div className="v r" id="worstDay" style={{ color: "var(--rent)" }}>
                      Wed · 4h 02m
                    </div>
                  </div>
                </div>
                <div className="card">
                  <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>Danger hours</h4>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginBottom: 14 }}>
                    You doomscroll most between 22:00–01:00.
                  </div>
                  <div className="hours" id="hours" />
                  <div className="hourlabels">
                    <span>06</span>
                    <span>12</span>
                    <span>18</span>
                    <span>24</span>
                  </div>
                </div>
                <div className="card proj">
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Projection</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginTop: 2 }}>
                      On this pace, July&rsquo;s rent lands at
                    </div>
                  </div>
                  <span className="v tnum" id="projVal">
                    ~$48
                  </span>
                </div>
                <div className="vtitle" style={{ fontSize: 22, marginTop: 8 }}>
                  Apps
                </div>
                <div className="chips" id="catChips">
                  <button className="chip on" data-c="all">
                    All
                  </button>
                  <button className="chip" data-c="social">
                    Social
                  </button>
                  <button className="chip" data-c="video">
                    Video
                  </button>
                  <button className="chip" data-c="games">
                    Games
                  </button>
                </div>
                <div className="card usage" id="usageList" />
                <div className="card exempt">
                  <div>
                    <div className="t">Exempt apps</div>
                    <div className="s">Maps, Messages, Phone don&rsquo;t count</div>
                  </div>
                  <a id="editExempt">Edit</a>
                </div>
                <div className="insight-call">
                  <div className="t">Insight</div>
                  <div className="s">
                    TikTok alone caused 71% of your rent this month. Capping it at 45m would have saved you $22.
                  </div>
                </div>
              </div>

              {/* AWARDS */}
              <div className="view" id="v-awards">
                <div className="vtitle">Achievements</div>
                <div className="card streakcard">
                  <div className="n tnum js-streak">12</div>
                  <div className="k">days under budget</div>
                  <div className="pips" id="pips" />
                  <div className="next" id="streakNext">
                    2 days to &ldquo;Two Weeks Clean&rdquo;
                  </div>
                </div>
                <div className="badges">
                  <div className="badge">
                    <div className="shimmer" />
                    <div className="coin">
                      <div className="in tnum">7</div>
                    </div>
                    <div className="t">First Week</div>
                    <div className="s">7 days under 3h</div>
                  </div>
                  <div className="badge">
                    <div className="shimmer" />
                    <div className="coin">
                      <div className="in tnum">$50</div>
                    </div>
                    <div className="t">Saver</div>
                    <div className="s">$50 avoided</div>
                  </div>
                  <div className="badge locked" id="badgeTwoWeeks">
                    <div className="shimmer" />
                    <div className="coin">
                      <div className="in tnum">14</div>
                    </div>
                    <div className="t">Two Weeks Clean</div>
                    <div className="s">14-day streak · locked</div>
                  </div>
                  <div className="badge locked">
                    <div className="shimmer" />
                    <div className="coin">
                      <div className="in tnum">0:00</div>
                    </div>
                    <div className="t">Zero Day</div>
                    <div className="s">A full day off · locked</div>
                  </div>
                </div>
                <div className="card challenge">
                  <div>
                    <div className="t">Challenge: Sub-3 Week</div>
                    <div className="s" id="chalSub">
                      Every day under 3h · 5/7 done
                    </div>
                  </div>
                  <div className="mini-ring" id="chalRing">
                    <div className="in tnum" id="chalVal">
                      5/7
                    </div>
                  </div>
                </div>
              </div>

              {/* SETTINGS */}
              <div className="view" id="v-settings">
                <div className="vtitle">Settings</div>
                <div className="group">
                  <div className="srow" id="rowAllowance">
                    <span className="l">Daily free allowance</span>
                    <span className="r tnum" id="valAllowance">
                      3h ›
                    </span>
                  </div>
                  <div className="srow" id="rowRate">
                    <span className="l">Rent rate</span>
                    <span className="r tnum" id="valRate">
                      $0.15/min ›
                    </span>
                  </div>
                  <div className="srow">
                    <span className="l">Exempt apps</span>
                    <span className="r">6 ›</span>
                  </div>
                </div>
                <div className="group">
                  <div className="srow">
                    <span className="l">Notifications</span>
                    <span className="r">›</span>
                  </div>
                  <div className="srow">
                    <span className="l">Widgets &amp; Live Activity</span>
                    <span className="r">›</span>
                  </div>
                  <div className="srow">
                    <span className="l">Appearance</span>
                    <span className="r">Dark ›</span>
                  </div>
                </div>
                <div className="group">
                  <div className="srow" id="rowSub">
                    <span className="l">Subscription</span>
                    <span className="r" id="valSub">
                      Free ›
                    </span>
                  </div>
                  <div className="srow">
                    <span className="l">Privacy &amp; data</span>
                    <span className="r">›</span>
                  </div>
                </div>
                <div className="danger">
                  <div className="head">
                    <div>
                      <div className="t">Real payments</div>
                      <div className="s">Actually charge your rent via Apple Pay</div>
                    </div>
                    <div className="toggle" id="tglReal" />
                  </div>
                  <div className="fine">
                    Off by default. Requires Face ID and a 24h cooling-off period. Proceeds go to a charity you pick
                    — never to us.
                  </div>
                </div>
                <button className="delete" id="btnDelete">
                  Delete account
                </button>
              </div>
            </div>

            {/* demo controls */}
            <div className="demobar">
              <span className="dlabel">DEMO</span>
              <button className="dbtn on" id="sp1">
                ×1
              </button>
              <button className="dbtn" id="sp60">
                ×60
              </button>
              <button className="dbtn" id="dAdd">
                +30 min
              </button>
              <button className="dbtn" id="dEnd">
                End day
              </button>
              <button className="dbtn" id="dReset">
                Reset
              </button>
            </div>

            <nav className="tabbar">
              <button className="tab on" data-view="v-today">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.4" opacity=".35" />
                  <path d="M12 3.5a8.5 8.5 0 016.9 13.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
                Today
              </button>
              <button className="tab" data-view="v-rent">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                  <path d="M9 8.5h6M9 12h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
                Rent
              </button>
              <button className="tab" data-view="v-insights">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="12" width="3.4" height="8" rx="1.4" fill="currentColor" />
                  <rect x="10.3" y="7" width="3.4" height="13" rx="1.4" fill="currentColor" />
                  <rect x="16.6" y="4" width="3.4" height="16" rx="1.4" fill="currentColor" />
                </svg>
                Insights
              </button>
              <button className="tab" data-view="v-awards">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="9.5" r="5.7" stroke="currentColor" strokeWidth="2.2" />
                  <path d="M9 14.5L7.5 21l4.5-2.4L16.5 21 15 14.5" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                </svg>
                Awards
              </button>
              <button className="tab" data-view="v-settings">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2.1" />
                  <path
                    d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                  />
                </svg>
                Settings
              </button>
            </nav>
          </section>

          {/* system dialog (screen time) */}
          <div className="sysdim" id="dimST">
            <div className="sysdialog">
              <h3>&ldquo;RentYourTime&rdquo; Would Like to Access Screen Time</h3>
              <p>Used only to measure daily usage on this device.</p>
              <div className="acts">
                <button id="stDeny">Don&rsquo;t Allow</button>
                <button id="stAllow">Allow</button>
              </div>
            </div>
          </div>

          {/* bill ceremony (midnight) */}
          <div className="sheetdim" id="dimBill" />
          <div className="billwrap" id="billWrap">
            <div className="receipt">
              <div className="stamp" id="billStamp">
                SETTLED
              </div>
              <div className="rhead">
                <span className="js-stmtDate">STATEMENT · JUL 20</span>
                <span className="js-stmtNo">#0142</span>
              </div>
              <div className="line">
                <span>Free allowance</span>
                <span className="tnum js-lnAllow">3h 00m · $0.00</span>
              </div>
              <div className="line">
                <span>Extra time</span>
                <span className="tnum js-lnExtra">18m × $0.15</span>
              </div>
              <div className="total">
                <b>Total rent</b>
                <span className="sum tnum js-lnTotal">$2.70</span>
              </div>
              <div className="fine" id="billFine">
                Virtual bill. Nothing is charged. It&rsquo;s about knowing the price.
              </div>
            </div>
            <button className="btn" id="btnNoted">
              Noted.
            </button>
          </div>

          {/* premium sheet */}
          <div className="sheetdim" id="dimPro" />
          <div className="sheet" id="sheetPro">
            <div className="grabber" />
            <div className="pro-eyebrow">RENTYOURTIME PRO</div>
            <div className="pro-title">
              Know exactly
              <br />
              what your time
              <br />
              is worth.
            </div>
            <div className="pro-feats">
              <div className="f">
                <i />
                <span>Danger-hour predictions &amp; yearly trends</span>
              </div>
              <div className="f">
                <i />
                <span>Per-app rent rates &amp; custom allowance</span>
              </div>
              <div className="f">
                <i />
                <span>Focus sessions, Watch app, widgets</span>
              </div>
            </div>
            <div className="plan featured" style={{ marginTop: 10 }}>
              <div className="flag">FOUNDER · 85% OFF FOREVER</div>
              <div>
                <div className="t">Yearly</div>
                <div className="s">
                  <s>$59.99</s> → locked for life
                </div>
              </div>
              <div className="p tnum">
                $8.99<span>/yr</span>
              </div>
            </div>
            <div className="plan">
              <div className="t">Monthly</div>
              <div className="p tnum">
                $3.99<span>/mo</span>
              </div>
            </div>
            <button className="btn green" id="btnClaim">
              Claim founder price
            </button>
            <div className="pro-fine">Cancel anytime · Restore purchase · Terms</div>
          </div>

          {/* confirm modal */}
          <div className="sysdim" id="dimConfirm">
            <div className="modal">
              <h3 id="cfTitle">Enable real payments?</h3>
              <p id="cfBody">Your rent will actually be charged via Apple Pay after a 24h cooling-off period.</p>
              <div className="acts">
                <button className="btn ghost" id="cfNo">
                  Not now
                </button>
                <button className="btn" id="cfYes">
                  Continue
                </button>
              </div>
            </div>
          </div>

          <div className="toast" id="toast" />
        </div>
      </main>
    </div>
  );
}
