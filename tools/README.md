# Case page generator

The case pages are generated from `data/cases.json`. This is a development-time step only: the published site is plain static HTML, CSS and JavaScript, and GitHub Pages never runs anything. No dependencies, only Node.

```
node tools/build-cases.js           # write whatever is out of date
node tools/build-cases.js --check   # write nothing; exit code 1 if anything generated is stale or a check fails
```

Run the first command after editing `data/cases.json`, `tools/partials/` or the template in `tools/build-cases.js`, then commit the generated files with the change. Run `--check` before committing or in CI: it fails when a generated file does not match what the data would produce.

## What it owns (and nothing else)

| File | How |
|---|---|
| `work/<slug>/index.html` | Fully generated, one per case. Do not edit by hand. |
| `index.html` | Only two blocks: the case folders between `<!-- cases:start … -->` and `<!-- cases:end -->`, and the preview thumbnails beside the WORK heading between `<!-- peek:start … -->` and `<!-- peek:end -->`. The rest of the page is hand-written (including the "3 projects" label). |
| `sitemap.xml` | Only the `/work/` entries. The home entry and any other entries are left alone. |

The menu and footer exist once, in `tools/partials/header.html` and `tools/partials/footer.html`. The `404.html` and `notes/` pages are not generated and keep their own copies.

## Adding or changing a case

1. Edit `data/cases.json` (add an object to `cases`; the order is the on-page order and the "Next case" order).
2. Put its screenshots in `assets/work/` as `<name>.webp` (1200×750) and `<name>-t.webp` (400×250).
3. Add the Spanish for any new text to `js/i18n-es.js`. The generator does not write translations; `--check` prints a warning for each string that has none.
4. `node tools/build-cases.js`, then `node tools/build-cases.js --check`.

Fields per case: `slug`, `n` (case number), `name`, `word` (the big word on the home page), `folderLabel`, `kind`, `lead` (two parts: plain text, then the bold part), `facts` (label/value pairs), `live` (public link or `null`), `built`, `shots` (`img` base name, `label`, `href` or `null`), `shotNote`, `lastmod` (sitemap date).

## What `--check` verifies

- Every generated file matches what the data produces.
- No duplicate slugs or case numbers; every referenced image (full and thumbnail) exists.
- Every URL in `sitemap.xml` is on `akai.do`, appears once, and has a file.
- Internal links and `/#talk`, `/#work`, `/#studio` anchors in the generated pages resolve.
- Warnings (not failures): text the case pages show that `js/i18n-es.js` cannot translate.

`data/` and `tools/` are served by GitHub Pages like every other folder; they contain no secrets.
