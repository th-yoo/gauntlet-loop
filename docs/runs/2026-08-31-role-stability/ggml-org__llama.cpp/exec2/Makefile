CC      ?= cc
CFLAGS  ?= -std=c99 -O2 -Wall -Wextra
BIN     := infer

.PHONY: all clean run
all: $(BIN)

$(BIN): infer.c
	$(CC) $(CFLAGS) -o $(BIN) infer.c

run: $(BIN)
	./$(BIN) -p "the " -n 200 -b 8 -s 42

clean:
	rm -f $(BIN)
