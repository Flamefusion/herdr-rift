// Rift: a League-themed squad for Herdr, shown on the Summoner's Rift minimap.
//   props.role "brand"   the title strip above the map
//   props.role "map"     the map: every champion stands where its state puts it
//   props.role "scout"   Teemo, floating at the edge, reporting who needs you
//   props.role "select"  champion select, a dialog: pick champions or a comp, give the lead a task
//   props.role "score"   the scoreboard, a dialog: every champion's state, time, context and cost
//   props.role "menu"    a champion's right-click menu
//   no role              a notification (the layout names this mod as its "toast")
// The squad is roster.js; each champion's brief is roles/<id>.md.
//
// Where a champion stands:
//   idle      its own fountain
//   working   its own lane (top, jungle, mid, bot, support) or objective (dragon, baron, river)
//   a camp    a long task of that kind (reported by bin/rift-hook, shown after CAMP_AFTER_MS)
//   Baron     a release command; Dragon: a nightly or soak run
//   together  beside a squad mate it just messaged, at the nearer scuttle
//   blocked   where it was, with a ping: red for "approve this", yellow for "answer this"
//   done      its own nexus

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, spaces, run, hc, theme, props, window, layout, shared, setShared, setAgentOrder, setBadge, placement, openOverlay, closeOverlay, nextCommand, checking } from "herdr";
import { ROSTER } from "./roster.js";
import { ART, ICONS, DISPLAY, WORD, TEAM, NEEDS, COMPS, byId, postOf, champOf, who, squadNow, visit, summon, loadState, left, healthColor, face, statusMark, clock, since } from "./lib.js";

const CAMP_AFTER_MS = 10000;
const TALK_FOR_MS = 90000;
const FAIL_FOR_MS = 60000;
const SIDEBAR_WIDTH = 440;
const FEED_KEPT = 12;

// Everything below is in percent of the map image (0,0 top left).
const LANE = {
  blue: { top: [9, 45, "y"], jungle: [36, 74, null], mid: [40, 60, "d"], bot: [54, 88, "x"], support: [38, 88, null] },
  red: { top: [55, 9, "x"], jungle: [64, 26, null], mid: [60, 40, "d"], bot: [91, 54, "y"], support: [91, 38, null] },
  none: { dragon: [67, 70, null], baron: [33, 29, null], river: [50, 50, null] },
};
// A marker and the name under it need about 12 percent across and 15 down, so nobody hides a neighbour.
const FOUNTAIN = {
  blue: { top: [7, 58], jungle: [7, 73], mid: [8, 88], bot: [21, 88], support: [34, 88] },
  red: { top: [93, 42], jungle: [93, 27], mid: [92, 12], bot: [79, 12], support: [66, 12] },
};
const NEXUS = {
  blue: { top: [18, 58], jungle: [19, 74], mid: [31, 66], bot: [33, 82], support: [46, 82] },
  red: { top: [82, 42], jungle: [81, 26], mid: [69, 34], bot: [67, 18], support: [54, 18] },
};
const CAMPS = {
  blue: { research: [25, 48], waiting: [15, 43], search: [27, 57], tests: [47, 65], hardware: [53, 75], build: [57, 84] },
  red: { research: [75, 52], waiting: [85, 57], search: [73, 43], tests: [53, 35], hardware: [47, 25], build: [43, 16] },
};
// Anyone running a release stands at Baron; anyone running a nightly or soak run, at Dragon.
const OBJECTIVE = { release: [39, 31], nightly: [61, 69] };
const PITS = [["baron", "Baron: release", 33, 23, "#b678dd"], ["dragon", "Dragon: nightly", 67, 77, "#f0d896"]];
const SCUTTLE = { top: [26, 38], bot: [74, 62] };

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, as in the shipped mods.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? SIDEBAR_WIDTH) : window()?.platform === "macos" ? 76 : 44 });
}

const openSelect = (pick) => openOverlay({ mod: "rift", kind: "dialog", width: 660, props: { role: "select", pick: pick ?? null } });
const openScore = () => openOverlay({ mod: "rift", kind: "dialog", width: 780, props: { role: "score" } });
const feed = () => (Array.isArray(shared("rift.feed")) ? shared("rift.feed") : []);

export default class Rift extends View {
  init(_props, cx) {
    this.size = null;
    this.act = {};
    this.ctx = {};
    this.talks = [];
    this.key = "";
    this.was = null;
    this.lastTalk = Date.now();
    this.badge = null;
    const role = props()?.role;
    if (role === "select") this.initSelect(cx);
    if (checking() || (role !== "map" && role !== "score")) return;
    cx.timer.every(3000, (cx) => this.refresh(cx));
    this.refresh(cx);
    if (role !== "map") return;
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (command === "score") openScore();
        if (command === "select") openSelect();
        if (command === "menu") {
          // The focused champion's menu, for a key: "rift.menu".
          const { mine } = squadNow(this.act);
          const c = ROSTER.find((x) => mine.get(x.id)?.focused);
          if (c) openOverlay({ mod: "rift", kind: "popup", width: 190, height: 112, props: { role: "menu", champ: c.id, terminal: mine.get(c.id).address, pane: mine.get(c.id).pane } });
        }
      }
    });
  }

  // Reads what the hooks wrote. Redraws only when something on the map would change.
  refresh(cx) {
    cx.spawn(async (cx) => {
      const state = await loadState();
      this.act = state.act;
      this.ctx = state.ctx;
      this.talks = state.talks;
      const now = Date.now();
      if (props()?.role === "score") { cx.notify(); return; }
      this.report(now);
      const key = JSON.stringify([ROSTER.map((c) => [this.campOf(c, now), this.act[c.id]?.needs ?? null, this.failing(c, now), Math.round((left(this.ctx, c.id) ?? -5) / 5), this.act[c.id]?.terminal ?? null]), this.pairs(now)]);
      if (key !== this.key) { this.key = key; cx.notify(); }
    });
  }

  // The camp a champion is at: a reported activity that has lasted long enough.
  campOf(c, now) {
    const a = this.act[c.id];
    if (!a?.activity || now - (a.since ?? now) < CAMP_AFTER_MS) return null;
    return a.activity;
  }

  failing(c, now) {
    const a = this.act[c.id];
    return a?.fail_at && now - a.fail_at < FAIL_FOR_MS ? a.fail : null;
  }

  // Recent messages between two champions, newest first, one pair per champion.
  pairs(now) {
    const taken = new Set();
    const out = [];
    for (const m of [...this.talks].reverse()) {
      if (now - (m.at ?? 0) > TALK_FOR_MS) break;
      if (m.from === m.to || taken.has(m.from) || taken.has(m.to)) continue;
      taken.add(m.from); taken.add(m.to);
      out.push([m.from, m.to]);
    }
    return out;
  }

  // The feed: what changed since the last look, kept in shared state for the scoreboard.
  report(now) {
    const { mine } = squadNow(this.act);
    const is = new Map(ROSTER.map((c) => [c.id, { status: mine.get(c.id)?.status ?? null, needs: this.act[c.id]?.needs ?? null, fail_at: this.act[c.id]?.fail_at ?? 0 }]));
    const news = [];
    if (this.was) {
      for (const c of ROSTER) {
        const a = this.was.get(c.id);
        const b = is.get(c.id);
        if (!a.status && b.status) news.push([`${c.name} joined the Rift`, "accent"]);
        else if (a.status && !b.status) news.push([`${c.name} recalled`, "muted"]);
        else if (a.status !== b.status && b.status === "done") news.push([`${c.name} finished`, "done"]);
        else if (a.status !== b.status && b.status === "blocked") news.push([`${c.name} ${NEEDS[b.needs] ?? "pinged you"}`, "blocked"]);
        if (b.fail_at > a.fail_at && b.status) news.push([`${c.name}: ${this.act[c.id].fail} failed`, "blocked"]);
      }
      for (const m of this.talks) {
        if ((m.at ?? 0) > this.lastTalk && byId(m.from) && byId(m.to)) news.push([`${byId(m.from).name} → ${byId(m.to).name}: handoff`, "working"]);
      }
    }
    this.was = is;
    this.lastTalk = Math.max(this.lastTalk, ...this.talks.map((m) => m.at ?? 0));
    if (news.length) setShared("rift.feed", [...feed(), ...news.map(([text, color]) => ({ at: now, text, color }))].slice(-FEED_KEPT));
  }

  render(cx) {
    const role = props()?.role;
    if (role === "brand") return this.brand();
    if (role === "scout") return this.scout();
    if (role === "select") return this.select();
    if (role === "score") return this.score();
    if (role === "menu") return this.menu();
    if (role === "map") return this.map();
    return this.toast();
  }

  // ---- brand ----
  brand() {
    const t = theme();
    const collapsed = narrow();
    const labels = shared("rift.labels") !== false;
    const button = (id, child, tip, action, on) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(4)
      .text_color(on ? t.accent : t.muted).hover((s) => s.bg(t.hover).text_color(t.accent)).tooltip(tip)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action)
      .child(child);
    const mac = window()?.platform === "macos";
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center()
      .when(mac && !window()?.fullscreen && !collapsed, (el) => el.pl(76))
      .when(!collapsed, (el) => el.child(h_flex().flex_1().min_w(0).gap(8).items_center()
        .child(image(`${ART}/crest.svg`).w(20).h(20).flex_none())
        .child(div().font_family(DISPLAY).text_size(14).font_semibold().text_color(t.accent).truncate().child("THE RIFT"))))
      .when(!collapsed, (el) => el.child(button("select", svg(`${ICONS}/plus.svg`).size(15), "Champion select", () => openSelect(), false)))
      .when(!collapsed, (el) => el.child(button("score", svg(`${ICONS}/monitor.svg`).size(15), "Scoreboard", () => openScore(), false)))
      .when(!collapsed, (el) => el.child(button("labels", svg(`${ICONS}/layers.svg`).size(15), labels ? "Hide map labels" : "Show map labels", () => setShared("rift.labels", !labels), labels)))
      .when(!collapsed, (el) => el.child(button("search", svg(`${ICONS}/search.svg`).size(15), "Find", () => run("mod.open", { name: "picker" }), false)))
      .when(!(collapsed && mac), (el) => el.child(button("sidebar-toggle", svg(`${ICONS}/sidebar.svg`).size(15), "Fold the map", toggleSidebar, false)));
  }

  // ---- map ----
  // Where every live champion stands, in percent, and how it paces.
  places(mine, now) {
    const out = new Map();
    for (const c of ROSTER) {
      const a = mine.get(c.id);
      if (!a) continue;
      const home = LANE[c.side]?.[c.post] ?? [50, 50, null];
      const team = c.side === "none" ? null : c.side;
      let spot = { x: home[0], y: home[1], pace: null, at: postOf(c) };
      if (a.status === "idle" && team) spot = { x: FOUNTAIN[team][c.post][0], y: FOUNTAIN[team][c.post][1], pace: null, at: "fountain" };
      else if (a.status === "done" && team) spot = { x: NEXUS[team][c.post][0], y: NEXUS[team][c.post][1], pace: null, at: "nexus" };
      else if (a.status === "working") {
        const camp = this.campOf(c, now);
        const where = camp && (OBJECTIVE[camp] ?? CAMPS[team ?? "blue"][camp]);
        if (where) spot = { x: where[0], y: where[1], pace: null, at: camp };
        else spot.pace = home[2];
      }
      out.set(c.id, spot);
    }
    // Two that just talked stand together at the scuttle nearer to them.
    const links = [];
    for (const [from, to] of this.pairs(now)) {
      const p = out.get(from);
      const q = out.get(to);
      if (!p || !q) continue;
      const s = (p.x + q.x) / 2 + (100 - (p.y + q.y) / 2) < 100 ? SCUTTLE.top : SCUTTLE.bot;
      out.set(from, { x: s[0] - 6, y: s[1], pace: null, at: "handoff" });
      out.set(to, { x: s[0] + 6, y: s[1], pace: null, at: "handoff" });
      links.push(s);
    }
    // Any two still on the same spot: nudge the later one aside.
    const used = [];
    for (const spot of out.values()) {
      for (let tries = 0; spot.at !== "handoff" && tries < 6; tries++) {
        const hit = used.find((u) => Math.abs(u.x - spot.x) < 10 && Math.abs(u.y - spot.y) < 14);
        if (!hit) break;
        const side = spot.x === hit.x ? (hit.x < 50 ? 1 : -1) : Math.sign(spot.x - hit.x);
        spot.x = Math.max(6, Math.min(94, hit.x + side * 11));
      }
      used.push(spot);
    }
    return { out, links };
  }

  marker(t, c, a, spot, S, M, now) {
    const needs = a.status === "blocked" ? this.act[c.id]?.needs ?? null : null;
    const failed = this.failing(c, now);
    const hp = left(this.ctx, c.id);
    const ring = a.status === "blocked" ? (needs === "answer" ? "#f0d896" : t.blocked) : a.status === "done" ? t.done : a.status === "working" ? t.working : t.input;
    const step = S * 0.07;
    const note = a.status === "blocked" && needs ? NEEDS[needs] : failed ? `${failed} failed` : WORD[a.status] ?? a.status;
    // Pacing lives on inner wrappers so the outer element can glide to a new spot.
    let body = div().relative().w(M).h(M)
      .child(face(c, M, ring, false))
      .when(a.status === "working", (el) => el.child(svg(`${ICONS}/spinner.svg`).absolute().left(-4).top(-4).size(M + 8).text_color(t.working).spin(900)))
      .when(a.status === "blocked", (el) => el
        .child(div().absolute().left(-6).top(-6).w(M + 12).h(M + 12).rounded((M + 12) / 2).border(3).border_color(ring).loop("opacity", { from: 0.15, to: 1, period: 900 }))
        .child(needs
          ? image(`${ART}/ping-${needs}.png`).absolute().left(M - 11).w(22).h(22).loop("top", { from: -13, to: -8, period: 700 })
          : div().absolute().top(-6).right(-6).size(15).rounded(8).bg(t.blocked).flex().items_center().justify_center().text_size(10).font_bold().text_color("#ffffff").child("!")))
      .when(Boolean(failed) && a.status !== "blocked", (el) => el
        .child(div().absolute().left(-5).top(-5).w(M + 10).h(M + 10).rounded((M + 10) / 2).border(2).border_color(t.blocked).loop("opacity", { from: 0, to: 1, period: 600 }))
        .child(image(`${ART}/ping-fail.png`).absolute().top(-10).left(-10).w(20).h(20)))
      .when(a.status === "done", (el) => el.child(div().absolute().top(-5).right(-5).size(13).rounded(7).bg(t.done).border(1.5).border_color(t.canvas)))
      .when(Boolean(a.focused), (el) => el.child(div().absolute().left(-3).top(-3).w(M + 6).h(M + 6).rounded((M + 6) / 2).border_1().border_color(t.foreground)));
    if (spot.pace === "y" || spot.pace === "d") body = div().relative().child(body).loop("top", { from: -step, to: step, period: 7000 });
    if (spot.pace === "x") body = div().relative().child(body).loop("left", { from: -step, to: step, period: 6000 });
    if (spot.pace === "d") body = div().relative().child(body).loop("left", { from: step, to: -step, period: 7000 });
    return div().id(`m-${c.id}`).absolute().left((spot.x / 100) * S - M / 2).top((spot.y / 100) * S - M / 2).w(M).h(M)
      .transition("left", { duration: 1200, easing: "ease-in-out" }).transition("top", { duration: 1200, easing: "ease-in-out" })
      .cursor_pointer().tooltip(`${c.name}, ${postOf(c)} (${c.lane.toLowerCase()}): ${note}${spot.at && !["fountain", "nexus", postOf(c)].includes(spot.at) ? `, at ${spot.at}` : ""}${hp === null ? "" : `. Context left ${Math.round(hp)}%`}${a.helper ? ". A helper: click to peek" : ""}`)
      .on_click(() => visit(a))
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        openOverlay({ mod: "rift", kind: "popup", width: 190, height: 112, props: { role: "menu", champ: c.id, terminal: a.address, pane: a.pane } });
      })
      .child(body)
      // The health bar: how much context is left.
      .when(hp !== null, (el) => el.child(div().absolute().left(0).top(M + 3).w(M).h(3).rounded(1.5).bg("#010a13cc")
        .child(div().h(3).w(Math.max(2, (hp / 100) * M)).rounded(1.5).bg(healthColor(hp)))))
      .child(div().absolute().left(M / 2 - 30).top(M + (hp === null ? 3 : 8)).w(60).flex().justify_center()
        .child(div().px(4).rounded(2).bg(TEAM[c.side] + "cc").text_size(9.5).text_color("#ffffff").whitespace_nowrap().child(c.short)));
  }

  map() {
    const t = theme();
    const { mine, minions } = squadNow(this.act);
    const live = ROSTER.filter((c) => mine.has(c.id));
    const bench = ROSTER.filter((c) => !mine.has(c.id));
    setAgentOrder([...live.map((c) => mine.get(c.id).address), ...minions.map((a) => a.address)]);
    const waiting = agents().filter((a) => a.status === "blocked").length;
    const badge = waiting ? String(waiting) : null;
    if (badge !== this.badge) { this.badge = badge; setBadge(badge); }

    if (narrow()) {
      return v_flex().id("rift-rail").size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.border).pt(8).gap(6).items_center().overflow_y_scrollbar()
        .children(ROSTER.map((c) => {
          const a = mine.get(c.id);
          return div().id(`rail-${c.id}`).relative().flex_none().cursor_pointer().tooltip(a ? `${c.name}: ${WORD[a.status] ?? a.status}` : `Summon ${c.name}`)
            .on_click(() => (a ? visit(a) : openSelect(c.id)))
            .child(face(c, 28, a ? (t[a.status] ?? t.input) : t.input, !a));
        }));
    }

    const W = this.size?.width ?? SIDEBAR_WIDTH;
    const H = this.size?.height ?? 560;
    const S = Math.max(180, Math.floor(Math.min(W - 16, H - 158)));
    const M = S < 300 ? 24 : 30;
    const now = Date.now();
    const { out, links } = this.places(mine, now);
    const labels = shared("rift.labels") !== false && S >= 300;
    const tag = (text, x, y, color) => div().absolute().left((x / 100) * S - 45).top((y / 100) * S).w(90).flex().justify_center()
      .child(div().px(4).rounded(7).bg("#010a13b3").text_size(color ? 9.5 : 8.5).text_color(color ?? t.muted).whitespace_nowrap().child(text));
    const camps = [...Object.entries(CAMPS.blue), ...Object.entries(CAMPS.red)];

    const board = div().relative().w(S).h(S).flex_none().rounded(3).border_1().border_color(t.input).bg("#000000").overflow_hidden()
      .child(image(`${ART}/map.png`).absolute().left(0).top(0).w(S).h(S))
      .children(camps.map(([, [x, y]]) => image(`${ART}/camp.png`).absolute().left((x / 100) * S - 8).top((y / 100) * S - 8).w(16).h(16)))
      .children(PITS.map(([icon, , x, y]) => image(`${ART}/${icon}.png`).absolute().left((x / 100) * S - 12).top((y / 100) * S - 12).w(24).h(24)))
      .when(labels, (el) => el
        .children(camps.map(([name, [x, y]]) => tag(name, x, y + 2.5, null)))
        .children(PITS.map(([, text, x, y, color]) => tag(text, x, y + 3.5, color)))
        .children(Object.values(SCUTTLE).map(([x, y]) => tag("Scuttle: handoff", x, y - 7, "#0ac8b9"))))
      .children(links.map((s) => image(`${ART}/ping-handoff.png`).absolute().left((s[0] / 100) * S - 9).w(18).h(18).loop("top", { from: (s[1] / 100) * S - 34, to: (s[1] / 100) * S - 29, period: 900 })))
      .children(live.map((c) => this.marker(t, c, mine.get(c.id), out.get(c.id), S, M, now)));

    const last = feed().at(-1);
    const ticker = h_flex().id("rift-ticker").w(S).h(20).flex_none().px(6).gap(8).items_center().rounded(3).bg(t.surface).cursor_pointer()
      .tooltip("The latest event. Click for the scoreboard.").hover((s) => s.bg(t.hover)).on_click(() => openScore())
      .child(div().flex_none().text_size(10).text_color(t.dim).child(last ? clock(last.at) : "--:--"))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(last ? (t[last.color] ?? t.muted) : t.dim).child(last ? last.text : "Nothing has happened yet"));

    const benchRow = h_flex().flex_wrap().gap(5).items_center()
      .children(bench.map((c) => div().id(`bench-${c.id}`).flex_none().cursor_pointer().rounded(15).hover((s) => s.bg(t.hover))
        .tooltip(`Summon ${c.name}, ${postOf(c)} (${c.lane.toLowerCase()}). ${c.job}`)
        .on_click(() => openSelect(c.id))
        .child(face(c, 28, t.input, true))));

    const minion = (a) => h_flex().id(`minion-${a.address}`).h(24).px(6).gap(8).flex_none().items_center().rounded(4).cursor_pointer()
      .when(a.focused, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
      .on_click(() => run("pane.focus", { pane: a.pane }))
      .when(Boolean(a.program?.icon), (el) => el.child(a.program.tint
        ? svg(a.program.icon).size(14).flex_none().text_color(t.muted)
        : image(a.program.icon).w(14).h(14).flex_none()))
      .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted)
        .child(`${a.program?.name ?? a.app ?? "Agent"} · ${a.space_name}${/^\d+$/.test(a.tab_name) ? "" : " / " + a.tab_name}`))
      .child(statusMark(t, a.status));

    const heading = (label, right) => h_flex().h(22).flex_none().items_center().justify_between()
      .child(div().font_family(DISPLAY).text_size(10.5).font_semibold().text_color(t.accent).child(label))
      .child(div().text_size(10.5).text_color(t.muted).child(right));

    return v_flex().id("rift-map").size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.border).p(8).gap(6).items_center().text_size(13)
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .child(board)
      .child(ticker)
      .child(v_flex().id("rift-below").w(S).flex_1().min_h(0).gap(2).overflow_y_scrollbar()
        .when(bench.length > 0, (el) => el.child(heading("NOT SUMMONED", `${live.length}/${ROSTER.length} on the Rift`)).child(benchRow))
        .when(minions.length > 0, (el) => el.child(heading("MINIONS", String(minions.length))).children(minions.map(minion))));
  }

  // ---- a champion's right-click menu ----
  menu() {
    const t = theme();
    const p = props() ?? {};
    const c = byId(p.champ) ?? ROSTER[0];
    const close = () => closeOverlay(p.overlay);
    const item = (id, text, color, action) => h_flex().id(id).h(28).px(10).items_center().rounded(4).cursor_pointer().text_size(12.5).text_color(color)
      .hover((s) => s.bg(t.hover)).on_click(() => { close(); action(); }).child(text);
    return v_flex().id("rift-menu").size_full().p(4).bg(t.popover)
      .child(div().px(10).h(22).flex().items_center().font_family(DISPLAY).text_size(10.5).font_semibold().text_color(t.accent).child(c.name.toUpperCase()))
      .child(item("go", p.pane ? "Go to its terminal" : "Peek at it", t.foreground, () => visit({ pane: p.pane, address: p.terminal })))
      .child(item("stop", "Interrupt its turn", t.foreground, () => { hc(["interrupt", p.terminal]).catch(() => {}); }))
      .child(item("recall", "Recall (close it)", t.blocked, () => (p.pane ? run("pane.close", { pane: p.pane }) : run("terminal.kill", { terminal: p.terminal }))));
  }

  // ---- champion select ----
  initSelect(cx) {
    const first = props()?.pick;
    this.picks = first ? [first] : [];
    this.task = "";
    this.input = InputState.new({ placeholder: "What should the lead do first? (optional)" });
    this.input.on("change", (_e, cx) => { this.task = this.input.value(); cx.notify(); });
    this.input.on("submit", () => this.lockIn());
    this.inputFocused = false;
    this.input.on("focus", (_e, cx) => { this.inputFocused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.inputFocused = false; cx.notify(); });
    this.handle = cx.focus_handle();
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
  }

  lockIn() {
    const { mine } = squadNow();
    const picks = this.picks.filter((id) => !mine.has(id)).map(byId).filter(Boolean);
    if (!picks.length) return;
    closeOverlay(props().overlay);
    // The lead last, so it is the tab left showing.
    picks.slice(1).forEach((c) => summon(c, { focus: false }));
    summon(picks[0], { task: this.task.trim() || undefined, focus: true });
  }

  select() {
    const t = theme();
    const p = props() ?? {};
    const { mine } = squadNow();
    const picks = this.picks.filter((id) => !mine.has(id));
    const lead = picks[0] ?? null;
    const toggle = (id, cx) => {
      this.picks = this.picks.includes(id) ? this.picks.filter((x) => x !== id) : [...this.picks, id];
      cx.notify();
    };
    const tile = (c) => {
      const out = mine.has(c.id);
      const on = picks.includes(c.id);
      return v_flex().id(`pick-${c.id}`).w(112).py(8).gap(3).items_center().rounded(4).border_1()
        .border_color(on ? t.accent : "#00000000").bg(on ? t.selected : "#00000000")
        .when(!out, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => toggle(c.id, cx)))
        .tooltip(out ? `${c.name} is already on the Rift` : c.job)
        .child(div().relative()
          .child(face(c, 52, on ? t.accent : TEAM[c.side], out))
          .when(lead === c.id, (el) => el.child(div().absolute().top(-6).left(8).px(4).rounded(2).bg(t.accent).text_size(8.5).font_bold().text_color(t.accent_foreground).child("LEAD"))))
        .child(div().font_family(DISPLAY).text_size(11.5).font_semibold().text_color(out ? t.dim : t.foreground).child(c.name))
        .child(div().text_size(9.5).text_color(out ? t.dim : TEAM[c.side]).child(out ? "ON THE RIFT" : c.lane));
    };
    const row = (label, color, side) => v_flex().gap(4)
      .child(div().text_size(10).font_semibold().text_color(color).child(label))
      .child(h_flex().gap(6).children(ROSTER.filter((c) => c.side === side).map(tile)));
    const comp = ([name, ids]) => div().id(`comp-${name}`).px(10).h(26).flex().items_center().rounded(13).border_1().border_color(t.input)
      .text_size(11.5).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover).border_color(t.accent))
      .tooltip(ids.map((id) => byId(id)?.name).join(", ") + ". The first one leads.")
      .on_click((_e, cx) => { this.picks = [...ids]; cx.notify(); }).child(name);
    const names = picks.map((id) => byId(id)?.name);
    return v_flex().id("rift-select").track_focus(this.handle)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .w_full().min_h(0).p(18).gap(12).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center()
        .child(div().flex_1().font_family(DISPLAY).text_size(17).font_semibold().text_color(t.accent).child("CHOOSE YOUR CHAMPIONS"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(h_flex().gap(6).items_center().child(div().text_size(10).font_semibold().text_color(t.muted).child("COMPS")).children(COMPS.map(comp)))
      .child(row("BLUE SIDE · BUILD", TEAM.blue, "blue"))
      .child(row("RED SIDE · UPKEEP", TEAM.red, "red"))
      .child(row("NEUTRAL · OBJECTIVES", TEAM.none, "none"))
      .child(Input.new(this.input).h(36).px(10).rounded(4).border_1().border_color(this.inputFocused ? t.accent : t.input).bg(t.background).text_size(12.8).text_color(t.foreground))
      .child(h_flex().gap(10).items_center()
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.muted)
          .child(picks.length === 0 ? "Pick one or more champions, or a comp."
            : picks.length === 1 ? `${names[0]} joins the current space.`
            : `${names[0]} leads and gets the task. ${names.slice(1).join(", ")} wait for a handoff.`))
        .child(div().id("lock-in").px(18).h(34).flex().items_center().rounded(3).font_family(DISPLAY).text_size(13).font_semibold()
          .bg(picks.length ? t.solid : t.raised).text_color(picks.length ? t.solid_foreground : t.dim)
          .when(picks.length > 0, (el) => el.cursor_pointer().hover((s) => s.opacity(0.88)).on_click(() => this.lockIn()))
          .child("LOCK IN")));
  }

  // ---- scoreboard ----
  score() {
    const t = theme();
    const p = props() ?? {};
    const { mine } = squadNow(this.act);
    const now = Date.now();
    const tabs = new Map(spaces().flatMap((s) => s.tabs.map((tab) => [tab.id, tab])));
    const cell = (w, child) => div().w(w).flex_none().truncate().child(child);
    const head = h_flex().h(22).px(8).gap(8).items_center().text_size(10).font_semibold().text_color(t.dim)
      .child(cell(190, "CHAMPION")).child(cell(96, "ROLE")).child(cell(150, "STATE")).child(cell(56, "FOR"))
      .child(div().flex_1().child("CONTEXT LEFT")).child(div().w(54).flex_none().flex().justify_end().child("COST"));
    const line = (c) => {
      const a = mine.get(c.id);
      const act = this.act[c.id] ?? {};
      const hp = a ? left(this.ctx, c.id) : null;
      const cost = a ? this.ctx[c.id]?.cost : null;
      const working = a?.tab ? tabs.get(a.tab)?.working_since : null;
      const state = !a ? "Not summoned"
        : a.status === "blocked" ? (act.needs === "answer" ? "Has a question" : act.needs === "approve" ? "Needs approval" : "Pinged you")
        : a.status === "working" ? (this.campOf(c, now) ? `Working: ${this.campOf(c, now)}` : "Working")
        : WORD[a.status] ?? a.status;
      return h_flex().id(`score-${c.id}`).h(34).px(8).gap(8).items_center().rounded(4).text_size(12)
        .when(Boolean(a), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => { closeOverlay(p.overlay); visit(a); }))
        .child(h_flex().w(190).flex_none().gap(8).items_center()
          .child(face(c, 24, a ? TEAM[c.side] : t.input, !a))
          .child(div().min_w(0).truncate().font_semibold().text_color(a ? t.foreground : t.dim).child(c.name)))
        .child(cell(96, div().text_size(10.5).text_color(a ? TEAM[c.side] : t.dim).child(c.lane)))
        .child(h_flex().w(150).flex_none().gap(6).items_center()
          .when(Boolean(a), (el) => el.child(statusMark(t, a.status)))
          .child(div().min_w(0).truncate().text_color(a ? (a.status === "blocked" ? t.blocked : t.foreground) : t.dim).child(state)))
        .child(cell(56, div().text_color(t.muted).child(a?.status === "working" && working ? since(working, now) : "")))
        .child(h_flex().flex_1().min_w(0).gap(8).items_center()
          .when(hp !== null, (el) => el
            .child(div().w(120).flex_none().h(6).rounded(3).bg(t.background).child(div().h(6).rounded(3).w(Math.max(3, (hp / 100) * 120)).bg(healthColor(hp))))
            .child(div().w(34).flex_none().text_size(11).text_color(healthColor(hp)).child(`${Math.round(hp)}%`))))
        .child(div().w(54).flex_none().flex().justify_end().text_color(t.muted).child(typeof cost === "number" ? `$${cost.toFixed(2)}` : ""));
    };
    const order = [...ROSTER].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));
    const events = [...feed()].reverse().slice(0, 8);
    return v_flex().id("rift-score").w_full().min_h(0).p(18).gap(6).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center()
        .child(div().flex_1().font_family(DISPLAY).text_size(17).font_semibold().text_color(t.accent).child("SCOREBOARD"))
        .child(div().text_size(11).text_color(t.dim).child(`${mine.size}/${ROSTER.length} on the Rift · Esc`)))
      .child(head)
      .children(order.map(line))
      .child(div().pt(8).font_family(DISPLAY).text_size(10.5).font_semibold().text_color(t.accent).child("EVENTS"))
      .when(events.length === 0, (el) => el.child(div().px(8).text_size(11.5).text_color(t.dim).child("Nothing has happened yet.")))
      .children(events.map((e) => h_flex().h(20).px(8).gap(10).items_center()
        .child(div().w(36).flex_none().text_size(10.5).text_color(t.dim).child(clock(e.at)))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t[e.color] ?? t.muted).child(e.text))));
  }

  // ---- notifications, as an announcement ----
  toast() {
    const t = theme();
    const p = props() ?? {};
    const agent = agents().find((a) => a.address === p.action?.args?.terminal) ?? null;
    const c = agent ? champOf(agent) : null;
    const color = t[{ error: "blocked", warning: "blocked", success: "done", info: "accent" }[p.level] ?? "accent"];
    let title = String(p.title ?? "");
    if (c && agent.program?.name && title.startsWith(agent.program.name)) title = c.name + title.slice(agent.program.name.length);
    return h_flex().id("rift-toast").size_full().px(16).gap(12).items_center().bg(t.popover).border_t(2).border_color(color).cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(c ? face(c, 34, color, false) : p.icon ? image(p.icon).w(20).h(20).flex_none() : image(`${ART}/crest.svg`).w(22).h(22).flex_none())
      .child(v_flex().flex_1().overflow_hidden()
        .child(div().truncate().font_family(DISPLAY).font_semibold().text_size(13).text_color(color).child(title.toUpperCase()))
        .when(Boolean(p.body), (el) => el.child(div().truncate().text_size(12).text_color(t.muted).child(p.body ?? ""))));
  }

  // ---- scout: Teemo at the edge ----
  scout() {
    const t = theme();
    const teemo = byId("teemo") ?? ROSTER[0];
    const all = agents();
    const waiting = all.filter((a) => a.status === "blocked" && !a.focused);
    const finished = all.filter((a) => a.status === "done" && !a.focused);
    const working = all.filter((a) => a.status === "working");
    const news = waiting[0] ?? finished[0] ?? null;
    let head = "All quiet on the Rift";
    let body = all.length ? "Nobody needs you. Scouting ahead." : "No champions out. Summon one from the map.";
    let color = t.muted;
    if (waiting.length) {
      head = waiting.length === 1 ? `${who(waiting[0])} pinged you` : `${waiting.length} champions pinged you`;
      body = `${waiting[0].space_name} is waiting on an answer. Click to go.`;
      color = t.blocked;
    } else if (finished.length) {
      head = finished.length === 1 ? `${who(finished[0])} finished` : `${finished.length} finished`;
      body = "Finished while you were away. Click to look.";
      color = t.done;
    } else if (working.length) {
      head = `${working.length} working`;
      body = working.map(who).slice(0, 3).join(", ") + (working.length > 3 ? " and more" : "") + (working.length === 1 ? " is" : " are") + " in lane.";
      color = t.working;
    }
    const right = placement()?.edge !== "left";
    const face40 = div().relative().flex_none().w(40).h(40)
      .when(Boolean(news), (el) => el.loop("top", { from: 0, to: -4, period: 700 }))
      .child(face(teemo, 40, news ? color : t.input, false))
      .when(waiting.length > 0, (el) => el.child(div().absolute().top(-3).right(-3).size(15).rounded(8).bg(t.blocked)
        .flex().items_center().justify_center().text_size(9.5).font_bold().text_color("#ffffff").child(String(waiting.length))));
    const text = v_flex().w(190).gap(2)
      .when(right, (el) => el.items_end())
      .child(div().font_family(DISPLAY).text_size(12).font_semibold().text_color(color).truncate().child(head))
      .child(div().text_size(11).text_color(t.muted).child(body));
    return h_flex().id("scout").px(8).py(6).gap(10).items_center().cursor_pointer()
      .on_click(() => {
        if (news) run("agent.focus", { terminal: news.address });
        else {
          const a = all.find((x) => champOf(x)?.id === teemo.id);
          if (a) run("pane.focus", { pane: a.pane });
        }
      })
      .children(right ? [text, face40] : [face40, text]);
  }
}
