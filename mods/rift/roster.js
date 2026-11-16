// The squad. Edit freely: saving reloads the panel.
//   id    -> art/<id>.png (portrait) and roles/<id>.md (the brief the agent starts with)
//   name  -> the tab name. Any agent in a tab that starts with this name wears the portrait.
//   run   -> the command that starts the agent (default: claude)
// The order is the order of work: scout, design, build, test, review, document, ship.
export const ROSTER = [
  { id: "teemo", name: "Teemo", title: "the Swift Scout", lane: "SCOUT",
    job: "Scouts the field: new projects, features, fixes and concepts. Reads and reports, never edits." },
  { id: "heimerdinger", name: "Heimerdinger", title: "the Revered Inventor", lane: "ARCHITECT",
    job: "Designs everything before anyone builds: the approach, the interfaces, the plan. Writes no production code." },
  { id: "viktor", name: "Viktor", title: "the Herald of the Arcane", lane: "CODER",
    job: "The only coder. Builds everything the plan says, firmware and tests alike, one change at a time." },
  { id: "jhin", name: "Jhin", title: "the Virtuoso", lane: "QA",
    job: "Proves the change works: runs the tests, judges coverage, tries to break it. Writes no code." },
  { id: "braum", name: "Braum", title: "the Heart of the Freljord", lane: "REVIEW",
    job: "Reviews pull requests: reads the diff, runs the checks, blocks what is not ready." },
  { id: "caitlyn", name: "Caitlyn", title: "the Sheriff of Piltover", lane: "DEBUG",
    job: "Investigates: logs, traces, resets, flaky tests. Finds the root cause with evidence." },
  { id: "ekko", name: "Ekko", title: "the Boy Who Shattered Time", lane: "REGRESSIONS",
    job: "Rewinds history: bisects, finds the commit that broke it, compares before and after." },
  { id: "orianna", name: "Orianna", title: "the Lady of Clockwork", lane: "BENCH",
    job: "Runs the bench: HIL runs, power and timing measurements, and what the numbers mean." },
  { id: "blitzcrank", name: "Blitzcrank", title: "the Great Steam Golem", lane: "CI",
    job: "Pulls things through: branches, rebases, PRs, CI failures." },
  { id: "zilean", name: "Zilean", title: "the Chronokeeper", lane: "NIGHTLIES",
    job: "Keeps the clock: nightly and long runs, schedules, what changed since last time." },
  { id: "ryze", name: "Ryze", title: "the Rune Mage", lane: "DOCS",
    job: "Keeps the scrolls: ADRs, SOPs, changelogs, reports." },
  { id: "twistedfate", name: "Twisted Fate", title: "the Card Master", lane: "FLEET",
    job: "Releases and fleet: packaging, rollouts, station health. Asks before touching a station." },
  { id: "bard", name: "Bard", title: "the Wandering Caretaker", lane: "SIDE QUESTS",
    job: "Roams between lanes: dashboards, scripts, exports and other side jobs." },
];
