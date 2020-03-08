#!/bin/sh
set -x

for f in chute debut desinteg espions fin gen genexp holoseq intro logos memo over pont taxi teleport voyage; do
	openssl enc -e -base64 -in cine/$f.cmp > cine/$f.cmp.txt
done

for f in caillou cdfiles jupiter mecha; do
	openssl enc -e -base64 -in cine/$f.set > cine/$f.set.txt
done

dir=$1
if [ -d "$dir" ]; then
	mkdir music/
	./convert_music $1
	for f in music/*wav; do
		oggenc $f
	done
fi
