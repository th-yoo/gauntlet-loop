# Builds landing.html for Cadence out of content.txt. `make` writes the page.
landing.html: content.txt
	@{ \
	  printf '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>%s</title></head>\n<body>\n' "$$(sed -n 1p content.txt)"; \
	  printf '<h1>%s</h1>\n' "$$(sed -n 1p content.txt)"; \
	  printf '<p class="tagline">%s</p>\n' "$$(sed -n 2p content.txt)"; \
	  printf '<p>%s</p>\n' "$$(sed -n 3p content.txt)"; \
	  printf '<a class="cta" href="/signup">Start scheduling</a>\n</body>\n</html>\n'; \
	} > $@

clean:
	@rm -f landing.html
