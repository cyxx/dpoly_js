
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>

static uint8_t _tmp[1 << 16];

struct LzssEncoder {
	int _count;

	void encodeBuf(const uint8_t *buf, int size) {
		int i = 0;
		while (i < size) {
			int mask = 0;
			const int pos = emitChar(mask);
			for (int bit = 0; bit < 8 && i < size; ++bit) {
				int max = 0;
				int ptr = 0;
				for (int index = 1; index < 4096; ++index) {
					int count = 0;
					while (count < 18 && i + count < size && i + count >= index) {
						if (buf[i + count] != buf[i + count - index]) {
							break;
						}
						++count;
					}
					if (count > max) {
						max = count;
						ptr = index;
					}
				}
				if (max < 3) {
					emitChar(buf[i]);
					++i;
				} else {
					mask |= 1 << bit;
					const int offset = ((max - 3) << 12) + ptr;
					emitChar(offset >> 8);
					emitChar(offset & 255);
					i += max;
				}
			}
			emitChar(mask, pos);
		}
	}

	int emitChar(int chr, int pos = -1) {
		if (pos == -1) {
			const int cur = _count;
			_tmp[_count] = chr;
			++_count;
			return cur;
		}
		_tmp[pos] = chr;
		return _count;
	}
};

struct Base64Encoder {
	uint32_t _bits;
	int _count;

	int getCode(int code) const {
		switch (code) {
		case  0 ... 25:
			return 'A' + code;
		case 26 ... 51:
			return 'a' + code - 26;
		case 52 ... 61:
			return '0' + code - 52;
		case 62:
			return '+';
		}
		return '/';
	}

	void encodeChar(int chr) {
		_bits <<= 8;
		_bits |= chr;
		_count += 8;
		if (_count == 24) {
			fprintf(stdout, "%c", getCode((_bits >> 18) & 63) );
			fprintf(stdout, "%c", getCode((_bits >> 12) & 63) );
			fprintf(stdout, "%c", getCode((_bits >>  6) & 63) );
			fprintf(stdout, "%c", getCode( _bits        & 63) );
			_bits = 0;
			_count = 0;
		}
	}
	void finish() {
		switch (_count) {
		case 16:
			_bits <<= 2;
			fprintf(stdout, "%c", getCode((_bits >> 12) & 63) );
			fprintf(stdout, "%c", getCode((_bits >>  6) & 63) );
			fprintf(stdout, "%c", getCode( _bits        & 63) );
			fprintf(stdout, "=");
			break;
		case 8:
			_bits <<= 4;
			fprintf(stdout, "%c", getCode((_bits >>  6) & 63) );
			fprintf(stdout, "%c", getCode( _bits        & 63) );
			fprintf(stdout, "==");
			break;
		}
	}
};

static void encode(const char *path, const char *name) {
	FILE *fp = fopen(path, "rb");
	if (fp) {
		fprintf(stdout, "var %s = '", name);
		Base64Encoder encoder;
		memset(&encoder, 0, sizeof(encoder));
		while (1) {
			const int c = fgetc(fp);
			if (feof(fp)) {
				break;
			}
			encoder.encodeChar(c);
		}
		encoder.finish();
		fprintf(stdout, "';\n");
		fclose(fp);
	}
}

static uint8_t _buf[1 << 16];

int main(int argc, char *argv[]) {
	if (argc >= 3) {
		encode(argv[1], "g_pol");
		encode(argv[2], "g_cmd");
	} else if (argc == 2) {
		FILE *fp = fopen(argv[1], "r");
		if (fp) {
			int count = 0;
			int freq[256];
			memset(freq, 0, sizeof(freq));
			while (1) {
				const int c = fgetc(fp);
				if (feof(fp)) {
					break;
				}
				++freq[c];
				_buf[count++] = c;
			}
			fclose(fp);
			LzssEncoder lzss;
			memset(&lzss, 0, sizeof(lzss));
			lzss.encodeBuf(_buf, count);
			const char *sep = strchr(argv[1], '.');
			fprintf(stdout, "var dat_%s = '", sep + 1);
			Base64Encoder b64;
			memset(&b64, 0, sizeof(b64));
			for (int i = 0; i < lzss._count; ++i) {
				b64.encodeChar(_tmp[i]);
			}
			b64.finish();
			fprintf(stdout, "';\n");
		}
	}
	return 0;
}
