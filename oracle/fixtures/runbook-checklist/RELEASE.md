# Cutting a release

Work through these in order. Each step is something you do now, not something you
hand to anyone.

1. Run the tests: `node build.mjs --check`. Stop if it exits non-zero.
2. Write the version into `VERSION`: `node build.mjs --stamp 1.4.0`
3. Confirm it took: `cat VERSION` should print `1.4.0`.

That is the whole release. There is no approval step and nobody else to notify.
