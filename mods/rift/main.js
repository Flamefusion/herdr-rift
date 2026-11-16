// Rift: a League-themed squad for Herdr.
//   props.role "brand"  the title strip above the sidebar
//   props.role "squad"  the champion roster: who is on the Rift, summon the rest
//   props.role "scout"  Teemo, floating at the edge, reporting who needs you
// The roster is roster.js; each champion's brief is roles/<id>.md.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, spaces, run, theme, props, window, layout, shared, setShared, setAgentOrder, appHome, placement } from "herdr";
import { ROSTER } from "./roster.js";

const ART = "mods/rift/art";
const ICONS = "mods/workspace-chrome";
const DISPLAY = "Copperplate";
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const WORD = { working: "In lane", blocked: "Pinged you", done: "Objective taken", idle: "At base" };

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
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

// The champion whose name a tab starts with ("Teemo", "Teemo 2"), longest name first.
const BY_LENGTH = [...ROSTER].sort((a, b) => b.name.length - a.name.length);
function champOf(agent) {
  const tab = (agent?.tab_name ?? "").toLowerCase();
  return BY_LENGTH.find((c) => tab === c.name.toLowerCase() || tab.startsWith(c.name.toLowerCase() + " ")) ?? null;
}

function summon(c) {
  const space = spaces().find((s) => s.active);
  const argv = [...(c.run ?? ["claude"]), "--append-system-prompt-file", `${appHome()}/mods/rift/roles/${c.id}.md`, "-n", c.name];
  run("tab.new", { name: c.name, space: space?.id, argv });
}

const who = (a) => champOf(a)?.name ?? a.program?.name ?? "An agent";

function portrait(c, size, t, live) {
  // Riot's square icon, cut round, in a gold ring.
  return image(`${ART}/${c.id}.png`).w(size).h(size).flex_none().rounded(size / 2).border_1().border_color(live ? t.accent : t.input).when(!live, (el) => el.opacity(0.38));
}

function statusMark(t, status) {
  if (status === "working") return svg(`${ICONS}/spinner.svg`).size(12).flex_none().text_color(t.working).spin(900);
  if (status === "blocked") return div().size(8).flex_none().rounded(4).bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 900 });
  if (status === "done") return div().size(8).flex_none().rounded(4).bg(t.done);
  return div().size(8).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
}

export default class Rift extends View {
  init() {
    this.hovered = null;
  }

  render(cx) {
    const role = props()?.role;
    if (role === "brand") return this.brand();
    if (role === "scout") return this.scout();
    return this.squad();
  }

  // ---- brand ----
  brand() {
    const t = theme();
    const collapsed = narrow();
    const button = (id, icon, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(4)
      .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.accent))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action)
      .child(svg(`${ICONS}/${icon}.svg`).size(15));
    const mac = window()?.platform === "macos";
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center()
      .when(mac && !window()?.fullscreen && !collapsed, (el) => el.pl(76))
      .when(!collapsed, (el) => el.child(h_flex().flex_1().min_w(0).gap(8).items_center()
        .child(image(`${ART}/crest.svg`).w(20).h(20).flex_none())
        .child(div().font_family(DISPLAY).text_size(14).font_semibold().text_color(t.accent).truncate().child("THE RIFT"))))
      .when(!collapsed, (el) => el.child(button("search", "search", () => run("mod.open", { name: "picker" }))))
      .when(!(collapsed && mac), (el) => el.child(button("sidebar-toggle", "sidebar", toggleSidebar)));
  }

  // ---- squad ----
  squad() {
    const t = theme();
    const collapsed = narrow();
    const all = agents();
    // Each champion's agent: the most urgent one in a tab with their name.
    const mine = new Map();
    const minions = [];
    for (const a of all) {
      const c = champOf(a);
      if (!c) { minions.push(a); continue; }
      const cur = mine.get(c.id);
      if (!cur || (RANK[a.status] ?? 0) > (RANK[cur.status] ?? 0)) mine.set(c.id, a);
    }
    const live = ROSTER.filter((c) => mine.has(c.id));
    setAgentOrder([...live.map((c) => mine.get(c.id).address), ...minions.map((a) => a.address)]);

    if (collapsed) {
      return v_flex().id("squad-rail").size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.border).pt(8).gap(6).items_center().overflow_y_scrollbar()
        .children(ROSTER.map((c) => {
          const a = mine.get(c.id);
          return div().id(`rail-${c.id}`).relative().flex_none().cursor_pointer().tooltip(a ? `${c.name}: ${WORD[a.status] ?? a.status}` : `Summon ${c.name}`)
            .on_click(() => (a ? run("pane.focus", { pane: a.pane }) : summon(c)))
            .child(portrait(c, 28, t, Boolean(a)))
            .when(Boolean(a) && a.status !== "idle", (el) => el.child(div().absolute().right(-1).bottom(-1).size(8).rounded(4).bg(t[a.status] ?? t.dim)));
        }));
    }

    const card = (c) => {
      const a = mine.get(c.id);
      const on = Boolean(a);
      const hot = this.hovered === c.id;
      return h_flex().id(`champ-${c.id}`).h(50).px(8).gap(10).flex_none().items_center().rounded(4).cursor_pointer()
        .border_1().border_color(a?.focused ? t.input : t.chrome)
        .when(Boolean(a?.focused), (el) => el.bg(t.selected))
        .hover((s) => s.bg(t.hover))
        .tooltip(c.job)
        .on_hover((over, cx) => {
          if (over) this.hovered = c.id;
          else if (this.hovered === c.id) this.hovered = null;
          cx.notify();
        })
        .on_click(() => (on ? run("pane.focus", { pane: a.pane }) : summon(c)))
        .child(portrait(c, 36, t, on))
        .child(v_flex().flex_1().min_w(0).gap(1)
          .child(div().font_family(DISPLAY).text_size(13).font_semibold().truncate().text_color(on ? t.foreground : t.muted).child(c.name))
          .child(div().text_size(10.5).truncate().text_color(t.dim).child(on ? c.title : c.lane)))
        .when(on, (el) => el.child(h_flex().flex_none().gap(6).items_center()
          .child(div().text_size(10.5).text_color(t[a.status] ?? t.dim).child(WORD[a.status] ?? a.status))
          .child(statusMark(t, a.status))))
        .when(!on && hot, (el) => el.child(div().flex_none().px(7).h(20).flex().items_center().rounded(3).border_1().border_color(t.input)
          .text_size(10.5).font_semibold().text_color(t.accent).child("SUMMON")));
    };

    const minion = (a) => h_flex().id(`minion-${a.address}`).h(28).px(8).gap(9).flex_none().items_center().rounded(4).cursor_pointer()
      .when(a.focused, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
      .on_click(() => run("pane.focus", { pane: a.pane }))
      .when(Boolean(a.program?.icon), (el) => el.child(a.program.tint
        ? svg(a.program.icon).size(15).flex_none().text_color(t.muted)
        : image(a.program.icon).w(15).h(15).flex_none()))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.muted)
        .child(`${a.program?.name ?? a.app ?? "Agent"} · ${a.space_name}${/^\d+$/.test(a.tab_name) ? "" : " / " + a.tab_name}`))
      .child(statusMark(t, a.status));

    const heading = (label, right) => h_flex().px(8).h(30).pt(6).flex_none().items_center().justify_between()
      .child(div().font_family(DISPLAY).text_size(11).font_semibold().text_color(t.accent).child(label))
      .child(div().text_size(10.5).text_color(t.dim).child(right));

    return v_flex().size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.border).text_size(13)
      .child(v_flex().id("squad-list").flex_1().min_h(0).px(8).pb(8).gap(2).overflow_y_scrollbar()
        .child(heading("SQUAD", `${live.length}/${ROSTER.length} on the Rift`))
        .children(ROSTER.map(card))
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
    let body = all.length ? "Nobody needs you. Scouting ahead." : "No champions out. Summon one from the squad.";
    let color = t.muted;
    if (waiting.length) {
      head = waiting.length === 1 ? `${who(waiting[0])} pinged you` : `${waiting.length} champions pinged you`;
      body = `${waiting[0].space_name} is waiting on an answer. Click to go.`;
      color = t.blocked;
    } else if (finished.length) {
      head = finished.length === 1 ? `${who(finished[0])} took the objective` : `${finished.length} objectives taken`;
      body = "Finished while you were away. Click to look.";
      color = t.done;
    } else if (working.length) {
      head = `${working.length} in lane`;
      body = working.map(who).slice(0, 3).join(", ") + (working.length > 3 ? " and more" : "") + (working.length === 1 ? " is" : " are") + " working.";
      color = t.working;
    }
    const right = placement()?.edge !== "left";
    const face = div().relative().flex_none().w(40).h(40)
      .when(Boolean(news), (el) => el.loop("top", { from: 0, to: -4, period: 700 }))
      .child(portrait(teemo, 40, t, true))
      .when(waiting.length > 0, (el) => el.child(div().absolute().top(-3).right(-3).size(15).rounded(8).bg(t.blocked)
        .flex().items_center().justify_center().text_size(9.5).font_bold().text_color("#ffffff").child(String(waiting.length))));
    const text = v_flex().w(190).gap(2)
      .when(right, (el) => el.items_end())
      .child(div().font_family(DISPLAY).text_size(12).font_semibold().text_color(color).truncate().child(head))
      .child(div().text_size(11).text_color(t.dim).child(body));
    return h_flex().id("scout").px(8).py(6).gap(10).items_center().cursor_pointer()
      .on_click(() => {
        if (news) run("agent.focus", { terminal: news.address });
        else {
          const a = all.find((x) => champOf(x)?.id === teemo.id);
          if (a) run("pane.focus", { pane: a.pane });
        }
      })
      .children(right ? [text, face] : [face, text]);
  }
}
