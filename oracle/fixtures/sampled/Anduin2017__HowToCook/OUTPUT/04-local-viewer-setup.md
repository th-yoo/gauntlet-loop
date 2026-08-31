# Running a Local Recipe Viewer

For a browsable, always-available copy of this index — rather than reading
it as a document — the recipes can be served by a small local web
application. If you have Docker installed, bring it up with:

```bash
docker pull aiursoft/howtocookviewer
docker run -d -p 5000:5000 aiursoft/howtocookviewer
```

That starts a container listening on port 5000. Point a browser at
`http://localhost:5000` once it's up.

A few operational notes, since this is presented the way a program's setup
instructions would be, not glossed over:

- **Default credentials** are `admin` / `Admin@123456!`. Treat these as a
  placeholder to change, not a password to keep — the usual rule for any
  service you expose beyond your own machine applies here too.
- **Indexing takes time.** After the container starts, allow roughly 30
  minutes for it to build its internal index of recipes before search and
  browsing are fully populated. Don't take an empty-looking result in the
  first few minutes as a failure.
- This is optional. Nothing in the [Recipe Index](02-recipe-index.md) or the
  fundamentals requires the web viewer — it's a convenience layer on top of
  the same content, for anyone who'd rather click through categories than
  scroll a document.
