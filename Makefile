
all: convert_music dpoly.min.js encode_data

dpoly.min.js: decode.js player.js
	cat $^ > dpoly.js
	java -jar compiler.jar --js dpoly.js --js_output_file $@

convert_music: convert_music.o
	$(CXX) -o $@ $^ -lmodplug

encode_data: encode_data.o
	$(CXX) -o $@ $^
