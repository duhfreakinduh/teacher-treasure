const REPO_URL = 'https://github.com/duhfreakinduh/teacher-treasure';
const STORAGE = {
  customDeals: 'teacher-treasure.customDeals.v2',
  favorites: 'teacher-treasure.favorites.v2',
  watch: 'teacher-treasure.watch.v2'
};
const LEGACY_CUSTOM_DEALS = 'teacher-treasure.customDeals.v1';

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const savedFavorites = readJSON(STORAGE.favorites, []);
const savedWatch = readJSON(STORAGE.watch, { categories: [], watchOnly: false });
const state = {
  deals: [],
  favorites: new Set(Array.isArray(savedFavorites) ? savedFavorites : []),
  favoritesOnly: false,
  watch: {
    categories: Array.isArray(savedWatch.categories) ? savedWatch.categories : [],
    watchOnly: Boolean(savedWatch.watchOnly)
  }
};

const els = {
  grid: document.querySelector('#dealGrid'),
  empty: document.querySelector('#emptyState'),
  search: document.querySelector('#searchInput'),
  category: document.querySelector('#categoryFilter'),
  type: document.querySelector('#typeFilter'),
  location: document.querySelector('#locationFilter'),
  sort: document.querySelector('#sortFilter'),
  showExpired: document.querySelector('#showExpired'),
  resultsCount: document.querySelector('#resultsCount'),
  resultsTitle: document.querySelector('#resultsTitle'),
  favoriteCount: document.querySelector('#favoriteCount'),
  submitDialog: document.querySelector('#submitDialog'),
  watchDialog: document.querySelector('#watchDialog'),
  dealForm: document.querySelector('#dealForm'),
  watchForm: document.querySelector('#watchForm'),
  toast: document.querySelector('#toast'),
  scoutLinks: document.querySelector('#scoutLinks'),
  watchSummary: document.querySelector('#watchSummary'),
  installApp: document.querySelector('#installApp'),
  connectionStatus: document.querySelector('#connectionStatus')
};

let deferredInstallPrompt = null;

function getCustomDeals() {
  const current = readJSON(STORAGE.customDeals, null);
  if (Array.isArray(current)) return current;

  const legacy = readJSON(LEGACY_CUSTOM_DEALS, []);
  if (Array.isArray(legacy) && legacy.length) writeJSON(STORAGE.customDeals, legacy);
  return Array.isArray(legacy) ? legacy : [];
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const suffix = endOfDay ? 'T23:59:59' : 'T12:00:00';
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isExpired(deal) {
  const expiry = parseDate(deal.expires, true);
  return Boolean(expiry && expiry < new Date());
}

function daysUntil(value) {
  const expiry = parseDate(value, true);
  return expiry ? (expiry - new Date()) / 86400000 : Number.POSITIVE_INFINITY;
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

function expiryLabel(deal) {
  if (!deal.expires) return 'No listed deadline';
  if (isExpired(deal)) return `Expired ${formatDate(deal.expires)}`;
  return `Ends ${formatDate(deal.expires)}`;
}

function verificationLabel(deal) {
  if (deal.verificationStatus !== 'verified') return 'Community-added; not independently verified';
  return deal.lastVerified ? `Official source checked ${formatDate(deal.lastVerified)}` : 'Official source verified';
}

function normalizeDeal(deal) {
  return {
    id: String(deal.id || `local-${Date.now()}`),
    title: String(deal.title || 'Untitled deal'),
    organization: String(deal.organization || 'Unknown organization'),
    type: String(deal.type || 'Discount'),
    category: String(deal.category || 'Other'),
    locationType: String(deal.locationType || 'Online'),
    region: String(deal.region || 'See official source'),
    expires: deal.expires || '',
    url: safeUrl(deal.url),
    description: String(deal.description || ''),
    eligibility: String(deal.eligibility || 'Check the official source for eligibility.'),
    verificationStatus: deal.verificationStatus === 'verified' ? 'verified' : 'community',
    lastVerified: deal.lastVerified || '',
    created: deal.created || new Date().toISOString().slice(0, 10),
    savingsLabel: String(deal.savingsLabel || '')
  };
}

function uniqueCategories() {
  return [...new Set(state.deals.map(deal => deal.category).filter(Boolean))].sort();
}

function populateCategories() {
  const categories = uniqueCategories();
  const selected = els.category.value || 'all';
  els.category.innerHTML = '<option value="all">All categories</option>' + categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
  els.category.value = categories.includes(selected) ? selected : 'all';

  const watchCategories = document.querySelector('#watchCategories');
  watchCategories.innerHTML = categories.map(cat => `<label><input type="checkbox" name="categories" value="${escapeHtml(cat)}" ${state.watch.categories.includes(cat) ? 'checked' : ''}/> ${escapeHtml(cat)}</label>`).join('');
  els.watchForm.elements.watchOnly.checked = state.watch.watchOnly;
}

function filteredDeals() {
  const query = els.search.value.trim().toLowerCase();
  const watchOnly = state.watch.watchOnly && state.watch.categories.length > 0 && !state.favoritesOnly;
  const filtered = state.deals.filter(deal => {
    const haystack = [deal.title, deal.organization, deal.description, deal.eligibility, deal.category, deal.region, deal.type, deal.savingsLabel].join(' ').toLowerCase();
    return (!query || haystack.includes(query))
      && (els.category.value === 'all' || deal.category === els.category.value)
      && (els.type.value === 'all' || deal.type === els.type.value)
      && (els.location.value === 'all' || deal.locationType === els.location.value)
      && (els.showExpired.checked || !isExpired(deal))
      && (!state.favoritesOnly || state.favorites.has(deal.id))
      && (!watchOnly || state.watch.categories.includes(deal.category));
  });

  return filtered.sort((a, b) => {
    if (els.sort.value === 'ending') return daysUntil(a.expires) - daysUntil(b.expires);
    if (els.sort.value === 'az') return a.title.localeCompare(b.title);
    return String(b.lastVerified || b.created).localeCompare(String(a.lastVerified || a.created));
  });
}

function reportUrl(deal) {
  const title = encodeURIComponent(`Deal report: ${deal.organization} — ${deal.title}`);
  const body = encodeURIComponent(`The listing appears outdated or incorrect.\n\nDeal ID: ${deal.id}\nOfficial URL: ${deal.url}\n\nWhat changed:\n`);
  return `${REPO_URL}/issues/new?title=${title}&body=${body}&labels=needs%20verification`;
}

function cardTemplate(deal) {
  const saved = state.favorites.has(deal.id);
  const expired = isExpired(deal);
  const endingSoon = !expired && daysUntil(deal.expires) <= 30;
  const verified = deal.verificationStatus === 'verified';
  const isLocal = deal.id.startsWith('local-');
  const typeClass = `badge-${deal.type.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return `<article class="deal-card ${expired ? 'expired' : ''}">
    <div class="card-top">
      <div class="badges">
        <span class="badge ${typeClass}">${escapeHtml(deal.type)}</span>
        <span class="badge ${verified ? 'badge-verified' : 'badge-community'}">${verified ? '✓ Official source' : 'Community-added'}</span>
        ${endingSoon ? '<span class="badge badge-ending">Ending soon</span>' : ''}
        ${expired ? '<span class="badge badge-expired">Expired</span>' : ''}
      </div>
      <button class="save-btn ${saved ? 'saved' : ''}" type="button" data-save="${escapeHtml(deal.id)}" aria-label="${saved ? 'Remove from saved deals' : 'Save deal'}" aria-pressed="${saved}">${saved ? '★' : '☆'}</button>
    </div>
    <div class="card-body">
      <p class="card-org">${escapeHtml(deal.organization)}${deal.savingsLabel ? ` · ${escapeHtml(deal.savingsLabel)}` : ''}</p>
      <h3>${escapeHtml(deal.title)}</h3>
      <p class="card-description">${escapeHtml(deal.description)}</p>
      <p class="eligibility"><strong>Eligibility:</strong> ${escapeHtml(deal.eligibility)}</p>
      <div class="card-meta">
        <span>📍 ${escapeHtml(deal.locationType)} · ${escapeHtml(deal.region)}</span>
        <span>📅 ${escapeHtml(expiryLabel(deal))}</span>
        <span>🛡️ ${escapeHtml(verificationLabel(deal))}</span>
      </div>
      <div class="card-actions">
        <a class="btn btn-primary primary-link" href="${safeUrl(deal.url)}" target="_blank" rel="noopener noreferrer">Official source ↗</a>
        <button class="action-link share-btn" type="button" data-share="${escapeHtml(deal.id)}">Share</button>
        ${isLocal ? `<button class="action-link" type="button" data-delete="${escapeHtml(deal.id)}">Remove</button>` : `<a class="action-link" href="${reportUrl(deal)}" target="_blank" rel="noopener noreferrer">Report</a>`}
      </div>
    </div>
  </article>`;
}

function updateStats() {
  const active = state.deals.filter(deal => !isExpired(deal));
  document.querySelector('#dealCount').textContent = active.length;
  document.querySelector('#freeCount').textContent = active.filter(deal => deal.type === 'Free').length;
  document.querySelector('#verifiedCount').textContent = active.filter(deal => deal.verificationStatus === 'verified').length;
  els.favoriteCount.textContent = state.favorites.size;
}

function updateScoutLinks() {
  const query = els.search.value.trim() || 'teacher freebies discounts classroom resources';
  const searches = [
    ['Official-site search', `https://www.google.com/search?q=${encodeURIComponent(query + ' teacher offer official')}`],
    ['Fort Worth', `https://www.google.com/search?q=${encodeURIComponent(query + ' educator Fort Worth TX')}`],
    ['Grants', `https://www.google.com/search?q=${encodeURIComponent(query + ' teacher classroom grant official')}`],
    ['Giveaways', `https://www.google.com/search?q=${encodeURIComponent(query + ' teacher giveaway official rules')}`]
  ];
  els.scoutLinks.innerHTML = searches.map(([name, url]) => `<a class="scout-link" target="_blank" rel="noopener noreferrer" href="${url}"><span>${name}</span><span>↗</span></a>`).join('');
}

function updateWatchSummary() {
  if (!state.watch.categories.length) {
    els.watchSummary.hidden = true;
    return;
  }
  const mode = state.watch.watchOnly ? 'Showing only' : 'Watching';
  els.watchSummary.textContent = `${mode}: ${state.watch.categories.join(', ')}`;
  els.watchSummary.hidden = false;
}

function render() {
  const deals = filteredDeals();
  els.grid.innerHTML = deals.map(cardTemplate).join('');
  els.empty.hidden = deals.length !== 0;
  els.grid.hidden = deals.length === 0;
  els.resultsCount.textContent = `${deals.length} result${deals.length === 1 ? '' : 's'}`;
  els.resultsTitle.textContent = state.favoritesOnly ? 'Saved teacher deals' : 'Teacher deals';
  document.querySelector('#favoritesToggle').setAttribute('aria-pressed', String(state.favoritesOnly));
  updateStats();
  updateScoutLinks();
  updateWatchSummary();
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), 2800);
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

async function loadDeals() {
  let seedDeals = [];
  try {
    const response = await fetch('data/deals.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Could not load deal data');
    seedDeals = await response.json();
  } catch {
    toast('Verified listings could not refresh. Showing saved data when available.');
  }
  state.deals = [...getCustomDeals(), ...seedDeals].map(normalizeDeal);
  const activeIds = new Set(state.deals.map(deal => deal.id));
  state.favorites = new Set([...state.favorites].filter(id => activeIds.has(id)));
  writeJSON(STORAGE.favorites, [...state.favorites]);
  populateCategories();
  render();
}

function resetFilters() {
  els.search.value = '';
  els.category.value = 'all';
  els.type.value = 'all';
  els.location.value = 'all';
  els.sort.value = 'verified';
  els.showExpired.checked = false;
  state.favoritesOnly = false;
  render();
}

['input', 'change'].forEach(eventName => {
  [els.search, els.category, els.type, els.location, els.sort, els.showExpired].forEach(control => control.addEventListener(eventName, render));
});

document.querySelector('#clearFilters').addEventListener('click', resetFilters);
document.querySelector('#favoritesToggle').addEventListener('click', () => {
  state.favoritesOnly = !state.favoritesOnly;
  render();
});
document.querySelectorAll('#openSubmit, #emptyAdd').forEach(button => button.addEventListener('click', () => openDialog(els.submitDialog)));
document.querySelector('#openWatch').addEventListener('click', () => {
  populateCategories();
  openDialog(els.watchDialog);
});
document.querySelectorAll('.close-submit').forEach(button => button.addEventListener('click', () => els.submitDialog.close()));
document.querySelectorAll('.close-watch').forEach(button => button.addEventListener('click', () => els.watchDialog.close()));

els.grid.addEventListener('click', async event => {
  const saveButton = event.target.closest('[data-save]');
  if (saveButton) {
    const id = saveButton.dataset.save;
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    writeJSON(STORAGE.favorites, [...state.favorites]);
    render();
    toast(state.favorites.has(id) ? 'Deal saved.' : 'Deal removed from saved list.');
    return;
  }

  const shareButton = event.target.closest('[data-share]');
  if (shareButton) {
    const deal = state.deals.find(item => item.id === shareButton.dataset.share);
    if (!deal) return;
    const shareData = { title: deal.title, text: `${deal.organization}: ${deal.title}`, url: deal.url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast('Deal link copied.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast('Could not share this deal.');
    }
    return;
  }

  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) {
    const id = deleteButton.dataset.delete;
    const custom = getCustomDeals().filter(deal => deal.id !== id);
    writeJSON(STORAGE.customDeals, custom);
    state.deals = state.deals.filter(deal => deal.id !== id);
    state.favorites.delete(id);
    writeJSON(STORAGE.favorites, [...state.favorites]);
    populateCategories();
    render();
    toast('Local deal removed.');
  }
});

els.dealForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.dealForm));
  const deal = normalizeDeal({
    ...data,
    id: `local-${Date.now()}`,
    created: new Date().toISOString().slice(0, 10),
    verificationStatus: 'community',
    lastVerified: '',
    savingsLabel: ''
  });
  const custom = getCustomDeals();
  custom.unshift(deal);
  if (!writeJSON(STORAGE.customDeals, custom)) {
    toast('This browser could not save the deal.');
    return;
  }
  state.deals.unshift(deal);
  els.dealForm.reset();
  els.submitDialog.close();
  populateCategories();
  render();
  toast('Deal saved on this device. Submit it for community review to share it.');
});

els.watchForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(els.watchForm);
  state.watch = { categories: data.getAll('categories'), watchOnly: data.get('watchOnly') === 'on' };
  writeJSON(STORAGE.watch, state.watch);
  els.watchDialog.close();
  render();
  toast('Watch list saved on this device.');
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.installApp.hidden = false;
});
els.installApp.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installApp.hidden = true;
});
window.addEventListener('appinstalled', () => toast('Teacher Treasure installed.'));

function updateConnectionStatus() {
  els.connectionStatus.hidden = navigator.onLine;
}
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

loadDeals();
