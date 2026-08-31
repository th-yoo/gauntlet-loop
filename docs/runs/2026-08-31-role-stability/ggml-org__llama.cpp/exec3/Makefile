CC ?= cc
CFLAGS ?= -O2 -std=c99 -Wall -Wextra
LDLIBS = -lm

SRC = src/tensor.c src/model.c src/main.c
BIN = lmc-infer

.PHONY: all clean test

all: $(BIN)

$(BIN): $(SRC) src/tensor.h src/model.h
	$(CC) $(CFLAGS) -o $(BIN) $(SRC) $(LDLIBS)

test: $(BIN)
	./$(BIN) --seed 1 --tokens 32 --greedy "hello"
	./$(BIN) --seed 42 --tokens 32 --temp 0.7 "the model"

clean:
	rm -f $(BIN)
