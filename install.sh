#!/bin/sh
# Copies the Rift layout, mod and theme into the Herdr app's folder. Safe to run again.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
[ -d "$home" ] || { echo "No Herdr app folder at $home"; exit 1; }
mkdir -p "$home/mods/rift" "$home/themes" "$home/layouts"
# --checksum: only files that changed are rewritten, so Herdr does not reload every image.
rsync -a --checksum "$here/mods/rift/" "$home/mods/rift/"
rsync -a --checksum "$here/themes/rift.json" "$home/themes/rift.json"
rsync -a --checksum "$here/layouts/rift.json" "$here/layouts/rift.svg" "$home/layouts/"
echo "Installed into $home. Switch with: herdr-app do layout.switch '{\"name\":\"rift\"}'"
