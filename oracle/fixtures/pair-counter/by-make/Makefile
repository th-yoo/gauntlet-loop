# Builds the counter, which prints how many lines are in data.txt.
CFLAGS := -O2

counter: counter.c
	@$(CC) $(CFLAGS) -o $@ $<

run: counter
	@./counter

clean:
	@rm -f counter
