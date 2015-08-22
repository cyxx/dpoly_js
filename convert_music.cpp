
#include <dirent.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/param.h>
#include <sys/stat.h>
#include <unistd.h>
#include <libmodplug/modplug.h>

static uint8_t *readFile(const char *path, int *size) {
	uint8_t *tmp = 0;
	FILE *fp = fopen(path, "rb");
	if (fp) {
		fseek(fp, 0, SEEK_END);
		*size = ftell(fp);
		fseek(fp, 0, SEEK_SET);
		tmp = (uint8_t *)malloc(*size);
		if (tmp) {
			const int count = fread(tmp, 1, *size, fp);
			if (count != *size) {
				fprintf(stderr, "Failed to read %d bytes (%d)\n", *size,  count);
				free(tmp);
				tmp = 0;
			}
		}
		fclose(fp);
	}
	return tmp;
}

static void convertAmigaModToWav(const char *name, const uint8_t *data, int size) {
	ModPlugFile *f = ModPlug_Load(data, size);
	if (!f) {
		fprintf(stderr, "Failed to load '%s'\n", name);
		return;
	}
	fprintf(stdout, "Music '%s' size %d, name '%s'\n", name, size, ModPlug_GetName(f));

	ModPlug_Settings s;
	memset(&s, 0, sizeof(s));
	ModPlug_GetSettings(&s);
	s.mFlags = MODPLUG_ENABLE_OVERSAMPLING | MODPLUG_ENABLE_NOISE_REDUCTION;
	s.mChannels = 2;
	s.mBits = 16;
	s.mFrequency = 22050;
	s.mResamplingMode = MODPLUG_RESAMPLE_FIR;
	ModPlug_SetSettings(&s);

	FILE *fp = fopen("out.raw", "wb");
	if (fp) {
		int count;
		uint8_t buf[4096];
		while ((count = ModPlug_Read(f, buf, sizeof(buf))) > 0) {
			fwrite(buf, 1, count, fp);
		}
		fclose(fp);
		char cmd[1024];
		snprintf(cmd, sizeof(cmd), "sox -r 22050 -e signed -b 16 -c 2 out.raw music/%s.wav", name);
		const int ret = system(cmd);
		if (ret < 0) {
			fprintf(stderr, "Failed to convert .raw to .wav (%s)\n", cmd);
		}
		unlink("out.raw");
	}

	ModPlug_Unload(f);
}

static void convertAmigaModDir(const char *dir) {
	DIR *d = opendir(dir);
	if (d) {
		dirent *de;
		while ((de = readdir(d)) != NULL) {
			if (de->d_name[0] == '.') {
				continue;
			}
			char path[MAXPATHLEN];
			snprintf(path, sizeof(path), "%s/%s", dir, de->d_name);
			int size;
			uint8_t *data = readFile(path, &size);
			if (!data) {
				fprintf(stderr, "Failed to read '%s'\n", path);
				continue;
			}
			convertAmigaModToWav(de->d_name, data, size);
			free(data);
		}
		closedir(d);
	}
}

int main(int argc, char *argv[]) {
	if (argc == 2) {
		struct stat st;
		if (stat(argv[1], &st) != 0 || !S_ISDIR(st.st_mode)) {
			fprintf(stderr, "'%s' is not a directory\n", argv[1]);
		} else {
			convertAmigaModDir(argv[1]);
		}
	}
	return 0;
}
