# Recipe Box — Specification

A Progressive Web App (PWA) that stores recipes **locally on the phone** — saved from
Instagram/online links, or as photos taken with the phone camera. No account, no server,
no tracking: everything lives in the browser's IndexedDB on the device.

---

## Meta — how this app was created

This project was built with an AI coding agent. To make the creation process transparent
and reproducible, **every user prompt given during the build is recorded verbatim in
[`prompts.log`](prompts.log)**.

Prompt-log convention (append-only):

- Each entry gets the message `id`, a UTC timestamp, the channel, the **verbatim prompt
  text**, and the outcome/decision it led to.
- Entries are never edited or deleted — new prompts are appended at the bottom.
- The first entry (session `fd57aeff-b545-4a71-a570-371076e74f16`, 2026-11-09) contains the
  original request and the two UX decisions the user made (Magazine layout + glossy
  magazine theme as defaults).

Key facts about this build:

- **Repo:** `JonasWillen/Recipes` (branch created for this work: `vibe/recipe-pwa-0b572b`)
- **Stack:** dependency-free vanilla HTML/CSS/JS. No build step, no npm packages, no
  frameworks — so it can be served as plain static files from any host.
- **Storage:** IndexedDB (`recipe-box` database), photos stored as compressed JPEG blobs.
- **Generated assets:** PWA icons are produced by [`tools/make_icons.py`](tools/make_icons.py)
  (pure-stdlib PNG writer), so they can be regenerated any time.

---

## Goals

1. Save a recipe in under ~20 seconds from a phone.
2. Three capture paths:
   - **Share from Instagram/any app** → the OS share sheet can send the link (and shared
     images) straight into the app via the Web Share Target API.
   - **Paste a link** manually into the "New recipe" form.
   - **Take/attach photos** of a recipe (camera capture button or photo picker); photos
     are compressed on-device before storage.
3. Browse, search, filter by tag, favorite, sort — all offline.
4. Installable to the home screen (PWA) and fully usable offline via a service worker.
5. Data stays on the phone; JSON export/import for backup and migration.

## Non-goals (v1)

- No automatic scraping/parsing of recipe pages (cross-origin restrictions make this
  unreliable from a static PWA). The source URL is stored as a link; the user adds
  ingredients/steps manually or via the shared text.
- No cloud sync, no accounts.
- No OCR of recipe photos (kept as images).

## UX choices

Four list layouts and three themes are built in; the user can switch any time in
Settings (⚙). Persisted in `localStorage`.

| Choice | Layouts | Themes |
| --- | --- | --- |
| Options | Magazine (hero cards, editorial) · Feed (Instagram-style photo grid) · Compact list · Minimal text | Glossy magazine (cream paper, serif display type, glossy cards) · Light · Dark |
| **Chosen defaults** | **Magazine** | **Glossy magazine** |

Chosen by the user in session `fd57aeff…` ("magazine sounds cool", "something unique like
a glossy magazine").

## Data model (IndexedDB `recipe-box`, version 1)

Store `recipes` (keyPath `id`, autoIncrement; indexes `by-date`, `by-fav`, multiEntry
`by-tag`):

```json
{
  "id": 1,
  "title": "Creamy tomato pasta",
  "url": "https://instagram.com/p/…",
  "notes": "Add chili flakes next time",
  "ingredients": ["200 g pasta", "2 cans chopped tomatoes"],
  "steps": ["Boil the pasta", "Make the sauce", "Combine"],
  "tags": ["pasta", "vegetarian"],
  "favorite": true,
  "photos": ["<Blob jpeg>", "…"],
  "createdAt": 1762704000000,
  "updatedAt": 1762704000000
}
```

Store `meta` (keyPath `key`): used for `pendingShare` (payload handed over from the
service worker when the app is opened via the OS share sheet) and can hold future
one-off state.

Settings (`layout`, `theme`) live in `localStorage` key `rb-settings`.

## Architecture / file map

```
index.html               App shell (top bar, view container, FAB, settings dialog)
manifest.webmanifest     PWA manifest: icons, theme, share_target (POST ./share-target)
sw.js                    Service worker: precache shell, cache-first same-origin GET,
                         offline navigation fallback, intercepts share-target POST
js/db.js                 Tiny IndexedDB wrapper (RecipeDB), shared by page and SW
js/app.js                Router (#/, #/new, #/recipe/:id, #/edit/:id), rendering,
                         forms, camera capture + compression, search/filter/sort,
                         favorites, JSON export/import, install prompt, share handling
css/styles.css           Themes (glossy/light/dark) via CSS variables on <html data-theme>
                         and the 4 layouts via <html data-layout>
icons/                   icon.svg + generated PNGs (192, 512, maskable 512, apple 180)
tools/make_icons.py      Regenerates the PNG icons (pure Python stdlib)
spec.md                  This file
README.md                Structure + how to run/host
prompts.log              Append-only log of every prompt used to build this app
.nojekyll                Disables Jekyll processing on GitHub Pages
```

## PWA details

- **Installable:** manifest with `display: standalone`, maskable icon, `theme_color`.
  An in-app "Install" button appears when the browser fires `beforeinstallprompt`
  (Android/Chrome). On iOS: Safari → Share → "Add to Home Screen".
- **Offline:** service worker precaches the app shell on install; same-origin GETs are
  cache-first with network fallback; navigations fall back to the cached shell.
- **Share Target:** sharing a link/image from Instagram (or any app) to "Recipe Box"
  POSTs to `./share-target`; the service worker stores the payload in IndexedDB
  (`meta.pendingShare`) and redirects to `./?share=1`; the app picks it up and opens
  the New-recipe form pre-filled (title, URL extracted from text if needed, notes,
  attached photos).
- **Camera:** `<input type="file" accept="image/*" capture="environment">` opens the
  rear camera directly; images are downscaled to max 1600 px JPEG q0.85 via canvas
  before being stored, to keep IndexedDB usage small.
- **Backup:** Settings → Export JSON downloads all recipes (photos as data URLs);
  Import JSON restores them.

## Running locally

Any static file server works, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/  (service workers require localhost or HTTPS)
```

## Hosting on github.io (GitHub Pages)

The app uses only relative paths, so it works from a project page (not just user pages):

1. Push `main` (or merge this PR).
2. Repo → **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/ (root)` → Save.
3. After a minute the app is live at **`https://jonaswillen.github.io/Recipes/`** —
   open it on the phone, then install it to the home screen.

> Note: GitHub Pages for **private** repositories requires a paid GitHub plan. If this
> repo stays private, either make it public or use any other static host (Netlify,
> Vercel, Cloudflare Pages) — the app has no host-specific code. `https://…github.io` is
> what is usually meant by "google.io"-style hosting; adjust here if a different host
> was intended.

## Privacy

No network calls are made by the app itself (the only external navigation is the user
tapping a saved source link). All recipes and photos never leave the device except via
the user's own export.

## Verification checklist (manual, on a phone)

- [ ] Open the hosted URL, install to home screen, relaunch from the icon.
- [ ] Airplane mode on: app still opens and lists recipes (offline).
- [ ] In Instagram (or any app) → Share → "Recipe Box" → link + photo arrive pre-filled
  in the New-recipe form.
- [ ] New recipe with camera photo → saved, visible in list, opens in detail.
- [ ] Search / tag filter / favorites / sort work.
- [ ] Settings: switch layout and theme, reload → persisted.
- [ ] Export JSON → file downloads; import it back on another device.

## Future ideas

- Optional recipe-structured-data (schema.org JSON-LD) parsing when pasting a link
  from sites that embed it (via a user-installed helper, since static PWAs can't fetch
  cross-origin).
- OCR of photographed recipes via on-device models.
- Cloud sync (opt-in) via e.g. a personal Drive/Dropbox folder with the JSON export.
- Cooking mode (keep screen on, large steps).
