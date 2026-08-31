CC ?= cc
CFLAGS ?= -O2 -Wall -Wextra -std=c11
BIN = tiny_infer

.PHONY: all run clean

all: $(BIN)

$(BIN): tiny_infer.c
	$(CC) $(CFLAGS) -o $(BIN) tiny_infer.c

run: $(BIN)
	./$(BIN) -p "The " -n 200

clean:
	rm -f $(BIN)
