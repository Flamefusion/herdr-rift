// The squad. Edit freely: saving reloads the map.
//   id    -> art/<id>.png (portrait), roles/<id>.md (the brief), settings/<id>.json (the activity hook)
//   name  -> the tab name. Any agent in a tab that starts with this name is that champion.
//   side  -> "blue" builds new work, "red" keeps things running, "none" holds a neutral objective
//   post  -> where it stands while working: top, jungle, mid, bot, support, or dragon, baron, river
//   run   -> the command that starts the agent (default: claude)
export const ROSTER = [
  { id: "heimerdinger", name: "Heimerdinger", short: "Heimer", title: "the Revered Inventor", lane: "ARCHITECT", side: "blue", post: "top",
    job: "Designs everything before anyone builds: the approach, the interfaces, the plan. Writes no production code." },
  { id: "teemo", name: "Teemo", short: "Teemo", title: "the Swift Scout", lane: "SCOUT", side: "blue", post: "jungle",
    job: "Scouts the field: new projects, features, fixes and concepts. Reads and reports, never edits." },
  { id: "viktor", name: "Viktor", short: "Viktor", title: "the Herald of the Arcane", lane: "CODER", side: "blue", post: "mid",
    job: "The only coder. Builds everything the plan says, firmware and tests alike, one change at a time." },
  { id: "jhin", name: "Jhin", short: "Jhin", title: "the Virtuoso", lane: "QA", side: "blue", post: "bot",
    job: "Proves the change works: runs the tests, judges coverage, tries to break it. Writes no code." },
  { id: "braum", name: "Braum", short: "Braum", title: "the Heart of the Freljord", lane: "REVIEW", side: "blue", post: "support",
    job: "Reviews pull requests: reads the diff, runs the checks, blocks what is not ready." },
  { id: "ryze", name: "Ryze", short: "Ryze", title: "the Rune Mage", lane: "DOCS", side: "red", post: "top",
    job: "Keeps the scrolls: ADRs, SOPs, changelogs, reports." },
  { id: "ekko", name: "Ekko", short: "Ekko", title: "the Boy Who Shattered Time", lane: "REGRESSIONS", side: "red", post: "jungle",
    job: "Rewinds history: bisects, finds the commit that broke it, compares before and after." },
  { id: "orianna", name: "Orianna", short: "Orianna", title: "the Lady of Clockwork", lane: "BENCH", side: "red", post: "mid",
    job: "Runs the bench: HIL runs, power and timing measurements, and what the numbers mean." },
  { id: "caitlyn", name: "Caitlyn", short: "Caitlyn", title: "the Sheriff of Piltover", lane: "DEBUG", side: "red", post: "bot",
    job: "Investigates: logs, traces, resets, flaky tests. Finds the root cause with evidence." },
  { id: "blitzcrank", name: "Blitzcrank", short: "Blitz", title: "the Great Steam Golem", lane: "CI", side: "red", post: "support",
    job: "Pulls things through: branches, rebases, PRs, CI failures." },
  { id: "zilean", name: "Zilean", short: "Zilean", title: "the Chronokeeper", lane: "NIGHTLIES", side: "none", post: "dragon",
    job: "Keeps the clock: nightly and long runs, schedules, what changed since last time." },
  { id: "twistedfate", name: "Twisted Fate", short: "TF", title: "the Card Master", lane: "FLEET", side: "none", post: "baron",
    job: "Releases and fleet: packaging, rollouts, station health. Asks before touching a station." },
  { id: "bard", name: "Bard", short: "Bard", title: "the Wandering Caretaker", lane: "SIDE QUESTS", side: "none", post: "river",
    job: "Roams between lanes: dashboards, scripts, exports and other side jobs." },
];
