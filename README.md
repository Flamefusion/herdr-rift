# herdr-rift

A League-of-Legends-themed layout for the Herdr app: a squad of coding agents named after champions, each with a role brief.

Status: working. Installed with `./install.sh`, shown with `herdr-app do layout.switch '{"name":"rift"}'` (Cmd-Shift-L cycles layouts).

- `mods/rift/roster.js` the squad: name, title, lane, team (`side`) and position (`post`)
- `mods/rift/roles/<id>.md` the brief each champion's agent starts with
- `mods/rift/settings/<id>.json` Claude Code hook settings passed at launch, so the map knows what the agent is doing
- `mods/rift/bin/rift-hook` the hook: writes `~/.config/herdr-app/rift-state/<id>.json`
- `mods/rift/bin/rift-tell` sends a message from one champion to another and logs it, so the map shows them together
- `mods/rift/art/` champion icons and the minimap from Riot's Data Dragon (version in `art/DDRAGON_VERSION`)
- `mods/rift/main.js` the map, the brand strip and the floating scout
- `themes/rift.json` colours, `layouts/rift.json` the window
- `demos/` the design mock-ups the layout was chosen from

## The map

Blue (bottom left) builds new work; Red (top right) keeps things running. A champion stands at its fountain when idle, in its lane when working, at a jungle camp during a long task of that kind (research, waiting, search, tests, hardware, build; shown after ten seconds), beside a squad mate at a scuttle after they exchange a message, at its nexus when finished, and shows a red ping when it needs you. Baron is a release, Dragon a nightly run. Click a champion to go to its terminal; click one on the bench to summon it into the current space. Any agent in a tab named after a champion counts as that champion.

## How work flows

Teemo scouts, Heimerdinger designs everything, Viktor writes all the code (tests included), Jhin proves it works, Braum reviews the pull request. Caitlyn debugs, Ekko hunts regressions, Orianna runs the bench, Blitzcrank handles branches and CI, Zilean watches nightlies, Ryze documents, Twisted Fate ships, Bard takes the side jobs.

## Legal

Non-commercial fan project for personal use. herdr-rift isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc. The champion icons in `mods/rift/art/*.png` are Riot's.
