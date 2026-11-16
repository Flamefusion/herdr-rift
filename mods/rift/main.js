// Rift: a League-themed squad for Herdr, shown on the Summoner's Rift minimap.
//   props.role "brand"  the title strip above the map
//   props.role "map"    the map: every champion stands where its state puts it
//   props.role "scout"  Teemo, floating at the edge, reporting who needs you
// The squad is roster.js; each champion's brief is roles/<id>.md.
//
// Where a champion stands:
//   idle      its own fountain
//   working   its own lane (top, jungle, mid, bot, support) or objective (dragon, baron, river)
//   a camp    a long task of that kind (reported by bin/rift-hook, shown after CAMP_AFTER_MS)
//   together  beside a squad mate it just messaged (bin/rift-tell), at the nearer scuttle
//   blocked   where it was, with a red ping
//   done      its own nexus

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, spaces, run, theme, props, window, layout, shared, setShared, setAgentOrder, appHome, placement, readTextFile, checking } from "herdr";
import { ROSTER } from "./roster.js";

const ART = "mods/rift/art";
const ICONS = "mods/workspace-chrome";
const DISPLAY = "Copperplate";
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const WORD = { working: "Working", blocked: "Pinged you", done: "Finished", idle: "At the fountain" };
const CAMP_AFTER_MS = 10000;
const TALK_FOR_MS = 90000;
const SIDEBAR_WIDTH = 440;
const TEAM = { blue: "#3f8fd8", red: "#e84057", none: "#c8aa6e" };

// Everything below is in percent of the map image (0,0 top left).
const LANE = {
  blue: { top: [9, 45, "y"], jungle: [36, 74, null], mid: [40, 60, "d"], bot: [54, 91, "x"], support: [38, 91, null] },
  red: { top: [55, 9, "x"], jungle: [64, 26, null], mid: [60, 40, "d"], bot: [91, 54, "y"], support: [91, 38, null] },
  none: { dragon: [67, 70, null], baron: [33, 29, null], river: [50, 50, null] },
};
// Kept a marker's width in from the map's edge so the name under it is not cut off.
const FOUNTAIN = {
  blue: { top: [8, 72], jungle: [8, 81], mid: [9, 90], bot: [18, 90], support: [27, 90] },
  red: { top: [92, 28], jungle: [92, 19], mid: [91, 8], bot: [82, 8], support: [73, 8] },
};
const NEXUS = {
  blue: { top: [17, 72], jungle: [17, 81], mid: [26, 81], bot: [26, 72], support: [35, 84] },
  red: { top: [83, 28], jungle: [83, 19], mid: [74, 17], bot: [74, 26], support: [65, 14] },
};
const CAMPS = {
  blue: { research: [25, 48], waiting: [15, 43], search: [27, 57], tests: [47, 65], hardware: [53, 75], build: [57, 84] },
  red: { research: [75, 52], waiting: [85, 57], search: [73, 43], tests: [53, 35], hardware: [47, 25], build: [43, 16] },
};
const SCUTTLE = { top: [26, 38], bot: [74, 62] };
const LABELS = [
  ["Baron: release", 33, 22, "#b678dd"], ["Dragon: nightly", 67, 77, "#f0d896"],
  ["Scuttle: handoff", 26, 32, "#0ac8b9"], ["Scuttle: handoff", 74, 68, "#0ac8b9"],
  ...Object.entries(CAMPS.blue).map(([k, [x, y]]) => [k, x, y, null]),
  ...Object.entries(CAMPS.red).map(([k, [x, y]]) => [k, x, y, null]),
];

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

// The champion whose name a tab starts with ("Teemo", "Teemo 2"), longest name first.
const BY_LENGTH = [...ROSTER].sort((a, b) => b.name.length - a.name.length);
function champOf(agent) {
  const tab = (agent?.tab_name ?? "").toLowerCase();
  return BY_LENGTH.find((c) => tab === c.name.toLowerCase() || tab.startsWith(c.name.toLowerCase() + " ")) ?? null;
}

function summon(c) {
  const space = spaces().find((s) => s.active);
  const base = `${appHome()}/mods/rift`;
  const argv = [...(c.run ?? ["claude"]), "--append-system-prompt-file", `${base}/roles/${c.id}.md`, "--settings", `${base}/settings/${c.id}.json`, "-n", c.name];
  run("tab.new", { name: c.name, space: space?.id, argv });
}

const who = (a) => champOf(a)?.name ?? a.program?.name ?? "An agent";
const postOf = (c) => (c.side === "none" ? c.post : `${c.side} ${c.post}`);

// Each champion's agent: the most urgent one in a tab with its name. The rest are minions.
function squadNow() {
  const mine = new Map();
  const minions = [];
  for (const a of agents()) {
    const c = champOf(a);
    if (!c) { minions.push(a); continue; }
    const cur = mine.get(c.id);
    if (!cur || (RANK[a.status] ?? 0) > (RANK[cur.status] ?? 0)) mine.set(c.id, a);
  }
  return { mine, minions };
}

function face(c, size, ring, dim) {
  return div().w(size).h(size).flex_none().rounded(size / 2).border(2).border_color(ring).overflow_hidden()
    .when(dim, (el) => el.opacity(0.4))
    .child(image(`${ART}/${c.id}.png`).w(size - 4).h(size - 4).rounded((size - 4) / 2));
}

function statusMark(t, status) {
  if (status === "working") return svg(`${ICONS}/spinner.svg`).size(12).flex_none().text_color(t.working).spin(900);
  if (status === "blocked") return div().size(8).flex_none().rounded(4).bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 900 });
  if (status === "done") return div().size(8).flex_none().rounded(4).bg(t.done);
  return div().size(8).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
}

export default class Rift extends View {
  init(_props, cx) {
    this.size = null;
    this.act = {};
    this.talks = [];
    this.key = "";
    if (props()?.role !== "map" || checking()) return;
    cx.timer.every(3000, (cx) => this.refresh(cx));
    this.refresh(cx);
  }

  // Reads what the hooks and rift-tell wrote. Redraws only when a champion would move.
  refresh(cx) {
    cx.spawn(async (cx) => {
      const dir = `${appHome()}/rift-state`;
      const act = {};
      for (const c of ROSTER) {
        try {
          const text = await readTextFile(`${dir}/${c.id}.json`);
          if (text) act[c.id] = JSON.parse(text);
        } catch { /* a half-written or missing file: no activity */ }
      }
      let talks = [];
      try {
        const text = await readTextFile(`${dir}/handoffs.jsonl`);
        if (text) talks = text.trim().split("\n").slice(-30).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      } catch { /* no log yet */ }
      this.act = act;
      this.talks = talks;
      const now = Date.now();
      const key = JSON.stringify([ROSTER.map((c) => this.campOf(c, now)), this.pairs(now)]);
      if (key !== this.key) { this.key = key; cx.notify(); }
    });
  }

  // The camp a champion is at: a reported activity that has lasted long enough.
  campOf(c, now) {
    const a = this.act[c.id];
    if (!a?.activity || now - (a.since ?? now) < CAMP_AFTER_MS) return null;
    return a.activity;
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

  render(cx) {
    const role = props()?.role;
    if (role === "brand") return this.brand();
    if (role === "scout") return this.scout();
    return this.map();
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
        const where = camp && CAMPS[team ?? "blue"][camp];
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
      out.set(from, { x: s[0] - 5, y: s[1], pace: null, at: "handoff" });
      out.set(to, { x: s[0] + 5, y: s[1], pace: null, at: "handoff" });
      links.push(s);
    }
    // Any two still on the same spot: nudge the later one aside.
    const used = [];
    for (const spot of out.values()) {
      if (spot.at !== "handoff") while (used.some((u) => Math.abs(u.x - spot.x) < 7 && Math.abs(u.y - spot.y) < 7)) spot.x += spot.x < 50 ? 8 : -8;
      used.push(spot);
    }
    return { out, links };
  }

  marker(t, c, a, spot, S, M) {
    const ring = a.status === "blocked" ? t.blocked : a.status === "done" ? t.done : a.status === "working" ? t.working : t.input;
    const step = S * 0.07;
    // Pacing lives on inner wrappers so the outer element can glide to a new spot.
    let body = div().relative().w(M).h(M)
      .child(face(c, M, ring, false))
      .when(a.status === "working", (el) => el.child(svg(`${ICONS}/spinner.svg`).absolute().left(-4).top(-4).size(M + 8).text_color(t.working).spin(900)))
      .when(a.status === "blocked", (el) => el
        .child(div().absolute().left(-6).top(-6).w(M + 12).h(M + 12).rounded((M + 12) / 2).border(3).border_color(t.blocked).loop("opacity", { from: 0.15, to: 1, period: 900 }))
        .child(div().absolute().top(-6).right(-6).size(15).rounded(8).bg(t.blocked).flex().items_center().justify_center().text_size(10).font_bold().text_color("#ffffff").child("!")))
      .when(a.status === "done", (el) => el.child(div().absolute().top(-5).right(-5).size(13).rounded(7).bg(t.done).border(1.5).border_color(t.canvas)))
      .when(Boolean(a.focused), (el) => el.child(div().absolute().left(-3).top(-3).w(M + 6).h(M + 6).rounded((M + 6) / 2).border_1().border_color(t.foreground)));
    if (spot.pace === "y" || spot.pace === "d") body = div().relative().child(body).loop("top", { from: -step, to: step, period: 7000 });
    if (spot.pace === "x") body = div().relative().child(body).loop("left", { from: -step, to: step, period: 6000 });
    if (spot.pace === "d") body = div().relative().child(body).loop("left", { from: step, to: -step, period: 7000 });
    return div().id(`m-${c.id}`).absolute().left((spot.x / 100) * S - M / 2).top((spot.y / 100) * S - M / 2).w(M).h(M)
      .transition("left", { duration: 1200, easing: "ease-in-out" }).transition("top", { duration: 1200, easing: "ease-in-out" })
      .cursor_pointer().tooltip(`${c.name}, ${postOf(c)} (${c.lane.toLowerCase()}): ${WORD[a.status] ?? a.status}${spot.at && !["fountain", "nexus", postOf(c)].includes(spot.at) ? `, ${spot.at}` : ""}`)
      .on_click(() => run("pane.focus", { pane: a.pane }))
      .child(body)
      .child(div().absolute().left(M / 2 - 30).top(M + 3).w(60).flex().justify_center()
        .child(div().px(4).rounded(2).bg(TEAM[c.side] + "cc").text_size(9.5).text_color("#ffffff").whitespace_nowrap().child(c.short)));
  }

  map() {
    const t = theme();
    const { mine, minions } = squadNow();
    const live = ROSTER.filter((c) => mine.has(c.id));
    const bench = ROSTER.filter((c) => !mine.has(c.id));
    setAgentOrder([...live.map((c) => mine.get(c.id).address), ...minions.map((a) => a.address)]);

    if (narrow()) {
      return v_flex().id("rift-rail").size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.border).pt(8).gap(6).items_center().overflow_y_scrollbar()
        .children(ROSTER.map((c) => {
          const a = mine.get(c.id);
          return div().id(`rail-${c.id}`).relative().flex_none().cursor_pointer().tooltip(a ? `${c.name}: ${WORD[a.status] ?? a.status}` : `Summon ${c.name}`)
            .on_click(() => (a ? run("pane.focus", { pane: a.pane }) : summon(c)))
            .child(face(c, 28, a ? (t[a.status] ?? t.input) : t.input, !a));
        }));
    }

    const W = this.size?.width ?? SIDEBAR_WIDTH;
    const H = this.size?.height ?? 560;
    const S = Math.max(180, Math.floor(Math.min(W - 16, H - 134)));
    const M = S < 300 ? 24 : 30;
    const now = Date.now();
    const { out, links } = this.places(mine, now);
    const labels = shared("rift.labels") !== false && S >= 300;

    const board = div().relative().w(S).h(S).flex_none().rounded(3).border_1().border_color(t.input).bg("#000000").overflow_hidden()
      .child(image(`${ART}/map.png`).absolute().left(0).top(0).w(S).h(S))
      .when(labels, (el) => el.children(LABELS.map(([text, x, y, color]) =>
        div().absolute().left((x / 100) * S - 45).top((y / 100) * S + (color ? -7 : 12)).w(90).flex().justify_center()
          .child(div().px(4).rounded(7).bg("#010a13b3").text_size(color ? 9.5 : 8.5).text_color(color ?? t.muted).whitespace_nowrap().child(text)))))
      .children(links.map((s) => div().absolute().left((s[0] / 100) * S - 12).top((s[1] / 100) * S - 1).w(24).h(2).bg(t.working).loop("opacity", { from: 0.2, to: 1, period: 1400 })))
      .children(live.map((c) => this.marker(t, c, mine.get(c.id), out.get(c.id), S, M)));

    const benchRow = h_flex().flex_wrap().gap(5).items_center()
      .children(bench.map((c) => div().id(`bench-${c.id}`).flex_none().cursor_pointer().rounded(15).hover((s) => s.bg(t.hover))
        .tooltip(`Summon ${c.name}, ${postOf(c)} (${c.lane.toLowerCase()}). ${c.job}`)
        .on_click(() => summon(c))
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
      .child(v_flex().id("rift-below").w(S).flex_1().min_h(0).gap(2).overflow_y_scrollbar()
        .when(bench.length > 0, (el) => el.child(heading("NOT SUMMONED", `${live.length}/${ROSTER.length} on the Rift`)).child(benchRow))
        .when(minions.length > 0, (el) => el.child(heading("MINIONS", String(minions.length))).children(minions.map(minion))));
  }

  // ---- scout: Teemo at the edge ----
  scout() {
    const t = theme();
    const teemo = ROSTER.find((c) => c.id === "teemo") ?? ROSTER[0];
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
