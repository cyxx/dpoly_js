
encode_data: encode_data.o
	$(CXX) -o $@ $^

data.js: encode_data
	./encode_data intro.cmd >  data.js
	./encode_data intro.pol >> data.js
