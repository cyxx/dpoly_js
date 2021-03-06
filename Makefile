
all: convert_music dpoly.min.js

dpoly.min.js: data.js decode.js player_cmp.js player_set.js
	cat $^ > dpoly.js
	java -jar compiler.jar --js dpoly.js --js_output_file $@

convert_music: convert_music.o
	$(CXX) -o $@ $^ -lmodplug

clean:
	rm -f *.o dpoly.js dpoly.min.js convert_music
