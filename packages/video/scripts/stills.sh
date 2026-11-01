#!/bin/zsh
# Storyboard stills from a prebuilt bundle: scripts/stills.sh <composition> <outDir> frame:name ...
id=$1; out=$2; shift 2; mkdir -p $out
for f in "$@"; do npx remotion still build $id $out/${f#*:}.png --frame=${f%%:*} --log=error || exit 1; echo "still ${f#*:}"; done
