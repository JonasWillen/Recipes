(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const view = document.getElementById('view');

  const state = {
    recipes: [],
    q: '',
    tag: '',
    favOnly: false,
    sort: 'new',
    pendingShare: null,
    photoUrls: new Map(),
  };

  const DEFAULT_SETTINGS = { layout: 'magazine', theme: 'glossy' };
  const settings = loadSettings();

  function loadSettings() {
    try {
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem('rb-settings') || '{}'));
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function saveSettings() {
    localStorage.setItem('rb-settings', JSON.stringify(settings));
    applySettings();
  }

  function applySettings() {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.layout = settings.layout;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function releaseUrls() {
    for (const u of state.photoUrls.values()) URL.revokeObjectURL(u);
    state.photoUrls.clear();
  }

  function urlFor(key, blob) {
    if (!state.photoUrls.has(key)) state.photoUrls.set(key, URL.createObjectURL(blob));
    return state.photoUrls.get(key);
  }

  async function refresh() {
    state.recipes = await RecipeDB.all();
  }

  function route() {
    releaseUrls();
    const hash = location.hash || '#/';
    let m = hash.match(/^#\/recipe\/(\d+)$/);
    if (m) return renderDetail(Number(m[1]));
    m = hash.match(/^#\/edit\/(\d+)$/);
    if (m) return renderForm(Number(m[1]));
    if (hash === '#/new') return renderForm(null);
    renderList();
  }

  function filtered() {
    let list = state.recipes.slice();
    const q = state.q.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => [r.title, r.notes, r.url, (r.tags || []).join(' '), (r.ingredients || []).join(' '), (r.steps || []).join(' ')].join(' ').toLowerCase().includes(q));
    }
    if (state.tag) list = list.filter((r) => (r.tags || []).includes(state.tag));
    if (state.favOnly) list = list.filter((r) => r.favorite);
    const s = state.sort;
    list.sort((a, b) => {
      if (s === 'old') return a.createdAt - b.createdAt;
      if (s === 'az') return String(a.title).localeCompare(String(b.title));
      return b.createdAt - a.createdAt;
    });
    return list;
  }

  function allTags() {
    const set = new Set();
    for (const r of state.recipes) for (const t of r.tags || []) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function cardHTML(r) {
    const photo = (r.photos && r.photos.length)
      ? `<img class="thumb" src="${urlFor('r' + r.id, r.photos[0])}" alt="">`
      : '<div class="thumb thumb-empty" aria-hidden="true">🍽️</div>';
    const host = hostOf(r.url);
    return `<article class="card" data-id="${r.id}" tabindex="0" role="link" aria-label="${esc(r.title)}">
      ${photo}
      <div class="card-body">
        <h3 class="card-title">${esc(r.title)}</h3>
        <div class="card-meta">
          ${host ? `<span class="chip chip-src">${esc(host)}</span>` : ''}
          ${(r.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
          <span class="chip chip-date">${fmtDate(r.createdAt)}</span>
        </div>
      </div>
      <button class="fav ${r.favorite ? 'on' : ''}" data-fav="${r.id}" aria-label="Toggle favorite">${r.favorite ? '★' : '☆'}</button>
    </article>`;
  }

  function renderList() {
    const list = filtered();
    const chips = [''].concat(allTags()).map((t) => {
      const label = t === '' ? 'All' : t;
      return `<button class="chip chip-filter ${state.tag === t ? 'on' : ''}" data-tag="${esc(t)}">${esc(label)}</button>`;
    }).join('');
    view.innerHTML = `
      <div class="toolbar">
        <div class="chips">${chips}</div>
        <div class="toolbar-row">
          <button class="chip chip-filter ${state.favOnly ? 'on' : ''}" data-favonly="1">★ Favorites</button>
          <select id="sort" aria-label="Sort">
            <option value="new" ${state.sort === 'new' ? 'selected' : ''}>Newest</option>
            <option value="old" ${state.sort === 'old' ? 'selected' : ''}>Oldest</option>
            <option value="az" ${state.sort === 'az' ? 'selected' : ''}>A–Z</option>
          </select>
        </div>
      </div>
      ${list.length === 0
        ? '<div class="empty"><p><strong>No recipes yet.</strong></p><p>Tap + to save one, or share a link from Instagram straight into the app.</p></div>'
        : `<div class="cards">${list.map(cardHTML).join('')}</div>`}
    `;
    $$('.card', view).forEach((c) => {
      c.addEventListener('click', (e) => {
        if (e.target.closest('.fav')) return;
        location.hash = '#/recipe/' + c.dataset.id;
      });
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = '#/recipe/' + c.dataset.id; });
    });
    $$('.fav', view).forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await RecipeDB.get(Number(b.dataset.fav));
      if (r) { r.favorite = !r.favorite; await RecipeDB.put(r); await refresh(); renderList(); }
    }));
    $$('.chip-filter', view).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.favonly) state.favOnly = !state.favOnly;
      else state.tag = b.dataset.tag;
      renderList();
    }));
    const sortSel = $('#sort', view);
    if (sortSel) sortSel.addEventListener('change', () => { state.sort = sortSel.value; renderList(); });
  }

  async function renderDetail(id) {
    const r = await RecipeDB.get(id);
    if (!r) { location.hash = '#/'; return; }
    const host = hostOf(r.url);
    const photos = (r.photos || []).map((p, i) => `<figure class="photo"><img src="${urlFor('d' + id + ':' + i, p)}" alt=""></figure>`).join('');
    view.innerHTML = `
      <article class="detail">
        ${photos ? `<div class="gallery">${photos}</div>` : ''}
        <h1>${esc(r.title)}</h1>
        <div class="card-meta">
          ${host ? `<a class="chip chip-src" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(host)} ↗</a>` : ''}
          ${(r.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
          <span class="chip chip-date">${fmtDate(r.createdAt)}</span>
        </div>
        ${r.notes ? `<section><h2>Notes</h2><p class="notes">${esc(r.notes)}</p></section>` : ''}
        ${r.ingredients && r.ingredients.length ? `<section><h2>Ingredients</h2><ul class="lines">${r.ingredients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
        ${r.steps && r.steps.length ? `<section><h2>Steps</h2><ol class="lines">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>` : ''}
        <div class="actions">
          <button id="d-fav" class="btn">${r.favorite ? '★ Unfavorite' : '☆ Favorite'}</button>
          <button id="d-edit" class="btn">Edit</button>
          <button id="d-share" class="btn">Share</button>
          <button id="d-delete" class="btn danger">Delete</button>
        </div>
      </article>`;
    $('#d-fav', view).addEventListener('click', async () => { r.favorite = !r.favorite; await RecipeDB.put(r); renderDetail(id); });
    $('#d-edit', view).addEventListener('click', () => { location.hash = '#/edit/' + id; });
    $('#d-delete', view).addEventListener('click', async () => {
      if (confirm('Delete this recipe?')) { await RecipeDB.del(id); await refresh(); location.hash = '#/'; }
    });
    $('#d-share', view).addEventListener('click', async () => {
      const data = { title: r.title, text: r.notes || r.title, url: r.url || location.href };
      if (navigator.share) {
        try { await navigator.share(data); } catch (e) { /* dismissed */ }
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText([r.title, r.url].filter(Boolean).join('\n'));
      }
    });
  }

  function compressImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob((b) => resolve(b || file), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function renderForm(id) {
    const existing = id ? await RecipeDB.get(id) : null;
    if (id && !existing) { location.hash = '#/'; return; }
    const r = existing || { title: '', url: '', notes: '', ingredients: [], steps: [], tags: [], favorite: false, photos: [] };
    let photos = (r.photos || []).slice();
    if (state.pendingShare) {
      const p = state.pendingShare;
      state.pendingShare = null;
      if (!r.title) r.title = p.title || '';
      if (!r.url) r.url = p.url || '';
      if (!r.notes && p.text && p.text !== p.url) r.notes = p.text;
      photos = photos.concat(p.photos || []);
    }
    view.innerHTML = `
      <form id="recipe-form" class="form">
        <h1>${id ? 'Edit recipe' : 'New recipe'}</h1>
        <label>Title<input id="f-title" required value="${esc(r.title)}" placeholder="e.g. Creamy tomato pasta"></label>
        <label>Source link<input id="f-url" type="url" value="${esc(r.url)}" placeholder="https://instagram.com/…"></label>
        <label>Notes<textarea id="f-notes" rows="4" placeholder="What was good about it?">${esc(r.notes)}</textarea></label>
        <label>Ingredients (one per line)<textarea id="f-ingredients" rows="5" placeholder="200 g pasta&#10;2 cans chopped tomatoes">${esc((r.ingredients || []).join('\n'))}</textarea></label>
        <label>Steps (one per line)<textarea id="f-steps" rows="6" placeholder="Boil the pasta&#10;Make the sauce">${esc((r.steps || []).join('\n'))}</textarea></label>
        <label>Tags (comma separated)<input id="f-tags" value="${esc((r.tags || []).join(', '))}" placeholder="pasta, vegetarian"></label>
        <fieldset class="photos-field">
          <legend>Photos</legend>
          <div id="photo-grid" class="photo-grid"></div>
          <div class="row">
            <label class="btn">📷 Take photo<input id="f-camera" type="file" accept="image/*" capture="environment" hidden></label>
            <label class="btn">Add photos<input id="f-files" type="file" accept="image/*" multiple hidden></label>
          </div>
        </fieldset>
        <label class="check"><input id="f-fav" type="checkbox" ${r.favorite ? 'checked' : ''}> Favorite</label>
        <div class="actions">
          <button type="submit" class="btn primary">Save</button>
          <button type="button" id="f-cancel" class="btn">Cancel</button>
        </div>
      </form>`;

    const grid = $('#photo-grid', view);
    function renderPhotoGrid() {
      grid.innerHTML = photos.map((p, i) => `<figure class="photo"><img src="${urlFor('f' + i, p)}" alt=""><button type="button" class="remove" data-i="${i}" aria-label="Remove photo">×</button></figure>`).join('');
      $$('.remove', grid).forEach((b) => b.addEventListener('click', () => {
        photos.splice(Number(b.dataset.i), 1);
        renderPhotoGrid();
      }));
    }
    renderPhotoGrid();

    async function addFiles(fileList) {
      for (const f of fileList) {
        if (f.type && f.type.startsWith('image/')) photos.push(await compressImage(f));
      }
      renderPhotoGrid();
    }
    $('#f-camera', view).addEventListener('change', (e) => addFiles(e.target.files));
    $('#f-files', view).addEventListener('change', (e) => addFiles(e.target.files));
    $('#f-cancel', view).addEventListener('click', () => { location.hash = id ? '#/recipe/' + id : '#/'; });

    $('#recipe-form', view).addEventListener('submit', async (e) => {
      e.preventDefault();
      const lines = (sel) => $(sel, view).value.split('\n').map((s) => s.trim()).filter(Boolean);
      const rec = {
        title: $('#f-title', view).value.trim(),
        url: $('#f-url', view).value.trim(),
        notes: $('#f-notes', view).value.trim(),
        ingredients: lines('#f-ingredients'),
        steps: lines('#f-steps'),
        tags: $('#f-tags', view).value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        favorite: $('#f-fav', view).checked,
        photos,
        createdAt: existing ? existing.createdAt : Date.now(),
        updatedAt: Date.now(),
      };
      if (!rec.title) return;
      if (id) {
        rec.id = id;
        await RecipeDB.put(rec);
        location.hash = '#/recipe/' + id;
      } else {
        const nid = await RecipeDB.add(rec);
        location.hash = '#/recipe/' + nid;
      }
      await refresh();
    });
  }

  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  async function exportJSON() {
    const recs = await RecipeDB.all();
    const recipes = [];
    for (const r of recs) {
      const photos = [];
      for (const p of r.photos || []) photos.push(await blobToDataURL(p));
      recipes.push(Object.assign({}, r, { photos }));
    }
    const payload = { app: 'recipe-box', version: 1, exportedAt: new Date().toISOString(), recipes };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'recipe-box-export-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function importJSON(file) {
    const data = JSON.parse(await file.text());
    const recs = Array.isArray(data) ? data : data.recipes;
    if (!Array.isArray(recs)) throw new Error('no recipes found in file');
    for (const r of recs) {
      const photos = [];
      for (const p of r.photos || []) {
        if (typeof p === 'string' && p.startsWith('data:')) photos.push(await (await fetch(p)).blob());
        else if (p) photos.push(p);
      }
      await RecipeDB.add({
        title: r.title || 'Untitled',
        url: r.url || '',
        notes: r.notes || '',
        ingredients: r.ingredients || [],
        steps: r.steps || [],
        tags: r.tags || [],
        favorite: !!r.favorite,
        photos,
        createdAt: r.createdAt || Date.now(),
        updatedAt: r.updatedAt || Date.now(),
      });
    }
    await refresh();
    renderList();
  }

  async function handleShared() {
    const params = new URLSearchParams(location.search);
    if (!params.has('share')) return;
    history.replaceState(null, '', location.pathname + location.hash);
    const rec = await RecipeDB.metaGet('pendingShare');
    const pending = rec && rec.value;
    if (pending) {
      await RecipeDB.metaDel('pendingShare');
      state.pendingShare = pending;
      location.hash = '#/new';
    }
  }

  function syncSettingsDialog() {
    $$('#settings input[name="layout"]').forEach((r) => { r.checked = r.value === settings.layout; });
    $$('#settings input[name="theme"]').forEach((r) => { r.checked = r.value === settings.theme; });
  }

  function bindHeader() {
    const search = $('#search');
    search.value = state.q;
    search.addEventListener('input', () => {
      state.q = search.value;
      const h = location.hash || '#/';
      if (h === '#/' || h === '') renderList();
    });
    $('#fab').addEventListener('click', () => { location.hash = '#/new'; });
    $('#settings-btn').addEventListener('click', () => { syncSettingsDialog(); $('#settings').showModal(); });
    $$('#settings input[name="layout"]').forEach((r) => r.addEventListener('change', () => {
      settings.layout = r.value;
      saveSettings();
      renderList();
    }));
    $$('#settings input[name="theme"]').forEach((r) => r.addEventListener('change', () => {
      settings.theme = r.value;
      saveSettings();
    }));
    $('#export-btn').addEventListener('click', exportJSON);
    $('#import-file').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (f) {
        try { await importJSON(f); } catch (err) { alert('Import failed: ' + err.message); }
        e.target.value = '';
      }
    });
    let deferred;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      $('#install-btn').hidden = false;
    });
    $('#install-btn').addEventListener('click', async () => {
      if (deferred) { deferred.prompt(); deferred = null; $('#install-btn').hidden = true; }
    });
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', async () => {
    applySettings();
    bindHeader();
    await refresh();
    await handleShared();
    route();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
  }
})();
