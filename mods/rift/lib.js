// What every part of the Rift mod shares: the squad's names and colours, who is who among the
// live agents, how a champion is summoned, and what the hooks wrote to rift-state/.

import { div, image, svg } from "gpui-kit";
import { agents, terminals, spaces, run, appHome, readTextFile } from "herdr";
import { ROSTER } from "./roster.js";

export const ART = "mods/rift/art";
export const ICONS = "mods/workspace-chrome";
export const DISPLAY = "Copperplate";
export const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
export const WORD = { working: "Working", blocked: "Pinged you", done: "Finished", idle: "At the fountain" };
export const TEAM = { blue: "#3f8fd8", red: "#e84057", none: "#c8aa6e" };
export const NEEDS = { approve: "needs your approval", answer: "has a question for you" };
// The first champion of a comp leads: it gets the task, the rest wait for a handoff.
export const COMPS = [
  ["Feature", ["heimerdinger", "viktor", "jhin", "braum"]],
  ["Bug hunt", ["caitlyn", "ekko", "viktor", "jhin"]],
  ["Scouting", ["teemo", "heimerdinger"]],
  ["Release", ["twistedfate", "blitzcrank", "ryze"]],
  ["Bench day", ["orianna", "zilean", "caitlyn"]],
];

export const byId = (id) => ROSTER.find((c) => c.id === id) ?? null;
export const postOf = (c) => (c.side === "none" ? c.post : `${c.side} ${c.post}`);

// The champion whose name a tab starts with ("Teemo", "Teemo 2"), longest name first.
const BY_LENGTH = [...ROSTER].sort((a, b) => b.name.length - a.name.length);
export function champOf(agent) {
  const tab = (agent?.tab_name ?? "").toLowerCase();
  if (!tab) return null;
  return BY_LENGTH.find((c) => tab === c.name.toLowerCase() || tab.startsWith(c.name.toLowerCase() + " ")) ?? null;
}
export const who = (a) => champOf(a)?.name ?? a.program?.name ?? "An agent";

// Each champion's agent: the most urgent one in a tab with its name, or the terminal its hook
// reported (a champion started as a helper with `hc run teemo ...` has no tab of its own).
// The rest are minions.
export function squadNow(act = {}) {
  const mine = new Map();
  const minions = [];
  const byTerminal = new Map();
  for (const c of ROSTER) if (act[c.id]?.terminal) byTerminal.set(act[c.id].terminal, c);
  const seen = new Set();
  const take = (c, a) => {
    const cur = mine.get(c.id);
    if (!cur || (RANK[a.status] ?? 0) > (RANK[cur.status] ?? 0)) mine.set(c.id, a);
  };
  for (const a of agents()) {
    seen.add(a.address);
    const c = champOf(a) ?? byTerminal.get(a.address);
    if (c) take(c, a);
    else minions.push(a);
  }
  for (const t of terminals()) {
    const c = byTerminal.get(t.address);
    if (!c || seen.has(t.address) || t.state !== "live") continue;
    take(c, { address: t.address, pane: null, tab: null, status: RANK[t.status] ? t.status : "working", focused: false, helper: true,
      space_name: "", tab_name: c.name, program: t.program });
  }
  return { mine, minions };
}

// Goes to a champion: its pane, or a peek at a helper that has none.
export function visit(a) {
  if (a.pane) run("pane.focus", { pane: a.pane });
  else run("terminal.peek", { terminal: a.address });
}

export function summon(c, options = {}) {
  const space = spaces().find((s) => s.active);
  const base = `${appHome()}/mods/rift`;
  const argv = [...(c.run ?? ["claude"]), "--append-system-prompt-file", `${base}/roles/${c.id}.md`, "--settings", `${base}/settings/${c.id}.json`, "-n", c.name];
  const args = { name: c.name, space: space?.id, argv, focus: options.focus !== false };
  if (options.task) args.task = options.task;
  run("tab.new", args);
}

// What bin/rift-hook, bin/rift-status and bin/rift-tell wrote.
export async function loadState() {
  const dir = `${appHome()}/rift-state`;
  const json = async (file) => {
    try {
      const text = await readTextFile(`${dir}/${file}`);
      return text ? JSON.parse(text) : null;
    } catch { return null; /* missing or half-written: nothing to show */ }
  };
  const act = {};
  const ctx = {};
  for (const c of ROSTER) {
    const a = await json(`${c.id}.json`);
    if (a) act[c.id] = a;
    const x = await json(`${c.id}.ctx.json`);
    if (x) ctx[c.id] = x;
  }
  let talks = [];
  try {
    const text = await readTextFile(`${dir}/handoffs.jsonl`);
    if (text) talks = text.trim().split("\n").slice(-30).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { /* no log yet */ }
  return { act, ctx, talks };
}

// How much context a champion has left, 0..100, or null when its status line has not reported.
export function left(ctx, id) {
  const used = ctx[id]?.used;
  return typeof used === "number" ? Math.max(0, Math.min(100, 100 - used)) : null;
}
export const healthColor = (pct) => (pct > 50 ? "#3fbf7f" : pct > 20 ? "#c8aa6e" : "#e84057");

export function face(c, size, ring, dim) {
  return div().w(size).h(size).flex_none().rounded(size / 2).border(2).border_color(ring).overflow_hidden()
    .when(dim, (el) => el.opacity(0.4))
    .child(image(`${ART}/${c.id}.png`).w(size - 4).h(size - 4).rounded((size - 4) / 2));
}

export function statusMark(t, status) {
  if (status === "working") return svg(`${ICONS}/spinner.svg`).size(12).flex_none().text_color(t.working).spin(900);
  if (status === "blocked") return div().size(8).flex_none().rounded(4).bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 900 });
  if (status === "done") return div().size(8).flex_none().rounded(4).bg(t.done);
  return div().size(8).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
}

export const clock = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const since = (ms, now) => {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
