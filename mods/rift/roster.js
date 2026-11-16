// The squad. Edit freely: saving reloads the panel.
//   id    -> art/<id>.svg (portrait) and roles/<id>.md (the brief the agent starts with)
//   name  -> the tab name. Any agent in a tab that starts with this name wears the portrait.
//   run   -> the command that starts the agent (default: claude)
export const ROSTER = [
  { id: "teemo", name: "Teemo", title: "the Swift Scout", lane: "SCOUT",
    job: "Scouts the field: new projects, features, fixes and concepts. Reads and reports, never edits." },
  { id: "heimerdinger", name: "Heimerdinger", title: "the Revered Inventor", lane: "FIRMWARE",
    job: "Builds firmware: drivers, BLE, DFU, power, board bring-up." },
  { id: "jhin", name: "Jhin", title: "the Virtuoso", lane: "TESTS",
    job: "Writes test automation: cases, suites, HIL steps, fixtures." },
  { id: "caitlyn", name: "Caitlyn", title: "the Sheriff", lane: "DEBUG",
    job: "Investigates: logs, traces, resets, flaky tests. Finds the root cause with evidence." },
  { id: "braum", name: "Braum", title: "the Shield", lane: "REVIEW",
    job: "Guards the branch: reviews diffs, runs the checks, blocks what is not ready." },
  { id: "ryze", name: "Ryze", title: "the Rune Mage", lane: "DOCS",
    job: "Keeps the scrolls: ADRs, SOPs, changelogs, reports." },
  { id: "twistedfate", name: "Twisted Fate", title: "the Card Master", lane: "FLEET",
    job: "Releases and fleet: packaging, rollouts, station health. Asks before touching a station." },
  { id: "bard", name: "Bard", title: "the Wandering Caretaker", lane: "SIDE QUESTS",
    job: "Roams between lanes: dashboards, scripts, exports and other side jobs." },
];
