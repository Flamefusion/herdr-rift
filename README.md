# herdr-rift

A fan-made layout for the [Herdr](https://herdr.dev) app: a squad of coding agents named after champions, each with a role brief, shown on a minimap that follows what they are doing.

> herdr-rift was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.

## Install

```sh
./install.sh
herdr-app do layout.switch '{"name":"rift"}'    # Cmd-Shift-L cycles layouts
```

`install.sh` copies the layout, mod and theme into `~/.config/herdr-app`, downloads the art (see Legal), and writes the per-machine files: each champion's Claude Code settings and an `hc` template. Edit here and run it again; do not edit the installed copy.

## The map

Blue (bottom left) builds new work; Red (top right) keeps things running. A champion stands:

- at its **fountain** when idle, in its **lane** when working, at its **nexus** when finished
- at a **jungle camp** during a long task of that kind (research, waiting, search, tests, hardware, build), shown after ten seconds
- at **Baron** while it runs a release command (tag, package build, publish, deploy), at **Dragon** during a nightly or soak run
- beside a squad mate at a **scuttle**, with a flag between them, for 90 seconds after one messages the other

On each champion: a spinning ring while working, a red **!** ping when it needs your approval, a yellow **?** ping when it has a question, a red flash when its tests, build, flash or release just failed, and a health bar for how much context it has left.

Click a champion to go to its terminal. Right-click for its menu: go to, interrupt, recall. The line under the map is the latest event; click it for the scoreboard. The Dock icon's badge counts champions waiting on you.

## Summoning

- **Champion select** (the + in the title strip, or any face on the bench): pick champions or a comp, optionally type the lead's first task, Lock In. The first pick leads and gets the task; the rest wait for a handoff.
- **As a helper**: any agent can run `hc run --bg --name jhin jhin "prove the fix on branch X"`. The helper has no tab; it still appears on the map (click to peek).
- Any agent in a tab named after a champion counts as that champion.

Champions talk with Claude Code's own session messages (each session is named after its champion); `bin/rift-tell` is the fallback, and is pre-approved in their settings.

## Scoreboard

The screen icon in the title strip: every champion's state, how long it has been working, context left, cost so far, and the last events.

Optional keys, in `~/.config/herdr-app/keys.json` (not added for you, because editing that file stops Herdr updating its default keys):

```json
"layout:rift": { "cmd-shift-s": "rift.score", "cmd-shift-c": "rift.select", "cmd-shift-m": "rift.menu" }
```

## How work flows

Teemo scouts, Heimerdinger designs everything, Viktor writes all the code (tests included), Jhin proves it works, Braum reviews the pull request. Caitlyn debugs, Ekko hunts regressions, Orianna runs the bench, Blitzcrank handles branches and CI, Zilean watches nightlies, Ryze documents, Twisted Fate ships, Bard takes the side jobs.

## Files

- `mods/rift/roster.js` the squad: name, title, lane, team (`side`) and position (`post`)
- `mods/rift/roles/<id>.md` the brief each champion's agent starts with
- `mods/rift/main.js`, `lib.js` the map, title strip, scout, champion select, scoreboard, menu and notifications
- `mods/rift/bin/rift-hook` Claude Code hook: writes what a champion is doing to `~/.config/herdr-app/rift-state/<id>.json`
- `mods/rift/bin/rift-status` Claude Code status line: records context left and cost, then prints your own status line
- `mods/rift/bin/rift-tell` types a message into another champion's terminal and logs the handoff
- `mods/rift/bin/rift-setup` writes `settings/<id>.json` and `~/.config/herdr-core/templates/<id>.md` for this machine
- `themes/rift.json` colours, `layouts/rift.json` the window, `demos/` the design mock-ups

The map needs Claude Code for camps, pings, health bars and handoffs. Other agent programs show lane, fountain, nexus and a plain ping only.

## Legal

Non-commercial fan project. The code in this repository is under the MIT licence (see `LICENSE`). The champion icons, minimap and ping icons are Riot Games' property, are not part of this repository and are not covered by that licence: `install.sh` downloads them to your machine from Data Dragon and Community Dragon. If Riot asks for this project to stop, it stops.
