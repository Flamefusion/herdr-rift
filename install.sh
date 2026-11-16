#!/bin/sh
# Installs the Rift layout, mod and theme into the Herdr app's folder. Safe to run again.
# Riot's art is not kept in this repo: the first run downloads it (see mods/rift/art/README.md).
set -eu
here=$(cd "$(dirname "$0")" && pwd)
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
[ -d "$home" ] || { echo "No Herdr app folder at $home"; exit 1; }
art="$here/mods/rift/art"
ddragon=$(cat "$art/DDRAGON_VERSION")
cdragon=${ddragon%.*}

fetch() { # fetch <url> <file>: only when the file is missing
  [ -s "$art/$2" ] && return 0
  echo "Downloading $2"
  curl -fsSL -o "$art/$2.part" "$1" && mv "$art/$2.part" "$art/$2" || { rm -f "$art/$2.part"; echo "Could not download $1"; exit 1; }
}
dd="https://ddragon.leagueoflegends.com/cdn/$ddragon/img"
for pair in heimerdinger:Heimerdinger teemo:Teemo viktor:Viktor jhin:Jhin braum:Braum ryze:Ryze ekko:Ekko \
            orianna:Orianna caitlyn:Caitlyn blitzcrank:Blitzcrank zilean:Zilean twistedfate:TwistedFate bard:Bard; do
  fetch "$dd/champion/${pair#*:}.png" "${pair%%:*}.png"
done
fetch "$dd/map/map11.png" map.png
cd="https://raw.communitydragon.org/$cdragon/game/assets/ux/minimap"
fetch "$cd/icons/blue.png" camp.png
fetch "$cd/icons/baron.png" baron.png
fetch "$cd/icons/dragon.png" dragon.png
fetch "$cd/pings/retreat.png" ping-approve.png
fetch "$cd/pings/mia_new.png" ping-answer.png
fetch "$cd/pings/assist.png" ping-handoff.png
fetch "$cd/pings/caution.png" ping-fail.png

mkdir -p "$home/mods/rift" "$home/themes" "$home/layouts"
# --checksum: only files that changed are rewritten, so Herdr does not reload every image.
rsync -a --checksum "$here/mods/rift/" "$home/mods/rift/"
rsync -a --checksum "$here/themes/rift.json" "$home/themes/rift.json"
rsync -a --checksum "$here/layouts/rift.json" "$here/layouts/rift.svg" "$home/layouts/"
"$home/mods/rift/bin/rift-setup" "$home"
echo "Installed into $home. Switch with: herdr-app do layout.switch '{\"name\":\"rift\"}'"
