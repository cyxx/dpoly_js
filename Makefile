
all: convert_music encode_data

convert_music: convert_music.o
	$(CXX) -o $@ $^ -lmodplug

encode_data: encode_data.o
	$(CXX) -o $@ $^

data.js: encode_data
	./encode_data intro.cmd >  data.js
	./encode_data intro.pol >> data.js
