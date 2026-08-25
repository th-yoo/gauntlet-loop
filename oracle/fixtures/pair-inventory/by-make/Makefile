# Writes inventory.csv beside this Makefile: one row per .md file in ../docs, with its line count.
DOCS := $(wildcard ../docs/*.md)

inventory.csv:
	@printf 'file,lines\n' > $@
	@for f in $(DOCS); do printf '%s,%s\n' "$$(basename $$f)" "$$(wc -l < $$f | tr -d ' ')" >> $@; done

clean:
	@rm -f inventory.csv
