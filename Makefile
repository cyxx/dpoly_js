
all: convert_music encode_data

dpoly.min.js: decode.js player.js
	cat $^ > dpoly.js
	java -jar compiler.jar --js dpoly.js --js_output_file $@

convert_music: convert_music.o
	$(CXX) -o $@ $^ -lmodplug

encode_data: encode_data.o
	$(CXX) -o $@ $^

data.js: encode_data
	./encode_data intro.cmd >  data.js
	./encode_data intro.pol >> data.js
