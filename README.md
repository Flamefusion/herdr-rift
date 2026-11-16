# herdr-rift

A League-of-Legends-themed layout for the Herdr app: a squad of coding agents named after champions, each with a role brief.

Status: draft. Nothing here is installed into Herdr yet; the look is being chosen from the demos first.

- `mods/rift/roster.js` the squad (name, title, lane, job), in the order work flows
- `mods/rift/roles/<id>.md` the brief each champion's agent starts with
- `mods/rift/art/<id>.png` champion square icons from Riot's Data Dragon (version in `art/DDRAGON_VERSION`)
- `mods/rift/main.js` the squad panel, brand strip and the floating scout
- `themes/rift.json` colours
- `layouts/` the window layout (not written yet)
- `demos/` design mock-ups

The folder is laid out like `~/.config/herdr-app`, so installing is copying `mods/rift`, `themes/rift.json` and `layouts/rift.json` there.

## How work flows

Teemo scouts, Heimerdinger designs, Viktor builds, Jhin tests, Braum reviews. Caitlyn debugs, Ekko hunts regressions, Orianna runs the bench, Blitzcrank handles branches and CI, Zilean watches nightlies, Ryze documents, Twisted Fate ships, Bard takes the side jobs.

## Legal

Non-commercial fan project for personal use. herdr-rift isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc. The champion icons in `mods/rift/art/*.png` are Riot's.
