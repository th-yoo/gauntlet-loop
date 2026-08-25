#include <stdio.h>
int main(void) {
  FILE *f = fopen("data.txt", "r");
  if (!f) { printf("0\n"); return 0; }
  int n = 0, c, last = '\n';
  while ((c = fgetc(f)) != EOF) { if (c == '\n') n++; last = c; }
  if (last != '\n') n++;
  fclose(f);
  printf("%d\n", n);
  return 0;
}
