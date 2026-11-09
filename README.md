# Recipe Box 🍽️

A **Progressive Web App** that stores your favorite recipes **locally on your phone** —
saved from **Instagram/online links** (via the share sheet) or as **photos you take**.
Everything is stored in the browser on the device (IndexedDB). It works **offline** and
can be **installed to your home screen** like a native app.

## Features

- 📤 **Share from Instagram or any app** → link (and shared images) land pre-filled in a
  new recipe (Web Share Target).
- 🔗 **Paste any link** manually; the source site is shown as a chip.
- 📷 **Take photos** with the camera button or pick from gallery; images are compressed
  on-device before saving.
- 🏷️ Tags, favorites ★, full-text search, sort (newest / oldest / A–Z).
- 🎨 Four switchable **layouts** — Magazine (default), Feed (photo grid), Compact list,
  Minimal — and three **themes** — Glossy magazine (default), Light, Dark (⚙ Settings).
- 💾 **Export / Import JSON** backup (photos included).
- 📴 Fully **offline** after first load (service worker), installable PWA.
- 🔒 **Private by design**: no accounts, no analytics, no data leaves the phone.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000/ in a browser (SW needs localhost or HTTPS)
```

## Run it on github.io (GitHub Pages)

The app is plain static files with relative paths, so it runs from a project page:

1. Push/merge to `main`.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → `main` / `/ (root)`.
3. Open **`https://jonaswillen.github.io/Recipes/`** on your phone → install via
   "Add to Home Screen" (iOS: Safari → Share → Add to Home Screen; Android: menu →
   "Install app" or the in-app Install button).

> GitHub Pages on a **private** repo needs a paid plan — make the repo public or use any
> other static host (Netlify, Vercel, Cloudflare Pages); nothing in the app is
> host-specific.

## Structure

```
index.html               App shell (top bar, view, FAB, settings dialog)
manifest.webmanifest     PWA manifest (icons, theme, share_target)
sw.js                    Service worker (offline cache + share-target handling)
js/db.js                 IndexedDB wrapper (RecipeDB) — shared by page & service worker
js/app.js                Router, views, forms, camera, search, export/import, install
css/styles.css           3 themes × 4 layouts via CSS variables
icons/                   App icons (SVG + PNG 192/512/maskable/apple-touch)
tools/make_icons.py      Regenerates PNG icons (pure Python stdlib): python3 tools/make_icons.py
spec.md                  Full specification incl. data model, PWA details, meta section
prompts.log              Append-only log of every prompt used to create this app
.nojekyll                Tells GitHub Pages not to run Jekyll
```

See [`spec.md`](spec.md) for the full spec — including the **meta section** describing
how this app was created and how every prompt is recorded in [`prompts.log`](prompts.log).
